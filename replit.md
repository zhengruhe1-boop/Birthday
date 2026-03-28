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

## Applications

### 生日通 (Birthday Tracker) - `artifacts/birthday-app`

H5 mobile birthday reminder app. Features:
- WeChat OAuth login + mock login for testing
- Contact list grouped by birthday proximity (即将过生日/近期过生日/一个月后生日)
- Chinese lunar/solar calendar support
- Add/Edit contacts with fields: name, gender, birthday, relation, hometown, reminder email
- Email notification (remind 1 day before birthday via email)
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
- `POST /api/auth/mock-login` — test login
- `POST /api/auth/wechat/login` — WeChat OAuth login (requires WECHAT_APPID, WECHAT_APP_SECRET env vars)
- `GET /api/auth/me` — get current user
- `POST /api/auth/logout` — logout
- `GET /api/contacts` — list contacts (with optional search)
- `POST /api/contacts` — create contact
- `GET /api/contacts/upcoming` — get upcoming birthdays (grouped)
- `GET /api/contacts/:id` — get contact
- `PUT /api/contacts/:id` — update contact
- `DELETE /api/contacts/:id` — delete contact

### `artifacts/birthday-app` (`@workspace/birthday-app`)

React + Vite mobile-first H5 app. Pages:
- `/` — Login page (WeChat + mock login)
- `/home` — Main birthday list (grouped by proximity)
- `/contacts/new` — Add contact form
- `/contacts/:id/edit` — Edit contact form

### `lib/db` (`@workspace/db`)

Database schema:
- `users` — user accounts (id, openId, nickname, avatarUrl, sessionToken)
- `contacts` — birthday contacts (id, userId, name, gender, birthdayMonth, birthdayDay, birthdayLunar, birthYear, relation, hometown, reminderEmail, avatarUrl)

### WeChat Integration

To enable real WeChat login, set environment variables:
- `WECHAT_APPID` — WeChat Mini Program App ID
- `WECHAT_APP_SECRET` — WeChat Mini Program App Secret

Without these, use the mock login (dev mode) available on the login page.

## Production migrations

In development: `pnpm --filter @workspace/db run push`
