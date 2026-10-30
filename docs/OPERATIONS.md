# Kinroost operations runbook

How Kinroost is run day to day, and what to do when something goes wrong.
Keep this up to date when hosting or contacts change.

## 1. What runs where

| Piece | Host | Notes |
|---|---|---|
| Web app | Vercel | `packages/web` |
| API | Railway | `packages/api` (Dockerfile.api) |
| Database | Neon (PostgreSQL) | Schema changes only via Prisma migrations |
| Email | Gmail SMTP | Confirmation and password-reset emails |
| AI | Anthropic | Only for families whose parent turned AI on |
| Photos and videos | Cloudinary | Chore proof, chat photos and videos, profile photos. **Required in production:** without it uploads go to the server's disk, which Railway wipes on every deploy |

## 2. Railway environment variables (API)

Required: `DATABASE_URL`, `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `CLIENT_URL`, `APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `SUPPORT_EMAIL`.
Needed for photos: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (free plan is fine). Optional: `ANTHROPIC_API_KEY`, `GOOGLE_*`, `VAPID_*` (browser notifications, see 3a), `EXPO_ACCESS_TOKEN` (only if you turn on Expo's enhanced push security). See `packages/api/.env.example`.

**Never set** `TEST_DATABASE_URL`, `RATE_LIMIT_MULTIPLIER`, `EMAIL_OUTBOX_DIR` or `ANTHROPIC_BASE_URL` in production — they are for the test suite.

Generate long random secrets with:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Keep a copy of `TOKEN_ENCRYPTION_KEY` in a password manager. If it is lost, families must reconnect Google Calendar.

### Gmail for sending email (free, about 500 emails a day)
1. Use a Gmail account for Kinroost (a dedicated one is best).
2. Turn on 2-Step Verification for that account.
3. Google Account → Security → App passwords → create one named "Kinroost".
4. In Railway set: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=<the gmail address>`, `SMTP_PASS=<the 16-character app password>`, `EMAIL_FROM=Kinroost <the gmail address>`, `APP_URL=<the Vercel web address>`.

To move to Resend, Brevo or Google Workspace later, change only these variables.

## 3. Deploying a change

1. The change is on a branch with a pull request, and the CI check on GitHub is green.
2. **Back up first**: Neon console → your project → Branches → *Create branch* from `main` (name it `backup-YYYY-MM-DD`). This is an instant copy you can restore from.
3. If the change includes new migrations (`packages/api/prisma/migrations`):
   ```powershell
   cd packages\api
   $env:DATABASE_URL = "<production Neon connection string>"
   npx prisma migrate status
   npx prisma migrate deploy
   Remove-Item Env:DATABASE_URL
   ```
   Never use `prisma db push` or `migrate reset` against production.
4. Merge the pull request. Railway redeploys the API; Vercel redeploys the web app.
5. Check `https://<api>/health/ready` returns `{"ok":true,"db":"ok"}` and sign in once.

## 3a. Push notifications (phones and browsers)

Kinroost pushes: chores assigned, a photo to check (parents), approved or sent back (kids),
reward requests and decisions, star bank, family chat, the 7:30 morning briefing and the
4 pm "tasks due" reminder. Each person chooses chores / rewards / chat per device in Settings.

### Android phones (one-time Firebase setup, free)
1. Go to https://console.firebase.google.com → **Add project** → name it `Kinroost` (Google Analytics: off).
2. **Add app → Android**. Package name: `com.familyhub.app` → **Register app** → **Download google-services.json**.
3. Put that file in `packages/mobile/` and commit it (it is not a secret — it only identifies the app).
4. In Firebase: ⚙ **Project settings → Service accounts → Generate new private key**. This JSON **is a secret**.
5. In PowerShell, in `packages/mobile`: `eas credentials` → Android → `preview` → **Google Service Account** →
   **Manage your Google Service Account Key for Push Notifications (FCM V1)** → upload the file from step 4.
   Then delete that file from your computer.
6. Build again: `eas build -p android --profile preview`, and install the new APK.

Without this, the Android app still works, but Settings → Notifications says "not available".

### Browsers (website)
1. On your laptop: `npx web-push generate-vapid-keys`
2. In Railway (API → Variables) set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and
   `VAPID_SUBJECT=mailto:davidson@credenceconsulting.io`. Keep the private key secret.
3. On the website: Settings → Notifications on this device → Enable.

### Checking
Phone: Settings → Notifications on this phone → **Send a test**. Website: Settings → **Server delivery test**.
If a phone stops getting pushes after the app is uninstalled, the server forgets it automatically.

## 4. Backups and restore

- Neon keeps point-in-time history for a limited window that depends on your plan — check it in the Neon console and note it here: **____ days**.
- Before every migration, create a Neon branch (step 3.2).
- To restore: in Neon, create a branch from the backup branch or from a point in time, then point Railway's `DATABASE_URL` at it (or restore into `main` from the Neon console). Re-run `/health/ready` afterwards.
- A parent can also download their own family's data (Settings → Your family's data).

