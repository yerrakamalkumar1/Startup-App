import type { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function asyncHandler<TReq extends Request = Request>(
  fn: (req: TReq, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: TReq, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error: Error & { statusCode?: number }, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = error.statusCode || 500;
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && process.env.NODE_ENV === "production" ? "Internal server error." : error.message,
    ...(process.env.NODE_ENV !== "production" ? { stack: error.stack } : {})
  });
}
