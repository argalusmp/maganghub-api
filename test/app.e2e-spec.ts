import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FacetsService } from '../src/facets/facets.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SyncService } from '../src/sync/sync.service';
import { VacanciesService } from '../src/vacancies/vacancies.service';

describe('HTTP API (e2e)', () => {
  let app: INestApplication;

  const mockVacancy = {
    id_posisi: 'a04beb4b-e919-4fff-aa6a-4488308059be',
    posisi: 'Penyuluh KB',
    nama_perusahaan: 'BKKBN',
  };

  const mockVacanciesService = {
    search: jest.fn(),
    findById: jest.fn(),
  };

  const mockFacetsService = {
    getProvinces: jest.fn().mockResolvedValue([{ kode_propinsi: '35', nama_propinsi: 'Jawa Timur' }]),
    getKabupaten: jest.fn(),
  };

  const mockSyncService = {
    syncProvinces: jest.fn(),
    runIncrementalSync: jest.fn(),
    runFullSync: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .overrideProvider(VacanciesService)
      .useValue(mockVacanciesService)
      .overrideProvider(FacetsService)
      .useValue(mockFacetsService)
      .overrideProvider(SyncService)
      .useValue(mockSyncService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /search returns paginated results', async () => {
    mockVacanciesService.search.mockResolvedValueOnce({
      meta: { page: 1, limit: 20, total: 1 },
      data: [mockVacancy],
    });

    const response = await request(app.getHttpServer()).get('/search').expect(200);

    expect(response.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(response.body.data).toHaveLength(1);
    expect(mockVacanciesService.search).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('GET /search forwards filters correctly', async () => {
    mockVacanciesService.search.mockImplementationOnce(async (dto) => {
      expect(dto.q).toBe('KB');
      expect(dto.kode_provinsi).toBe('35');
      expect(dto.only_new).toBe(true);
      expect(dto.jenjang).toEqual(['D3', 'S1']);
      return { meta: { page: 1, limit: 20, total: 0 }, data: [] };
    });

    await request(app.getHttpServer())
      .get('/search?q=KB&kode_provinsi=35&only_new=true&jenjang=D3,S1')
      .expect(200);
  });

  it('GET /facets/provinces returns cached provinces', async () => {
    const res = await request(app.getHttpServer()).get('/facets/provinces').expect(200);
    expect(res.body).toEqual([{ kode_propinsi: '35', nama_propinsi: 'Jawa Timur' }]);
    expect(mockFacetsService.getProvinces).toHaveBeenCalled();
  });

  it('GET /vacancies/:id returns a single vacancy', async () => {
    mockVacanciesService.findById.mockResolvedValueOnce(mockVacancy);

    const res = await request(app.getHttpServer())
      .get(`/vacancies/${mockVacancy.id_posisi}`)
      .expect(200);

    expect(res.body).toEqual(mockVacancy);
    expect(mockVacanciesService.findById).toHaveBeenCalledWith(mockVacancy.id_posisi);
  });
});
