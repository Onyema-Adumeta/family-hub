import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
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

import { setupWebSocket } from './services/websocket';
import { setupCron } from './services/cron';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const allowedOrigins = [
  'http://localhost:5173',
  'https://family-hub-web-omega.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
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

app.get('/health', (_req, res) => res.json({ ok: true }));

setupWebSocket(wss);
setupCron();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Family Hub API running on port ${PORT}`));