## 5. Monitoring

- **Uptime**: create a free UptimeRobot (or similar) monitor for `https://<api>/health/ready` every 5 minutes, alerting your email/phone. It fails if the API or the database is down.
- **Errors**: Railway → API service → Logs. Search for `[fatal]`, `error`, `[email] send failed`, `[health]`.
- **CI**: GitHub → Actions. A red ✗ on `main` means do not deploy.
- **Weekly**: glance at Railway logs and Neon usage; make sure backups exist.

## 6. Support

- Families contact the support email shown in Settings → Plan & help (`SUPPORT_EMAIL`).
- Aim to reply within 2 business days during the beta.
- Common requests:
  - *Forgot password*: parents use "Forgot password?" (needs a confirmed email); kids ask a parent (Settings → Reset password).
  - *Lost phone*: a parent uses Settings → Sign out on the member.
  - *Family code leaked*: a parent uses Settings → Make a new family code.
  - *Copy of data / delete everything*: the parent does it from Settings → Your family's data. Do not delete data by hand in the database.
- Never ask a family for their password.

## 7. Incident plan

### A. The app is down
1. Check `/health/ready`, Railway (API) status and logs, Neon status, Vercel status.
2. If a deploy caused it, roll back in Railway (Deployments → previous → Redeploy) or revert the merge.
3. If a migration caused it, restore the Neon backup branch (section 4).
4. Post a short note to beta families if it lasts more than an hour.

### B. A secret may have leaked (API key, database password, JWT secret)
1. Rotate it immediately: Anthropic console, Neon (reset password), Railway variables.
2. Changing `JWT_SECRET` signs everyone out — do it if there is any chance sessions were exposed.
3. Delete any files or zips that contained it, and check git history.
4. Record what happened (section C.4).

### C. Possible privacy breach (someone saw data they shouldn't have)
1. **Contain**: stop the cause (deploy a fix, rotate secrets, take the API down if needed).
2. **Assess**: what data, which families, how many people, and whether children are involved. The family activity log (AuditLog) and Railway logs help here.
3. **Decide**: under PIPEDA, if the breach creates a *real risk of significant harm*, you must report it to the Office of the Privacy Commissioner of Canada and notify the affected families as soon as feasible. Children's information raises the risk. When unsure, get legal advice quickly.
4. **Record**: keep a record of every breach of security safeguards — even ones you don't report — for at least 24 months (date, what happened, data involved, steps taken).
5. **Learn**: add a test to the suite that would have caught it.

## 8. Before inviting outside families (checklist)

- [ ] Lawyer review of the Privacy Policy and Terms (`packages/web/src/legal/`), and correct details in `legal/config.ts`
- [ ] Gmail SMTP configured and a test password reset received
- [ ] `TOKEN_ENCRYPTION_KEY`, `SUPPORT_EMAIL`, `APP_URL` set in Railway
- [ ] Uptime monitor on `/health/ready`
- [ ] Neon backup window confirmed (section 4)
- [ ] Mobile app tested on a real phone (or invite families to the web app only)
