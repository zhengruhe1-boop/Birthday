# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **AI**: OpenAI via Replit AI Integrations (gpt-4o-mini), env vars: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`

## Applications

### 生日通 (Birthday Tracker) - `artifacts/birthday-app`

H5 mobile birthday reminder app. Features:
- WeChat OAuth login + mock login for testing
- Contact list grouped by birthday proximity (即将过生日/近期过生日/一个月后生日)
- Chinese lunar/solar calendar support
- Add/Edit contacts with fields: name, gender, birthday, relation, hometown, reminder email, avatar (local upload)
- Local avatar upload (POST /api/upload, 12MB limit, served at /api/uploads/)
- Email notification (remind 1 day before birthday via QQ SMTP, 991067346@qq.com)
- Daily scheduler at 08:00 to send birthday reminders
- Test reminder email button in contact edit form
- AI-generated historical events for each contact's birthday date (3 events from China/world)
- Search contacts by name
- Floating action button to add new contact

Auth: Bearer token stored in localStorage, sent with each API request.

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── birthday-app/       # React + Vite birthday tracker app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes:
- `GET /api/healthz` — health check
- `POST /api/auth/mock-login` — test login (body: nickname, deviceId)
- `POST /api/auth/wechat/login` — WeChat OAuth login (requires WECHAT_APPID, WECHAT_APP_SECRET env vars)
- `GET /api/auth/me` — get current user
- `POST /api/auth/logout` — logout
- `GET /api/contacts` — list contacts (with optional search)
- `POST /api/contacts` — create contact (auto-generates birthday events in background)
- `GET /api/contacts/upcoming` — get upcoming birthdays (grouped)
- `GET /api/contacts/:id` — get contact
- `PUT /api/contacts/:id` — update contact (re-generates events if birthday changed)
- `DELETE /api/contacts/:id` — delete contact
- `POST /api/contacts/:id/birthday-events` — regenerate AI birthday events
- `POST /api/upload` — upload avatar image (multer, 12MB limit)
- `GET /api/reminders/verify-email` — verify QQ email config
- `POST /api/reminders/test/:contactId` — send test birthday email
- `POST /api/reminders/run` — manually trigger birthday reminder check

Key lib files:
- `src/lib/birthday-events.ts` — OpenAI-powered historical events generator
- `src/lib/email.ts` — QQ SMTP email sender (nodemailer)
- `src/lib/reminder.ts` — Daily scheduler + birthday reminder logic
- `src/lib/birthday.ts` — Birthday calculation helpers

### `artifacts/birthday-app` (`@workspace/birthday-app`)

React + Vite mobile-first H5 app. Pages:
- `/` — Login page (WeChat + mock login)
- `/home` — Main birthday list (grouped by proximity)
- `/contact/new` — Add contact form
- `/contact/:id` — Edit contact form (shows AI-generated historical events)

### `lib/db` (`@workspace/db`)

Database schema:
- `users` — user accounts (id, openId, nickname, avatarUrl, sessionToken)
- `contacts` — birthday contacts (id, userId, name, gender, birthdayMonth, birthdayDay, birthdayLunar, birthYear, relation, hometown, reminderEmail, avatarUrl, birthdayEvents)

`birthdayEvents` stores JSON array of `{year, category, title, description}` objects.

### WeChat Integration

To enable real WeChat login, set environment variables:
- `WECHAT_APPID` — WeChat Mini Program App ID
- `WECHAT_APP_SECRET` — WeChat Mini Program App Secret

Without these, use the mock login (dev mode) available on the login page.

## Production migrations

In development: `pnpm --filter @workspace/db run push`
