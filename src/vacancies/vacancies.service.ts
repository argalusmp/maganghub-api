import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchVacanciesDto } from './dto/search-vacancies.dto';

type SortOption = 'terbaru' | 'deadline_asc' | 'kuota_desc' | 'peminat_desc';

type SearchResult = {
  meta: {
    page: number;
    limit: number;
    total: number;
  };
  data: any[];
};

const VACANCY_SELECT = Prisma.sql`
  id_posisi,
  posisi,
  deskripsi_posisi,
  jumlah_kuota,
  jumlah_terdaftar,
  program_studi,
  jenjang,
  nama_perusahaan,
  kode_provinsi,
  nama_provinsi,
  kode_kabupaten,
  nama_kabupaten,
  pendaftaran_awal,
  pendaftaran_akhir,
  mulai,
  selesai,
  agency,
  sub_agency,
  created_at,
  updated_at,
  source_raw,
  first_seen_at,
  last_synced_at,
  is_active,
  url_original
`;

@Injectable()
export class VacanciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async search(dto: SearchVacanciesDto): Promise<SearchResult> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    const filters: Prisma.Sql[] = [Prisma.sql`is_active = true`];

    if (dto.q) {
      filters.push(Prisma.sql`tsv @@ plainto_tsquery('indonesian', ${dto.q})`);
    }
    if (dto.kode_provinsi) {
      filters.push(Prisma.sql`kode_provinsi = ${dto.kode_provinsi}`);
    }
    if (dto.kabupaten) {
      filters.push(Prisma.sql`nama_kabupaten ILIKE ${`%${dto.kabupaten}%`}`);
    }
    if (dto.jenjang?.length) {
      filters.push(Prisma.sql`jenjang && ${this.toTextArray(dto.jenjang)}`);
    }
    if (dto.prodi?.length) {
      filters.push(Prisma.sql`program_studi && ${this.toTextArray(dto.prodi)}`);
    }
    if (dto.status === 'open') {
      filters.push(Prisma.sql`(pendaftaran_akhir IS NULL OR pendaftaran_akhir >= NOW())`);
    } else if (dto.status === 'closed') {
      filters.push(Prisma.sql`(pendaftaran_akhir IS NOT NULL AND pendaftaran_akhir < NOW())`);
    }
    if (dto.only_new) {
      const hours = this.config.etl.newWindowHours;
      filters.push(Prisma.sql`first_seen_at >= NOW() - (${hours} * INTERVAL '1 hour')`);
    }

    const whereSql = Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`;
    const orderSql = this.orderClause(dto.sort);

    const totalResult = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM public.internships
      ${whereSql}
    `);

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT ${VACANCY_SELECT}
      FROM public.internships
      ${whereSql}
      ${orderSql}
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const total = totalResult[0]?.count ? Number(totalResult[0].count) : 0;

    return {
      meta: { page, limit, total },
      data: rows,
    };
  }

  async findById(id: string) {
    const vacancy = await this.prisma.internship.findUnique({ where: { id_posisi: id } });
    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }
    return vacancy;
  }

  private orderClause(sort?: SortOption): Prisma.Sql {
    switch (sort) {
      case 'deadline_asc':
        return Prisma.sql`ORDER BY pendaftaran_akhir ASC NULLS LAST`;
      case 'kuota_desc':
        return Prisma.sql`ORDER BY jumlah_kuota DESC NULLS LAST`;
      case 'peminat_desc':
        return Prisma.sql`ORDER BY jumlah_terdaftar DESC NULLS LAST`;
      default:
        return Prisma.sql`ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST`;
    }
  }

  private toTextArray(values: string[]): Prisma.Sql {
    const sanitized = values.map((value) => value.trim()).filter(Boolean);
    if (!sanitized.length) {
      return Prisma.sql`ARRAY[]::text[]`;
    }
    const joined = Prisma.join(sanitized.map((value) => Prisma.sql`${value}`), ', ');
    return Prisma.sql`ARRAY[${joined}]::text[]`;
  }
}
