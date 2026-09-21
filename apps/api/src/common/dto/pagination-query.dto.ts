import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { PaginationMeta } from '@sickdoc/shared';

/** Shared list-query DTO: 1-based page, max 100 per page (API_SPEC §1). */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export function toPagination(query: PaginationQueryDto): PaginationParams {
  return { page: query.page ?? 1, pageSize: query.pageSize ?? 20 };
}

export function pageMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function skipOf(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
