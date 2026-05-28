import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';

import authRoutes from './routes/auth';
import choresRoutes from './routes/chores';
import mealsRoutes from './routes/meals';
import eventsRoutes from './routes/events';
import rewardsRoutes from './routes/rewards';
import chatRoutes from './routes/chat';
import notificationsRoutes from './routes/notifications';
import reportRoutes from './routes/report';
import aiRoutes from './routes/ai';
import membersRoutes from './routes/members';
import questsRoutes from './routes/quests';
import uploadRoutes from './routes/upload';
import groceryRoutes from './routes/grocery';
import { startStreakCron } from './services/streaks';
import { setupWebSocket } from './services/websocket';
import { setupCron } from './services/cron';
import rulesRoutes from './routes/rules';
import { startWeeklyRulesCron } from './services/weeklyRulesCron';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'https://family-hub-web-omega.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.options('*', cors({ origin: allowedOrigins, credentials: true }));

// ── Security headers ──────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── Global rate limit: 200 req / 15 min per IP ────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use(globalLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/chores',        authMiddleware, choresRoutes);
app.use('/api/meals',         authMiddleware, mealsRoutes);
app.use('/api/events',        authMiddleware, eventsRoutes);
app.use('/api/rewards',       authMiddleware, rewardsRoutes);
app.use('/api/chat',          authMiddleware, chatRoutes);
app.use('/api/notifications', authMiddleware, notificationsRoutes);
app.use('/api/report',        authMiddleware, reportRoutes);
app.use('/api/ai',            authMiddleware, aiRoutes);
app.use('/api/members',       authMiddleware, membersRoutes);
app.use('/api/quests',        authMiddleware, questsRoutes);
app.use('/api/upload',        authMiddleware, uploadRoutes);
app.use('/api/grocery',       authMiddleware, groceryRoutes);
app.use('/api/rules', authMiddleware, rulesRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
startStreakCron();
setupWebSocket(wss);
setupCron();
startWeeklyRulesCron();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Family Hub API running on port ' + PORT));