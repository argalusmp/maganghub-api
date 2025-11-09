import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FacetsService {
  constructor(private readonly prisma: PrismaService) {}

  getProvinces() {
    return this.prisma.province.findMany({
      orderBy: { nama_propinsi: 'asc' },
    });
  }

  getKabupaten(kodeProvinsi: string) {
    return this.prisma.$queryRaw<{ nama_kabupaten: string }[]>`
      SELECT DISTINCT nama_kabupaten
      FROM public.internships
      WHERE kode_provinsi = ${kodeProvinsi} AND nama_kabupaten IS NOT NULL
      ORDER BY 1
    `;
  }
}
