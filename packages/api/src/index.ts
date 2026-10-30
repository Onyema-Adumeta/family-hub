import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';
import gamesRouter from './routes/games';
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
import triviaRoutes from './routes/trivia';
import wishlistRouter from './routes/wishlist';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { prisma } from './db';
import tripsRoutes from './routes/trips';
import familyRoutes from './routes/family';
import insightsRoutes from './routes/insights';
import goalsRoutes from './routes/goals';
import bankRoutes from './routes/bank';
import eventImportRoutes, { extractHandler } from './routes/eventImport';
import { encryptSecret, encryptionConfigured } from './services/secretBox';

const app = express();
app.set('trust proxy', 1);
const server = createServer(app);
const wss = new WebSocketServer({ server });

// â”€â”€ CORS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://family-hub-web-omega.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.options('*', cors({ origin: allowedOrigins, credentials: true }));

// â”€â”€ Security headers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// â”€â”€ Global rate limit: 500 req / 15 min per IP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // RATE_LIMIT_MULTIPLIER is only for the automated test suite; leave unset in production.
  max: 500 * Number(process.env.RATE_LIMIT_MULTIPLIER || 1),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use(globalLimiter);

// â”€â”€ Body parsing (50kb max â€” uploads go via Cloudinary) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Flyer photos need a bigger body than everything else, so this one route is
// registered before the normal 50 kB JSON limit.
app.post('/api/events/extract', ...extractHandler);
app.use(express.json({ limit: '50kb' }));

// â”€â”€ Google Calendar OAuth callback â€” no auth required â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/events/google/callback', async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state || !process.env.JWT_SECRET) return res.status(400).json({ error: 'Invalid OAuth request' });
  let familyId: string;
  try {
    const payload = jwt.verify(state, process.env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (payload.purpose !== 'google-calendar-oauth' || typeof payload.familyId !== 'string') throw new Error('Invalid OAuth state');
    familyId = payload.familyId;
  } catch { return res.status(400).json({ error: 'Invalid or expired OAuth state' }); }
  if (!encryptionConfigured()) {
    console.error('Google OAuth callback: TOKEN_ENCRYPTION_KEY is not set; refusing to store tokens unencrypted');
    return res.status(500).json({ error: 'Google Calendar is not configured on the server yet' });
  }
  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    const { tokens } = await auth.getToken(code);
    await (prisma.family.update as any)({
      where: { id: familyId },
      data: { googleTokens: encryptSecret(JSON.stringify(tokens)) },
    });
    res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/schedule?connected=1');
  } catch (e: any) {
    console.error('Google OAuth callback error:', e);
    res.status(500).json({ error: 'Could not connect Google Calendar' });
  }
});

// â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/api/auth',          authRoutes);
app.use('/api/chores',        authMiddleware, choresRoutes);
app.use('/api/meals',         authMiddleware, mealsRoutes);
app.use('/api/events',        authMiddleware, eventImportRoutes);
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
app.use('/api/rules',         authMiddleware, rulesRoutes);
app.use('/api/trivia',        authMiddleware, triviaRoutes);
app.use('/api/wishlist',      authMiddleware, wishlistRouter);
app.use('/api/games',         authMiddleware, gamesRouter);
app.use('/api/trips',         authMiddleware, tripsRoutes);
app.use('/api/family',        authMiddleware, familyRoutes);
app.use('/api/insights',      authMiddleware, insightsRoutes);
app.use('/api/goals',         authMiddleware, goalsRoutes);
app.use('/api/bank',          authMiddleware, bankRoutes);

// â”€â”€ Health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/health', (_req, res) => res.json({ ok: true }));
// Deeper check for uptime monitors (e.g. UptimeRobot): fails if the database is unreachable.
app.get('/health/ready', async (_req, res) => {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'ok', dbMs: Date.now() - started, uptimeSec: Math.round(process.uptime()) });
  } catch (e) {
    console.error('[health] database check failed', e);
    res.status(503).json({ ok: false, db: 'unreachable' });
  }
});

// â”€â”€ 404 handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// â”€â”€ Global error handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// â”€â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Log crashes clearly so they show up in Railway's logs and alerts.
process.on('unhandledRejection', (reason) => console.error('[fatal] unhandled promise rejection', reason));
process.on('uncaughtException', (err) => { console.error('[fatal] uncaught exception', err); process.exit(1); });

startStreakCron();
setupWebSocket(wss);
setupCron();
startWeeklyRulesCron();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Kinroost API running on port ' + PORT));
