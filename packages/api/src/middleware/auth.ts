import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

export interface AuthRequest extends Request {
  memberId?: string;
  familyId?: string;
  role?: string;
}

// Verifies the JWT, then re-reads the member so that removed members are
// locked out and role changes (parent <-> child) take effect immediately,
// instead of whatever role was baked into a 30-day token.
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  let payload: any;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  try {
    const member = await prisma.member.findUnique({
      where: { id: String(payload.memberId || '') },
      select: { id: true, familyId: true, role: true, tokenVersion: true },
    });
    if (!member || member.familyId !== payload.familyId) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    // Signed out remotely (password change, "sign out everywhere", parent action).
    if ((payload.tv ?? 0) !== member.tokenVersion) {
      return res.status(401).json({ error: 'Signed out. Please sign in again.' });
    }
    req.memberId = member.id;
    req.familyId = member.familyId;
    req.role = member.role;
    next();
  } catch (e) {
    next(e);
  }
}
