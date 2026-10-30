# Muse retest brief — Kinroost, October 2026

Please run a second functional and security test of Kinroost. The first test
(branch `muse-functional-testing`, v2.1) found broken migrations, accounts with
no passwords, data leaking between families, kids able to do parent-only
actions, and private fields returned by the API. All of those were fixed and
merged to `main` on 29 October 2026. Please test the `main` branch.

## Important: do not test against production

The live site holds a real family's data, including children's. Run your own
copy instead:

```bash
pnpm install
cp packages/api/.env.example packages/api/.env   # set DATABASE_URL to your own empty Postgres, and JWT_SECRET
cd packages/api && pnpm exec prisma migrate deploy && cd ../..
pnpm dev:api    # http://localhost:3001  (or: cd packages/api && pnpm dev)
pnpm dev:web    # http://localhost:5173  (or: cd packages/web && pnpm dev)
```

Leave the SMTP settings empty and set `EMAIL_OUTBOX_DIR=/tmp/outbox`. Emails
(confirm email, reset password) are then written to that folder as files.
Leave `ANTHROPIC_API_KEY` empty unless you want to test the AI features.

The project's own test suite (88 tests) can be run with:

```bash
cd packages/api
TEST_DATABASE_URL=postgresql://USER:PASS@localhost:5432/fh_test node test/run.mjs
```

It wipes the database it is pointed at and refuses to run against anything
except localhost.

## 1. Re-check every finding from the first report

| Area | What should now happen |
|---|---|
| Fresh install | `prisma migrate deploy` builds an empty database with no errors and no drift |
| Passwords | Everyone needs a password (parents) or a PIN of at least 4 digits (kids). Accounts created before passwords existed set theirs on first sign-in. Wrong passwords get one generic error, and repeated attempts are rate limited |
| Family isolation | No request can read or change another family's chores, meals, events, rewards, messages, trips, members, etc. Try swapping IDs in every route |
| Parent-only actions | Kids get 403 on creating, editing or deleting chores, rewards, rules, members, approvals, bank payouts, settings, export and delete. On chores, kids can only send status and proof |
| Field leaks | No response includes password hashes, tokens, push endpoints, Google tokens, or other members' emails |
| Stars | Completing, approving or redeeming the same thing twice (including in parallel) pays out exactly once |

## 2. New since the first test — please cover

**Accounts and sessions**
- Sign up needs an email plus ticks on the terms and child-data consent boxes
- Confirm email, forgot password and reset password links: they work once, expire, and old links stop working
- Sign in with an email (parents, once confirmed) or with family code, name and password
- Changing a password, resetting it and "sign out everywhere" each end old sessions, including websockets
- Rotating the family code stops the old code working for joining and signing in
- Sessions last 14 days and refresh on use

**Privacy and data**
- Existing families see a consent screen once, and kids can't join until a parent accepts
- AI features stay off until a parent turns them on. When on, requests to the AI provider contain "Parent 1" / "Child 1" labels and age bands only: no names, birthdays or exact ages
- Settings → Download family data gives a complete JSON file without secrets
- Export and delete family need the parent's password (delete also needs the family name typed), and delete really removes everything
- Removing a member deletes their personal data and hands shared items to the parent
- The parent-only activity log records sensitive actions
- Google Calendar tokens are stored encrypted

**Engagement features**
- Levels and badges from lifetime stars; streaks count once per day
- Photo-proof chores go to "waiting for approval"; parents approve or reject with a note
- Family goal bar, Weekly Wins page, morning briefing, house view
- Take-turns chores rotate between kids weekly; the fairness meter is visible to the whole family (a deliberate choice); recommendations are parents only
- Star bank: convert stars to screen time or allowance, use or move, with no double spending
- Add events from a flyer photo or pasted email (AI), with a review step before anything is added

## 3. Out of scope this round

- The mobile app (Expo) has just been updated for the new features. The web app is the main reference; mobile findings are welcome but secondary
- Payments: the beta is free and there is no billing yet

## What we'd like back

Same format as last time: each issue with severity, steps to reproduce,
expected vs actual, and the route or screen involved. Please also list
anything a non-technical parent or a 7-year-old found confusing.
