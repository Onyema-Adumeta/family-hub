import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  memberId?: string;
  familyId?: string;
  role?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.memberId = payload.memberId;
    req.familyId = payload.familyId;
    req.role = payload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
