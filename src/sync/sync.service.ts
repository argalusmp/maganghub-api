import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CronJob } from '@nestjs/schedule/node_modules/cron';
import { randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';

const WATERMARK_KEY = 'vacancies_watermark';

export interface SyncRunMetrics {
  id: string;
  startedAt: Date;
  finishedAt?: Date;
  pagesFetched: number;
  itemsInserted: number;
  itemsUpdated: number;
  itemsDeactivated: number;
  status: 'success' | 'failed';
  note?: string;
}

type JsonInput = Prisma.InputJsonValue | typeof Prisma.JsonNull;

interface VacancyPayload {
  id_posisi: string;
  posisi: string | null;
  deskripsi_posisi: string | null;
  jumlah_kuota: number | null;
  jumlah_terdaftar: number | null;
  program_studi: string[];
  jenjang: string[];
  nama_perusahaan: string | null;
  kode_provinsi: string | null;
  nama_provinsi: string | null;
  kode_kabupaten: string | null;
  nama_kabupaten: string | null;
  pendaftaran_awal: Date | null;
  pendaftaran_akhir: Date | null;
  mulai: Date | null;
  selesai: Date | null;
  agency: string | null;
  sub_agency: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  source_raw: JsonInput;
}

interface VacancyResponseMeta {
  current_page?: number;
  last_page?: number;
  total_page?: number;
  total_data?: number;
}

interface VacancyFetchResult {
  items: any[];
  pagination: VacancyResponseMeta;
}

@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);
  private readonly batchSaveConcurrency = 10;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    this.registerCronJobs();
  }

  async syncProvinces(): Promise<{ total: number }> {
    const response = await firstValueFrom(
      this.httpService.get('/list/provinces', {
        params: {
          order_by: 'nama_propinsi',
          order_direction: 'ASC',
          page: 1,
          limit: 40,
        },
      }),
    );

    const payload = this.extractArray(response.data);

    let counter = 0;
    for (const province of payload) {
      if (!province?.kode_propinsi) continue;
      await this.prisma.province.upsert({
        where: { kode_propinsi: String(province.kode_propinsi) },
        update: {
          nama_propinsi: province.nama_propinsi ?? province.nama_provinsi ?? '-',
          id_propinsi: province.id_propinsi ?? null,
        },
        create: {
          kode_propinsi: String(province.kode_propinsi),
          nama_propinsi: province.nama_propinsi ?? province.nama_provinsi ?? '-',
          id_propinsi: province.id_propinsi ?? null,
        },
      });
      counter += 1;
    }

    return { total: counter };
  }

  async runIncrementalSync(triggeredByCron = false): Promise<SyncRunMetrics> {
    const run = await this.startRunRecord('incremental');
    const metrics: SyncRunMetrics = {
      id: run.id,
      startedAt: run.startedAt,
      pagesFetched: 0,
      itemsInserted: 0,
      itemsUpdated: 0,
      itemsDeactivated: 0,
      status: 'success',
    };

    const etlConfig = this.config.etl;
    const watermark = await this.getWatermark();
    let maxSeen = watermark;
    let stopCounter = 0;

    try {
      for (let page = 1; page <= etlConfig.maxPages; page += 1) {
        const result = await this.fetchVacancies(page, etlConfig.limit);
        if (!result.items.length) {
          break;
        }

        metrics.pagesFetched += 1;
        for (const item of result.items) {
          const normalized = this.normalizeVacancy(item);
          if (!normalized) continue;

          const srcUpdated = normalized.updated_at ?? normalized.created_at;
          if (watermark && srcUpdated && watermark >= srcUpdated) {
            stopCounter += 1;
            if (stopCounter >= etlConfig.stopThreshold) {
              break;
            }
            continue;
          } else {
            stopCounter = 0;
          }

          const action = await this.saveVacancy(normalized);
          if (action === 'inserted') {
            metrics.itemsInserted += 1;
          } else if (action === 'updated') {
            metrics.itemsUpdated += 1;
          }

          if (srcUpdated) {
            if (!maxSeen || srcUpdated > maxSeen) {
              maxSeen = srcUpdated;
            }
          }
        }

        if (stopCounter >= etlConfig.stopThreshold) {
          this.logger.log('Incremental sync early stopped by watermark threshold');
          break;
        }

        await this.delay(etlConfig.requestDelayMs);
      }

      if (maxSeen && (!watermark || maxSeen > watermark)) {
        await this.setWatermark(maxSeen);
      }
    } catch (error) {
      const err = error as Error;
      metrics.status = 'failed';
      metrics.note = err.message;
      this.logger.error(`Incremental sync failed: ${err.message}`, err.stack);
    } finally {
      metrics.finishedAt = new Date();
      await this.finishRunRecord(metrics);
    }

    if (!triggeredByCron) {
      this.logger.log(
        `Incremental sync completed with status=${metrics.status} inserted=${metrics.itemsInserted} updated=${metrics.itemsUpdated}`,
      );
    }

    return metrics;
  }

  async runFullSync(triggeredByCron = false): Promise<SyncRunMetrics> {
    const run = await this.startRunRecord('full');
    const metrics: SyncRunMetrics = {
      id: run.id,
      startedAt: run.startedAt,
      pagesFetched: 0,
      itemsInserted: 0,
      itemsUpdated: 0,
      itemsDeactivated: 0,
      status: 'success',
    };

    const etlConfig = this.config.etl;
    const processedIds = new Set<string>();
    let completedFullScan = false;

    try {
      let page = 1;
      let lastPage = Number.MAX_SAFE_INTEGER;
      let hasMorePages = true;

      while (page <= lastPage && hasMorePages) {
        const result = await this.fetchVacancies(page, etlConfig.limit);
        if (!result.items.length) {
          hasMorePages = false;
          break;
        }

        metrics.pagesFetched += 1;

        const normalizedBatch = result.items
          .map((item) => this.normalizeVacancy(item))
          .filter((vacancy): vacancy is VacancyPayload => Boolean(vacancy));

        await this.processVacancyBatch(normalizedBatch, metrics, processedIds);

        const totalPages =
          result.pagination.last_page ?? result.pagination.total_page ?? lastPage;
        if (Number.isFinite(totalPages)) {
          lastPage = Number(totalPages);
        }

        const reachedLastPage = Number.isFinite(totalPages)
          ? page >= Number(totalPages)
          : result.items.length < etlConfig.limit;

        if (reachedLastPage) {
          hasMorePages = false;
          break;
        }

        page += 1;
        await this.delay(etlConfig.requestDelayMs);
      }

      completedFullScan = !hasMorePages || page > lastPage;

      if (completedFullScan) {
        await this.deactivateMissingVacancies(metrics, processedIds);

        const latestSeen = await this.prisma.internship.findFirst({
          select: { updated_at: true },
          orderBy: { updated_at: 'desc' },
        });
        if (latestSeen?.updated_at) {
          await this.setWatermark(latestSeen.updated_at);
        }
      } else {
        this.logger.warn(
          'Full sync ended before all pages were processed; skipping deactivation step',
        );
      }
    } catch (error) {
      const err = error as Error;
      metrics.status = 'failed';
      metrics.note = err.message;
      completedFullScan = false;
      this.logger.error(`Full sync failed: ${err.message}`, err.stack);
    } finally {
      metrics.finishedAt = new Date();
      await this.finishRunRecord(metrics);
    }

    if (!triggeredByCron) {
      this.logger.log(
        `Full sync completed with status=${metrics.status} inserted=${metrics.itemsInserted} updated=${metrics.itemsUpdated} deactivated=${metrics.itemsDeactivated}`,
      );
    }

    return metrics;
  }

  private registerCronJobs(): void {
    const cronJobs: Array<{ name: string; expression: string; handler: () => Promise<SyncRunMetrics> }> = [
      {
        name: 'incremental-sync',
        expression: this.config.etl.incrementalCron,
        handler: () => this.runIncrementalSync(true),
      },
      {
        name: 'full-sync',
        expression: this.config.etl.fullCron,
        handler: () => this.runFullSync(true),
      },
    ];

    for (const cronDef of cronJobs) {
      const job = new CronJob(
        cronDef.expression,
        () => {
          cronDef.handler().catch((error) => {
            const err = error as Error;
            this.logger.error(`Cron ${cronDef.name} failed: ${err.message}`, err.stack);
          });
        },
        undefined,
        false,
        this.config.timezone,
      );
      try {
        const existing = this.schedulerRegistry.getCronJob(cronDef.name);
        existing.stop();
        this.schedulerRegistry.deleteCronJob(cronDef.name);
      } catch (err) {
        // no-op when job is not registered yet
      }
      this.schedulerRegistry.addCronJob(cronDef.name, job);
      job.start();
    }
  }

  private async startRunRecord(label: string): Promise<{ id: string; startedAt: Date }> {
    const id = randomUUID();
    const startedAt = new Date();
    await this.prisma.syncRun.create({
      data: {
        id,
        started_at: startedAt,
        status: `running:${label}`,
        pages_fetched: 0,
        items_inserted: 0,
        items_updated: 0,
        items_deactivated: 0,
      },
    });
    return { id, startedAt };
  }

  private async finishRunRecord(metrics: SyncRunMetrics): Promise<void> {
    await this.prisma.syncRun.update({
      where: { id: metrics.id },
      data: {
        finished_at: metrics.finishedAt,
        status: metrics.status,
        note: metrics.note,
        pages_fetched: metrics.pagesFetched,
        items_inserted: metrics.itemsInserted,
        items_updated: metrics.itemsUpdated,
        items_deactivated: metrics.itemsDeactivated,
      },
    });
  }

  private async setWatermark(value: Date): Promise<void> {
    await this.prisma.syncState.upsert({
      where: { key: WATERMARK_KEY },
      update: { value },
      create: { key: WATERMARK_KEY, value },
    });
  }

  private async getWatermark(): Promise<Date | null> {
    const record = await this.prisma.syncState.findUnique({ where: { key: WATERMARK_KEY } });
    return record?.value ?? null;
  }

  private async fetchVacancies(page: number, limit: number): Promise<VacancyFetchResult> {
    const response = await firstValueFrom(
      this.httpService.get('/list/vacancies-aktif', {
        params: {
          order_direction: 'DESC',
          page,
          limit,
        },
      }),
    );

    return {
      items: this.extractArray(response.data),
      pagination: this.extractPagination(response.data),
    };
  }

  private extractArray(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.data && payload.data !== payload) {
      return this.extractArray(payload.data);
    }
    if (payload.results && payload.results !== payload) {
      return this.extractArray(payload.results);
    }
    if (payload.items && Array.isArray(payload.items)) {
      return payload.items;
    }
    return [];
  }

  private extractPagination(payload: any): VacancyResponseMeta {
    if (!payload) return {};
    if (payload.pagination) return payload.pagination;
    if (payload.meta?.pagination) return payload.meta.pagination;
    if (payload.data && payload.data !== payload) {
      return this.extractPagination(payload.data);
    }
    return {};
  }

  private normalizeVacancy(row: any): VacancyPayload | null {
    const parseIntValue = (value: any): number | null => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const programStudi = this.parseArrayJsonString(row?.program_studi);
    const jenjang = this.parseArrayJsonString(row?.jenjang);
    const perusahaan = row?.perusahaan ?? {};
    const jadwal = row?.jadwal ?? {};
    const governmentAgency = row?.government_agency ?? {};
    const subAgency = row?.sub_government_agency ?? {};

    const kodeProvinsi =
      row?.kode_propinsi ??
      row?.kode_provinsi ??
      perusahaan?.kode_propinsi ??
      perusahaan?.kode_provinsi ??
      null;

    const namaProvinsi =
      row?.nama_propinsi ??
      row?.nama_provinsi ??
      perusahaan?.nama_propinsi ??
      perusahaan?.nama_provinsi ??
      null;

    const kodeKabupaten = row?.kode_kabupaten ?? perusahaan?.kode_kabupaten ?? null;
    const namaKabupaten = row?.nama_kabupaten ?? perusahaan?.nama_kabupaten ?? null;

    const pickDate = (
      ...values: Array<string | Date | null | undefined>
    ): Date | null => {
      for (const value of values) {
        const parsed = this.toJakartaDate(value);
        if (parsed) {
          return parsed;
        }
      }
      return null;
    };

    const id = row?.id_posisi ?? row?.id;
    if (!id) {
      return null;
    }

    return {
      id_posisi: String(id),
      posisi: row?.posisi ?? row?.judul ?? null,
      deskripsi_posisi: row?.deskripsi_posisi ?? row?.deskripsi ?? null,
      jumlah_kuota: parseIntValue(row?.jumlah_kuota),
      jumlah_terdaftar: parseIntValue(row?.jumlah_terdaftar),
      program_studi: programStudi,
      jenjang,
      nama_perusahaan: row?.nama_perusahaan ?? perusahaan?.nama_perusahaan ?? null,
      kode_provinsi: kodeProvinsi,
      nama_provinsi: namaProvinsi,
      kode_kabupaten: kodeKabupaten,
      nama_kabupaten: namaKabupaten,
      pendaftaran_awal: pickDate(
        row?.pendaftaran_awal,
        row?.tanggal_pendaftaran_awal,
        jadwal?.tanggal_pendaftaran_awal,
        jadwal?.tanggal_mulai,
        jadwal?.tanggal_rencana_mulai,
      ),
      pendaftaran_akhir: pickDate(
        row?.pendaftaran_akhir,
        row?.tanggal_pendaftaran_akhir,
        jadwal?.tanggal_pendaftaran_akhir,
        jadwal?.tanggal_pengumuman_akhir,
      ),
      mulai: pickDate(row?.mulai, jadwal?.tanggal_mulai, jadwal?.tanggal_rencana_mulai),
      selesai: pickDate(row?.selesai, jadwal?.tanggal_selesai, jadwal?.tanggal_rencana_akhir),
      agency:
        row?.agency ??
        governmentAgency?.government_agency_name ??
        row?.government_agency_name ??
        null,
      sub_agency:
        row?.sub_agency ??
        subAgency?.sub_government_agency_name ??
        row?.sub_government_agency_name ??
        null,
      created_at: this.toJakartaDate(row?.created_at),
      updated_at: this.toJakartaDate(row?.updated_at),
      source_raw: row ? (row as Prisma.InputJsonValue) : Prisma.JsonNull,
    };
  }

  private parseArrayJsonString(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((entry) => this.stringifyEntry(entry)).filter(Boolean) as string[];
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((entry) => this.stringifyEntry(entry)).filter(Boolean) as string[];
        }
        if (typeof parsed === 'string') {
          return [parsed];
        }
      } catch (err) {
        return trimmed
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
      }
    }

    return [];
  }

  private stringifyEntry(entry: any): string | null {
    if (!entry && entry !== 0) return null;
    if (typeof entry === 'string') return entry.trim();
    if (typeof entry === 'object' && 'nama' in entry) {
      return String(entry.nama);
    }
    if (typeof entry === 'object' && 'program_studi' in entry) {
      return String(entry.program_studi);
    }
    if (typeof entry === 'object' && 'title' in entry) {
      return String(entry.title);
    }
    return String(entry);
  }

  private toJakartaDate(input: string | Date | null | undefined): Date | null {
    if (!input) return null;
    if (input instanceof Date) return input;
    const normalized = String(input).replace(' ', 'T');
    const value = normalized.endsWith('Z') ? normalized : `${normalized}+07:00`;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private async saveVacancy(vacancy: VacancyPayload): Promise<'inserted' | 'updated'> {
    const now = new Date();
    try {
      await this.prisma.internship.create({
        data: {
          id_posisi: vacancy.id_posisi,
          posisi: vacancy.posisi,
          deskripsi_posisi: vacancy.deskripsi_posisi,
          jumlah_kuota: vacancy.jumlah_kuota,
          jumlah_terdaftar: vacancy.jumlah_terdaftar,
          program_studi: vacancy.program_studi,
          jenjang: vacancy.jenjang,
          nama_perusahaan: vacancy.nama_perusahaan,
          kode_provinsi: vacancy.kode_provinsi,
          nama_provinsi: vacancy.nama_provinsi,
          kode_kabupaten: vacancy.kode_kabupaten,
          nama_kabupaten: vacancy.nama_kabupaten,
          pendaftaran_awal: vacancy.pendaftaran_awal,
          pendaftaran_akhir: vacancy.pendaftaran_akhir,
          mulai: vacancy.mulai,
          selesai: vacancy.selesai,
          agency: vacancy.agency,
          sub_agency: vacancy.sub_agency,
          created_at: vacancy.created_at,
          updated_at: vacancy.updated_at,
          source_raw: vacancy.source_raw ?? Prisma.JsonNull,
          first_seen_at: now,
          last_synced_at: now,
          is_active: true,
        },
      });
      await this.prisma.newInternshipEvent.create({
        data: {
          id_posisi: vacancy.id_posisi,
          seen_at: now,
        },
      });
      return 'inserted';
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        await this.prisma.internship.update({
          where: { id_posisi: vacancy.id_posisi },
          data: {
            posisi: vacancy.posisi,
            deskripsi_posisi: vacancy.deskripsi_posisi,
            jumlah_kuota: vacancy.jumlah_kuota,
            jumlah_terdaftar: vacancy.jumlah_terdaftar,
            program_studi: vacancy.program_studi,
            jenjang: vacancy.jenjang,
            nama_perusahaan: vacancy.nama_perusahaan,
            kode_provinsi: vacancy.kode_provinsi,
            nama_provinsi: vacancy.nama_provinsi,
            kode_kabupaten: vacancy.kode_kabupaten,
            nama_kabupaten: vacancy.nama_kabupaten,
            pendaftaran_awal: vacancy.pendaftaran_awal,
            pendaftaran_akhir: vacancy.pendaftaran_akhir,
            mulai: vacancy.mulai,
            selesai: vacancy.selesai,
            agency: vacancy.agency,
            sub_agency: vacancy.sub_agency,
            created_at: vacancy.created_at,
            updated_at: vacancy.updated_at,
            source_raw: vacancy.source_raw ?? Prisma.JsonNull,
            last_synced_at: now,
            is_active: true,
          },
        });
        return 'updated';
      }
      throw error;
    }
  }

  private async processVacancyBatch(
    vacancies: VacancyPayload[],
    metrics: SyncRunMetrics,
    processedIds: Set<string>,
  ): Promise<void> {
    if (!vacancies.length) {
      return;
    }

    for (const chunk of this.chunkArray(vacancies, this.batchSaveConcurrency)) {
      await Promise.all(
        chunk.map(async (vacancy) => {
          const action = await this.saveVacancy(vacancy);
          processedIds.add(vacancy.id_posisi);
          if (action === 'inserted') {
            metrics.itemsInserted += 1;
          } else {
            metrics.itemsUpdated += 1;
          }
        }),
      );
    }
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    if (size <= 0) {
      return [items];
    }
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  private async deactivateMissingVacancies(
    metrics: SyncRunMetrics,
    processedIds: Set<string>,
  ): Promise<void> {
    const now = new Date();
    const whereCondition: Prisma.InternshipWhereInput = {
      last_synced_at: { lt: metrics.startedAt },
    };

    if (processedIds.size > 0) {
      whereCondition.id_posisi = { notIn: Array.from(processedIds) };
    }

    const deactivated = await this.prisma.internship.updateMany({
      where: whereCondition,
      data: { is_active: false, last_synced_at: now },
    });
    metrics.itemsDeactivated = deactivated.count;
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
