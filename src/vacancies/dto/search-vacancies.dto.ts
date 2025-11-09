import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

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
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  kode_provinsi?: string;

  @IsOptional()
  @IsString()
  kabupaten?: string;

  @IsOptional()
  @Transform(({ value }) => toCsvArray(value))
  jenjang?: string[];

  @IsOptional()
  @Transform(({ value }) => toCsvArray(value))
  prodi?: string[];

  @IsOptional()
  @IsIn(['open', 'closed', 'all'])
  status?: StatusOption;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value, false))
  only_new?: boolean;

  @IsOptional()
  @IsIn(['terbaru', 'deadline_asc', 'kuota_desc', 'peminat_desc'])
  sort?: SortOption;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
