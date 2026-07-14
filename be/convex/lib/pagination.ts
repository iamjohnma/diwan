import type { PaginationOptions } from 'convex/server';

export const MAX_PAGE_SIZE = 100;

const MAX_ROWS_READ = 500;
const MAX_BYTES_READ = 4 * 1024 * 1024;

/**
 * Keeps every client-controlled pagination request inside one predictable
 * server budget while preserving Convex's reactive pagination fields.
 */
export function boundedPagination(options: PaginationOptions): PaginationOptions {
  const requested = Number.isFinite(options.numItems) ? Math.floor(options.numItems) : 1;

  return {
    ...options,
    numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, requested)),
    maximumRowsRead: MAX_ROWS_READ,
    maximumBytesRead: MAX_BYTES_READ,
  };
}
