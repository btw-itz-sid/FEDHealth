import { BadRequestException } from '@nestjs/common';

export function pagination(options: { page?: number; limit?: number }, defaultLimit = 20) {
  const page = options.page === undefined ? 1 : Number(options.page);
  const limit = options.limit === undefined ? defaultLimit : Number(options.limit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestException('page must be an integer from 1 to 1000000; limit must be an integer from 1 to 100');
  }
  return { page, limit };
}

export function enumFilter(value: unknown, allowed: Record<string, string>, name: string) {
  if (value !== undefined && !Object.values(allowed).includes(value as string)) {
    throw new BadRequestException(`Invalid ${name} filter`);
  }
}
