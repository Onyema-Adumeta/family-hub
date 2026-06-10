"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const ws_1 = require("ws");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("./middleware/auth");
const auth_2 = __importDefault(require("./routes/auth"));
const chores_1 = __importDefault(require("./routes/chores"));
const meals_1 = __importDefault(require("./routes/meals"));
const events_1 = __importDefault(require("./routes/events"));
const rewards_1 = __importDefault(require("./routes/rewards"));
const chat_1 = __importDefault(require("./routes/chat"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const report_1 = __importDefault(require("./routes/report"));
const ai_1 = __importDefault(require("./routes/ai"));
const members_1 = __importDefault(require("./routes/members"));
const quests_1 = __importDefault(require("./routes/quests"));
const upload_1 = __importDefault(require("./routes/upload"));
const grocery_1 = __importDefault(require("./routes/grocery"));
const streaks_1 = require("./services/streaks");
const websocket_1 = require("./services/websocket");
const cron_1 = require("./services/cron");
const rules_1 = __importDefault(require("./routes/rules"));
const weeklyRulesCron_1 = require("./services/weeklyRulesCron");
const trivia_1 = __importDefault(require("./routes/trivia"));
const wishlist_1 = __importDefault(require("./routes/wishlist"));
const googleapis_1 = require("googleapis");
const db_1 = require("./db");
const app = (0, express_1.default)();
app.set('trust proxy', 1);
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:5173',
    'https://family-hub-web-omega.vercel.app',
    process.env.CLIENT_URL,
].filter(Boolean);
app.use((0, cors_1.default)({ origin: allowedOrigins, credentials: true }));
app.options('*', (0, cors_1.default)({ origin: allowedOrigins, credentials: true }));
// ── Security headers ──────────────────────────────────────────────────────────
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
// ── Global rate limit: 500 req / 15 min per IP ───────────────────────────────
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
});
app.use(globalLimiter);
// ── Body parsing (50kb max — uploads go via Cloudinary) ──────────────────────
app.use(express_1.default.json({ limit: '50kb' }));
// ── Google Calendar OAuth callback — no auth required ────────────────────────
app.get('/api/events/google/callback', async (req, res) => {
    const { code, state: familyId } = req.query;
    try {
        const auth = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
        const { tokens } = await auth.getToken(code);
        await db_1.prisma.family.update({
            where: { id: familyId },
            data: { googleTokens: JSON.stringify(tokens) },
        });
        res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/schedule?connected=1');
    }
    catch (e) {
        console.error('Google OAuth callback error:', e);
        res.status(500).json({ error: e.message });
    }
});
// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', auth_2.default);
app.use('/api/chores', auth_1.authMiddleware, chores_1.default);
app.use('/api/meals', auth_1.authMiddleware, meals_1.default);
app.use('/api/events', auth_1.authMiddleware, events_1.default);
app.use('/api/rewards', auth_1.authMiddleware, rewards_1.default);
app.use('/api/chat', auth_1.authMiddleware, chat_1.default);
app.use('/api/notifications', auth_1.authMiddleware, notifications_1.default);
app.use('/api/report', auth_1.authMiddleware, report_1.default);
app.use('/api/ai', auth_1.authMiddleware, ai_1.default);
app.use('/api/members', auth_1.authMiddleware, members_1.default);
app.use('/api/quests', auth_1.authMiddleware, quests_1.default);
app.use('/api/upload', auth_1.authMiddleware, upload_1.default);
app.use('/api/grocery', auth_1.authMiddleware, grocery_1.default);
app.use('/api/rules', auth_1.authMiddleware, rules_1.default);
app.use('/api/trivia', auth_1.authMiddleware, trivia_1.default);
app.use('/api/wishlist', auth_1.authMiddleware, wishlist_1.default);
// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));
// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// ── Start ─────────────────────────────────────────────────────────────────────
(0, streaks_1.startStreakCron)();
(0, websocket_1.setupWebSocket)(wss);
(0, cron_1.setupCron)();
(0, weeklyRulesCron_1.startWeeklyRulesCron)();
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Family Hub API running on port ' + PORT));
//# sourceMappingURL=index.js.map