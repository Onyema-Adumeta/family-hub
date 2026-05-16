# 🏠 Family Hub

A full-stack family management app with chores, meals, schedules, rewards, real-time chat, and AI-powered weekly reports.

**Stack:** Node/Express API · PostgreSQL/Prisma · React+Vite (PWA) · React Native/Expo (iOS & Android)

---

## 🚀 Quick Start

### 1. Install
```bash
pnpm install
```

### 2. Configure the API
```bash
cp packages/api/.env.example packages/api/.env
# Edit packages/api/.env — fill in DATABASE_URL and JWT_SECRET
```

### 3. Set up the database
```bash
pnpm db:migrate
```

### 4. Run everything
```bash
# Terminal 1
pnpm dev:api        # → http://localhost:3001

# Terminal 2
pnpm dev:web        # → http://localhost:5173

# Terminal 3 (optional)
pnpm dev:mobile     # → scan QR with Expo Go
```

---

## 🌐 Web Pages

| Route | Description |
|-------|-------------|
| `/login` | Sign in |
| `/register` | Create new family |
| `/join` | Join with invite code |
| `/` | Dashboard |
| `/chores` | Chore management with 📸 photo/video proof |
| `/meals` | Weekly meal planner |
| `/schedule` | Family calendar |
| `/rewards` | Star shop + leaderboard |
| `/chat` | Real-time family chat with media sharing |
| `/quests` | Family challenges |
| `/report` | AI-powered weekly report |
| `/settings` | Profile + invite code |

---

## 📱 Mobile Screens

- Login / Register / Join
- Home dashboard
- Chores with camera proof capture
- Weekly meals
- Star shop
- Family chat with photo/video

---

## 🔗 How Sharing Works

1. A parent registers → family is created with a unique **invite code** (e.g. `FAM-X7K2`)
2. Share the code with family members
3. Everyone joins at `/join` or the mobile Join screen
4. All data is shared in real-time via WebSocket

---

## 🌍 Deploy

### API (Railway)
1. Push to GitHub
2. Connect to [Railway](https://railway.app) — it auto-deploys
3. Add your env vars in Railway dashboard
4. Set `CLIENT_URL` to your Vercel web URL

### Web (Vercel)
```bash
cd packages/web && vercel --prod
```

### Mobile (Expo EAS)
```bash
cd packages/mobile
npx eas build --platform all --profile preview
# Expo gives you a download link for your family
```

---

## ⚙️ Environment Variables

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="long-random-secret"
PORT=3001
ANTHROPIC_API_KEY="sk-ant-..."   # Optional - for AI reports
CLIENT_URL="https://your-app.vercel.app"
```

---

Built with ❤️ · Family Hub v2.0 · MIT License
