import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { HttpError } from './errorHandler';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new HttpError(400, 'Invalid request data.', result.error.flatten());
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      throw new HttpError(400, 'Invalid query parameters.', result.error.flatten());
    }
    req.query = result.data as never;
    next();
  };
}
