export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export function success<T>(data: T, meta?: Record<string, unknown>): ApiSuccess<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function paginateMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / Math.max(1, limit)),
    hasMore: page * limit < total,
  };
}
