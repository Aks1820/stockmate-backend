import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);

  if (!auth.userId) {
    res.status(401).json({
      message: "Authentication required",
      reason: req.headers.authorization?.startsWith("Bearer ")
        ? "Clerk rejected the bearer token"
        : "Bearer token missing",
    });
    return;
  }

  res.locals.userId = auth.userId;
  next();
}