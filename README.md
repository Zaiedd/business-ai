# Business AI

AI-powered business intelligence SaaS — dashboards, analytics, and a bilingual (English / Arabic RTL) workspace for small businesses.

Built with **Next.js 15**, **TypeScript**, **Tailwind CSS v4**, **Prisma + SQLite**, and **Recharts**.

## Features

- **Auth** — register, login, email verification, password reset (SMTP or dev console), sessions with rate limiting.
- **Roles & permissions** — OWNER, ADMIN, MANAGER, ACCOUNTANT, EMPLOYEE; page + API level enforcement.
- **Dashboard** — revenue KPIs, charts (revenue trend, product profit, expense breakdown), business health score (0–100), forecast, alerts, at-risk customers, insights.
- **AI Advisor** — ask questions in natural language (EN/AR) about revenue, profit, expenses, inventory, customers, health.
  - Uses a **local free LLM (Ollama)** when available, and automatically falls back to a deterministic analytics engine when it is not — the feature never breaks offline.
- **Sales** — full CRUD invoices with line items, discount, tax, status flow (COMPLETED → REFUNDED restocks + restores customer stats).
- **Inventory** — product CRUD, stock levels, low-stock alerts, margins.
- **Customers** — CRUD with segments, loyalty points, auto-recomputed stats (orders, total spent, last purchase).
- **Reports** — 6 report types (sales, expenses, products, customers, branches, employees) with localized tables and CSV export.
- **Team / Settings / Audit log** — owner/admin only, with an audit trail for every sensitive action.
- **i18n** — full English / Arabic (RTL) localization, currency and date formatting, per-user language.

## Tech stack

| Layer    | Choice                                        |
| -------- | --------------------------------------------- |
| Frontend | Next.js 15 (App Router), React 19, Tailwind v4 |
| Backend  | Next.js Route Handlers, Server Modules         |
| DB       | Prisma + SQLite (dev), PostgreSQL-ready schema |
| Auth     | JWT sessions (jose), bcrypt, rate limiting      |
| Validation | zod                                          |
| Charts   | Recharts                                       |
| Email    | Nodemailer (SMTP) with console fallback        |
| AI       | Ollama (OpenAI-compatible) with deterministic fallback |

## Getting started

```bash
npm install
# copy .env as needed (defaults work out of the box)
npx prisma db push     # create the SQLite schema
npm run db:seed        # load demo data
npm run dev            # http://localhost:3000
```

Production build:

```bash
npm run build
npm start -- -p 3100  # http://localhost:3100
```

### Demo accounts

| Role      | Email                  | Password       |
| --------- | ---------------------- | -------------- |
| Owner     | `owner@acme.test`      | `Password123!` |
| Admin     | `admin@acme.test`      | `Password123!` |
| Manager   | `manager@acme.test`    | `Password123!` |
| Accountant| `accountant@acme.test` | `Password123!` |
| Employee  | `employee1@acme.test`  | `Password123!` |

## Configuration (.env)

| Variable       | Purpose                                             | Default |
| -------------- | --------------------------------------------------- | ------- |
| `DATABASE_URL` | SQLite file path or Postgres connection string      | `file:./dev.db` |
| `AUTH_SECRET`  | JWT signing secret (set a strong random value!)     | —       |
| `OPENAI_BASE_URL` | OpenAI-compatible endpoint (Ollama local)        | `http://localhost:11434/v1` |
| `OPENAI_API_KEY`  | Key for hosted providers (Ollama ignores it)     | `ollama` |
| `AI_MODEL`     | Model name used by the advisor                      | `llama3.1` |
| `AI_TIMEOUT_MS`| LLM request timeout before deterministic fallback   | `8000` |
| `AI_PROBE_TIMEOUT_MS` | Reachability probe timeout before attempting the LLM | `2000` |
| `SMTP_HOST`    | SMTP server (empty = print to console in dev)       | —       |
| `SMTP_PORT`    | SMTP port (465 + `SMTP_SECURE=true` for SSL)        | `587`   |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials                        | —       |
| `SMTP_FROM`    | Sender address                                      | `Business AI <no-reply@business-ai.local>` |

### Enabling the local AI advisor (Ollama)

```bash
# 1. Install Ollama: https://ollama.com
# 2. Start the server
ollama serve
# 3. Pull a model (default is llama3.1; set AI_MODEL to change)
ollama pull llama3.1
```

The advisor will use the LLM automatically. If Ollama is stopped or the model is missing, the deterministic analytics engine answers instead — no error to the user.

### Using a hosted LLM (Google Gemini — free tier)

The advisor is wired to any OpenAI-compatible endpoint, so Google Gemini works with zero code changes:

1. Get a free API key (no credit card) at **https://aistudio.google.com/apikey**
2. Set three variables in `.env`:

```
OPENAI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/"
OPENAI_API_KEY="YOUR_GEMINI_API_KEY"
AI_MODEL="gemini-3.6-flash"
```

> Model availability changes; older models (e.g. `gemini-2.5-flash`) may be blocked for new keys. If you get a `404 model not available` error, list the current models (`GET $OPENAI_BASE_URL/models` with your key) and set `AI_MODEL` to the newest `*-flash` model listed.

3. Restart the server. The advisor now answers via Gemini and still falls back to the deterministic engine if the key is invalid or the API is unreachable.

Other OpenAI-compatible providers (OpenAI, Groq, Mistral, OpenRouter, local Ollama) work the same way — just point `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `AI_MODEL` at them.

### Sending real email

The default `AUTH_SECRET` and console mail are fine for development. For production email (verification + password reset), fill the `SMTP_*` variables (Gmail app passwords, SendGrid, Mailgun, Resend, Brevo, etc.).

## Project structure

```
src/
  app/(auth)/            login, register, forgot/reset password, verify email
  app/(dashboard)/       dashboard, advisor, sales, inventory, customers,
                         reports, team, settings, activity
  app/api/               auth, dashboard, advisor/chat, sales, inventory,
                         customers, reports, team, settings, audit
  components/            ui primitives, layout, dashboard widgets
  lib/                   db, auth, api, rbac, validators, mailer, i18n (en/ar)
  server/                analytics engine, business logic (sales, inventory,
                         customers, reports, dashboard)
  server/ai/             advisor (deterministic), llm (Ollama), insights, provider
  middleware.ts          route protection + role gates
prisma/schema.prisma     data model
prisma/seed.ts           demo companies + data
```

## Roadmap notes

- **AI**: insights generator is currently deterministic; swap `server/ai/provider.ts` for an LLM-backed provider if desired.
- **Database**: SQLite is dev-only. For production switch to PostgreSQL (`DATABASE_URL` + `prisma db push`).
- **Tests**: no automated test suite yet.
