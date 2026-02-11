import type { VercelResponse } from '@vercel/node';
import type { ApiError } from './types.js';

export function sendSuccess<T>(res: VercelResponse, data: T, statusCode = 200): void {
  res.status(statusCode).json(data);
}

export function sendError(
  res: VercelResponse,
  statusCode: number,
  error: string,
  message: string,
): void {
  const body: ApiError = { error, message, statusCode };
  res.status(statusCode).json(body);
}

export function sendBadRequest(res: VercelResponse, message: string): void {
  sendError(res, 400, 'BAD_REQUEST', message);
}

export function sendNotFound(res: VercelResponse, message: string): void {
  sendError(res, 404, 'NOT_FOUND', message);
}

export function sendInternalError(res: VercelResponse, message = 'Internal server error'): void {
  sendError(res, 500, 'INTERNAL_ERROR', message);
}
