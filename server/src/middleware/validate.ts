import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';

export function validate(schema: ZodTypeAny, source: 'body' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(source === 'body' ? req.body : req.query);
      if (source === 'body') req.body = parsed;
      else (req as Request & { query: unknown }).query = parsed;
      next();
    } catch (err) {
      next(err instanceof ZodError ? err : new Error('Validation failed'));
    }
  };
}
