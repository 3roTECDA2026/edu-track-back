import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 does not catch errors thrown in async handlers.
// This wrapper forwards them to the error middleware.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
