import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

type SortOption = 'terbaru' | 'deadline_asc' | 'kuota_desc' | 'peminat_desc';
type StatusOption = 'open' | 'closed' | 'all';

const toCsvArray = (value?: string | string[]): string[] | undefined => {
  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return undefined;
};

const toBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
    if (['false', '0', 'no'].includes(value.toLowerCase())) return false;
  }
  return fallback;
};

export class SearchVacanciesDto {
  @ApiPropertyOptional({
    description: 'Full-text search across posisi/deskripsi (Indonesian dictionary)',
    example: 'UI Designer',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Exact province code (matches /facets/provinces kode_propinsi)',
    example: '31',
  })
  @IsOptional()
  @IsString()
  kode_provinsi?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive kabupaten name filter, partial match allowed',
    example: 'Jakarta Selatan',
  })
  @IsOptional()
  @IsString()
  kabupaten?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated jenjang list (e.g. SMA,S1)',
    type: String,
    example: 'SMA,S1',
  })
  @IsOptional()
  @Transform(({ value }) => toCsvArray(value))
  jenjang?: string[];

  @ApiPropertyOptional({
    description: 'Comma-separated program studi list',
    type: String,
    example: 'Teknik Informatika,Desain Komunikasi Visual',
  })
  @IsOptional()
  @Transform(({ value }) => toCsvArray(value))
  prodi?: string[];

  @ApiPropertyOptional({
    description: 'Filter by status; defaults to all',
    enum: ['open', 'closed', 'all'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['open', 'closed', 'all'])
  status?: StatusOption;

  @ApiPropertyOptional({
    description: 'Limit to postings first seen within NEW_WINDOW_HOURS',
    type: Boolean,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value, false))
  only_new?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['terbaru', 'deadline_asc', 'kuota_desc', 'peminat_desc'],
    default: 'terbaru',
  })
  @IsOptional()
  @IsIn(['terbaru', 'deadline_asc', 'kuota_desc', 'peminat_desc'])
  sort?: SortOption;

  @ApiPropertyOptional({
    description: 'Pagination page (1-based)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    description: 'Items per page (1-100)',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
