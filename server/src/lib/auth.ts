import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getEnv } from '../config/env.js';
import { AppError } from './errors.js';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

export function signToken(payload: AuthPayload): string {
  const env = getEnv();
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthPayload {
  const env = getEnv();
  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    throw new AppError(401, 'AUTH_TOKEN_INVALID', 'Authentication token is invalid or expired');
  }
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
  }
  const token = header.slice(7);
  const payload = verifyToken(token);
  req.user = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
    }
    next();
  };
}
