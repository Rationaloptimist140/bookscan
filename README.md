# 📚 BookScan

**Triage, scan and sell pre-2022 physical books as clean AI training data.**

BookScan is a full-stack application for sourcing, triaging, scanning and monetising
pre-2022 physical books. Scan a book's ISBN and it instantly tells you whether the
work is public domain in the UK, whether it already exists on Project Gutenberg, what
its value is as AI training data, and where the physical copy should be resold for the
best margin.

---

## Table of contents

- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick start (mock mode — no backend needed)](#quick-start-mock-mode--no-backend-needed)
- [Database setup](#database-setup)
- [Backend setup](#backend-setup)
- [Frontend setup](#frontend-setup)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [API reference](#api-reference)
- [Business logic](#business-logic)
- [Design system](#design-system)
- [Project structure](#project-structure)
- [Legal notes](#legal-notes)

---

## How it works

1. Buy a book from a UK charity shop or second-hand bookshop (typically £2–£5).
2. Run the ISBN through the BookScan triage tool.
3. The triage engine determines:
   - **Public domain status** — UK "life + 70" rule from the author's death year.
   - **Gutenberg duplication** — is a clean digital text already freely available?
   - **AI training value** — pre-LLM era, uniqueness, licensing position, niche domain.
   - **Triage score** (0–100) and a **recommended action**.
   - **Resale platform** recommendation with an estimated price range.
4. If the book is public domain *and* not already digitised, scan it non-destructively,
   run OCR, and package the clean text as a sellable dataset.
5. Resell the physical copy on the recommended platform.

Both revenue streams — dataset sales and physical resales — are tracked in one place.

---

## Architecture

```
┌────────────────────────────┐         ┌──────────────────────────────┐
│  Next.js 14 (App Router)   │         │   FastAPI (Python 3.12+)     │
│  Vercel                    │         │   Render                     │
│                            │         │                              │
│  Pages, UI, SWR hooks      │         │  Triage engine               │
│                            │         │  OCR pipeline (Tesseract)    │
│  /app/api/triage/route.ts  │────────▶│  /api/triage                 │
│  (server-side proxy)       │  server │  /api/books, /datasets, ...   │
└────────────────────────────┘  only   └──────────────┬───────────────┘
                                                      │
                              ┌───────────────────────▼───────────────┐
                              │  Supabase                             │
                              │  PostgreSQL + Storage buckets         │
                              └───────────────────────────────────────┘
                                              ▲
                              ┌───────────────┴───────────────────────┐
                              │  Open Library API  ·  Gutendex API    │
                              └───────────────────────────────────────┘
```

**Why the proxy route?** The browser only ever talks to the Next.js origin. The
backend URL and any API key live in server-only environment variables and are never
shipped in the client bundle.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18+ | 20 LTS recommended |
| Python | 3.12+ | Backend uses modern type syntax (`X \| None`, `StrEnum`) |
| Supabase account | — | Free tier is sufficient |
| Tesseract OCR | 5+ | Only needed for the scanning workflow |

Install Tesseract locally:

```bash
# macOS
brew install tesseract

# Debian / Ubuntu
sudo apt-get install -y tesseract-ocr

# Windows (PowerShell, via winget)
winget install UB-Mannheim.TesseractOCR
```

---

## Quick start (mock mode — no backend needed)

BookScan ships with a full mock dataset so you can explore every screen without a
database, a backend or any API keys.

```bash
cd bookscan
npm install
cp .env.local.example .env.local
# Ensure NEXT_PUBLIC_MOCK_MODE=true in .env.local
npm run dev
```

Open <http://localhost:3000>. Every page — dashboard, triage, inventory, scan wizard,
datasets, sales — renders against seeded in-memory data. Creates, edits and deletes
work for the duration of the session.

> Mock mode activates when `NEXT_PUBLIC_MOCK_MODE=true` **or** when
> `NEXT_PUBLIC_API_URL` is unset.

---

## Database setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → **New query**.
3. Paste the entire contents of [`db/schema.sql`](db/schema.sql) and run it.

This creates:

- Tables: `books`, `scan_pages`, `datasets`, `sales`, `triage_cache`, `api_logs`
- All indexes (including GIN full-text and trigram indexes on title/author)
- `updated_at` triggers on `books` and `datasets`
- Row Level Security enabled on every table, with permissive single-user policies
- Storage buckets `scan-pages` and `ocr-text`
- A `v_monthly_revenue` helper view and a `purge_expired_triage_cache()` function

4. Under **Project Settings → API**, copy your project URL and **service role** key
   for the backend.

> **Tighten RLS before going multi-tenant.** The shipped policies are
> `USING (true) WITH CHECK (true)` — correct for a single-user tool, not for shared
> use. Swap them for `auth.uid() = owner_id` checks when you add accounts.

---

## Backend setup

```bash
cd bookscan/backend
python3 -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt

cp .env.template .env
# Edit .env and fill in SUPABASE_URL and SUPABASE_SERVICE_KEY

uvicorn main:app --reload --port 8000
```

Interactive API docs: <http://localhost:8000/docs>

The app is designed to **boot successfully even without Supabase credentials** so it
can start on a fresh host before secrets are configured. In that state `/health`
returns `supabase_configured: false` and database-backed routes return HTTP 503.

---

## Frontend setup

```bash
cd bookscan
npm install
cp .env.local.example .env.local
```

Point the frontend at your backend in `.env.local`:

```dotenv
NEXT_PUBLIC_MOCK_MODE=false
NEXT_PUBLIC_API_URL=http://localhost:8000
BACKEND_API_URL=http://localhost:8000
```

Then:

```bash
npm run dev        # development server
npm run typecheck  # TypeScript, no emit
npm run lint       # ESLint
npm run build      # production build
```

---

## Environment variables

### Frontend (`.env.local`)

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_MOCK_MODE` | client | `true` serves seeded mock data, no backend required |
| `NEXT_PUBLIC_API_URL` | client | Backend base URL for non-triage calls |
| `BACKEND_API_URL` | **server only** | Backend base URL used by the triage proxy route |
| `BACKEND_API_KEY` | **server only** | Optional; forwarded as `X-API-Key` |

### Backend (`.env`)

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | yes | Service role key — **server side only** |
| `ALLOWED_ORIGINS` | no | Comma-separated CORS origins (default `*`) |
| `API_KEY` | no | If set, requests must send a matching `X-API-Key` |
| `TESSERACT_CMD` | no | Explicit path to the Tesseract binary |
| `OCR_LANGUAGE` | no | Tesseract language code (default `eng`) |

> **Never commit real secrets.** `.env` and `.env.local` are git-ignored; only the
> `.template` / `.example` files are tracked. The service role key bypasses RLS —
> keep it server-side and rotate it if it is ever exposed.

---

## Deployment

### Frontend → Vercel

1. Push this repository to GitHub.
2. In Vercel, **New Project** → import the repo.
3. Set the **root directory** to `bookscan` if the repo contains other folders.
4. Add environment variables: `NEXT_PUBLIC_API_URL`, `BACKEND_API_URL`,
   `NEXT_PUBLIC_MOCK_MODE=false`.
5. Deploy. Vercel auto-detects Next.js; no build overrides needed.

### Backend → Render

The repo includes [`backend/render.yaml`](backend/render.yaml) as a Blueprint.

1. In Render, **New** → **Blueprint** and point it at the repository.
2. Confirm the service, then add the secret env vars (`SUPABASE_URL`,
   `SUPABASE_SERVICE_KEY`) in the dashboard — they are declared `sync: false`.
3. Deploy.

Manual setup instead of the Blueprint:

- **Environment**: Python 3
- **Root directory**: `backend`
- **Build**: `pip install -r requirements.txt`
- **Start**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Health check path**: `/health`

**Tesseract on Render.** The OCR routes need the `tesseract-ocr` system package. On
plans without apt support, deploy the backend as a Docker service and add
`RUN apt-get update && apt-get install -y tesseract-ocr` to the Dockerfile. Every
other endpoint works without it; OCR routes return a clear error if it is missing.

> On Render's free tier the service spins down after ~15 minutes idle, so the first
> request after a pause takes roughly 30 seconds.

---

## API reference

Base URL: your backend origin. All responses are JSON unless noted.

### Health & stats

| Method | Path | Description |
|---|---|---|
| `GET` | `/` · `/health` | Health check, reports `supabase_configured` |
| `GET` | `/api/stats/summary` | Dashboard totals, revenue and net profit |
| `GET` | `/api/stats/triage-distribution` | Book counts grouped by triage action |
| `GET` | `/api/activity` | Recent activity feed (`?limit=`) |

### Triage

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/triage` | Triage one book by `isbn`, or by `title` + `author` |
| `POST` | `/api/triage/bulk` | Triage many ISBNs, returns one row per ISBN |
| `GET` | `/api/triage/history` | Recent cached triage runs |

Results are cached in `triage_cache` for 30 days. Cache is checked before any
external API call; responses carry a `cached` boolean.

### Books

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/books` | Add a book to inventory |
| `GET` | `/api/books` | Paginated, filterable, sortable list |
| `GET` | `/api/books/{id}` | Single book |
| `PATCH` | `/api/books/{id}` | Partial update |
| `DELETE` | `/api/books/{id}` | Delete |
| `POST` | `/api/books/{id}/rerun-triage` | Re-run triage on a stored book |
| `GET` | `/api/books/{id}/resale` | Resale platform recommendation |

`GET /api/books` query parameters: `page`, `limit` (max 100), `search`,
`public_domain_status`, `ai_training_value`, `triage_action`, `scan_status`,
`sale_status` (each accepts comma-separated values), and `sort` — one of `newest`,
`score_desc`, `title_asc`, `author_asc`, `year_asc`, `year_desc`.

### Scanning

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/scan/queue/{book_id}` | Queue for scanning |
| `POST` | `/api/scan/upload` | Upload a page image (multipart) |
| `POST` | `/api/scan/process/{book_id}` | Run OCR as a background task |
| `GET` | `/api/scan/status/{book_id}` | Progress and OCR quality |
| `GET` | `/api/scan/text/{book_id}` | Extracted text (`text/plain`) |
| `PATCH` | `/api/scan/review/{book_id}` | Mark OCR reviewed, set quality score |

### Datasets

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/datasets` | Create from a scanned book |
| `GET` | `/api/datasets` | List (`?domain=`, `?language=`, `?sale_status=`) |
| `GET` | `/api/datasets/{id}` | Detail |
| `PATCH` | `/api/datasets/{id}` | Update price, status, platform |
| `DELETE` | `/api/datasets/{id}` | Delete |
| `GET` | `/api/datasets/{id}/preview` | First 500 words |
| `GET` | `/api/datasets/{id}/download` | Full text |

### Sales

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sales` | Record a sale (`data` or `physical`) |
| `GET` | `/api/sales` | List with filters |
| `GET` | `/api/sales/{id}` | Detail |
| `PATCH` | `/api/sales/{id}` | Update |
| `DELETE` | `/api/sales/{id}` | Delete |
| `GET` | `/api/sales/revenue/summary` | Totals, by month, by platform |

### Export

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/export/inventory.csv` | Full inventory as CSV |
| `GET` | `/api/export/books/{id}.json` | Single book record as JSON |

---

## Business logic

All triage rules live in [`backend/triage_logic.py`](backend/triage_logic.py) as pure,
side-effect-free functions.

**Public domain (UK).** Copyright expires 70 years after the end of the year of the
author's death. With a known death year the result is `confirmed_pd` or `not_pd`. With
only a publication year: pre-1900 → `confirmed_pd`, pre-1929 → `likely_pd`, otherwise
`unknown` pending an author death date.

**AI training value.** Weighs pre-LLM era (published before 2022), public domain
status, absence from Project Gutenberg, and whether the subject matter falls in a
niche domain (botany, medicine, philosophy, law, navigation, engineering, chemistry,
astronomy, agriculture, history, mathematics, physics, biology, theology).

- `premium` — pre-2022, not digitised, and public domain
- `high` — pre-2022 and not digitised
- `medium` — pre-2022 but already digitised
- `low` — post-2022, or digitised with confirmed PD

**Triage score (0–100).** AI value contributes up to 40, public domain status up to
25, absence from Gutenberg 20, pre-LLM era 15.

**Recommended action.**

| Condition | Action |
|---|---|
| Already on Gutenberg and PD | `already_available` |
| High/premium value and PD | `scan_and_sell_data` |
| High/premium value but in copyright | `preserve_only` |
| Medium or low value | `sell_physical` |

**ISBN handling.** `normalise_isbn` strips hyphens and spaces; `validate_isbn`
performs real ISBN-10 and ISBN-13 checksum validation.

---

## Design system

**"Scholarly Warmth"** — a modern digital library: warm, trustworthy and calm, with
literary typography and clean tech execution.

| Role | Light | Dark |
|---|---|---|
| Canvas | `#FAF9F6` | `#1A1A2E` |
| Surface | `#FFFFFF` | `#2A2B48` |
| Primary (forest green) | `#2D5F4F` | `#2D5F4F` |
| Accent (book gilt gold) | `#C49A4D` | `#C49A4D` |
| Secondary (muted teal) | `#5B8C8A` | `#5B8C8A` |
| Body text | `#2D2D2D` | `#E2E8F0` |

Typography: **Fraunces** (serif) for headings, **Inter** for body and UI,
**JetBrains Mono** for ISBNs, metadata and figures.

Every colour is a CSS custom property mapped into Tailwind, so dark mode is a single
class toggle on `<html>` with no per-component overrides. Tailwind token names:
`canvas`, `canvas-alt`, `surface`, `surface-hover`, `primary`, `accent`, `secondary`,
`success`, `warning`, `danger`, `info`, `ink`, `ink-body`, `ink-muted`, `ink-light`,
`rule`, `rule-light`, `divider`.

Dark mode can be toggled from the sidebar footer or the settings page; the choice is
persisted to `localStorage` and falls back to the OS `prefers-color-scheme`.

---

## Project structure

```
bookscan/
├── app/
│   ├── layout.tsx              Root layout — fonts, providers, app shell
│   ├── globals.css             Design tokens + Tailwind + base styles
│   ├── page.tsx                Dashboard
│   ├── triage/page.tsx         Triage tool
│   ├── inventory/
│   │   ├── page.tsx            Inventory list (table + grid views)
│   │   └── [id]/page.tsx       Book detail
│   ├── scan/page.tsx           5-step scanning wizard
│   ├── datasets/
│   │   ├── page.tsx            Dataset marketplace
│   │   └── [id]/page.tsx       Dataset detail
│   ├── sales/page.tsx          Sales & revenue dashboard
│   ├── settings/page.tsx       Settings
│   └── api/triage/route.ts     Server-side proxy to the backend
│
├── components/
│   ├── layout/                 Sidebar, TopBar, PageContainer, Breadcrumbs
│   ├── triage/                 IsbnInput, TriageResult, TriageScore, ...
│   ├── inventory/              BookTable, BookCard, BookFilters, ...
│   ├── dashboard/              StatsCards, RevenueChart, ...
│   ├── ui/                     15 reusable primitives
│   └── providers/              ThemeProvider, SWRProvider
│
├── lib/
│   ├── types.ts                Shared type contracts (source of truth)
│   ├── constants.ts            Status colour maps, labels, palette
│   ├── api.ts                  Fetch wrapper + mock-mode dispatch
│   ├── utils.ts                Formatting and validation helpers
│   ├── mockData.ts             Seeded demo dataset
│   └── hooks/                  SWR hooks per resource
│
├── backend/
│   ├── main.py                 FastAPI app — all endpoints
│   ├── models.py               Pydantic v2 models
│   ├── database.py             Supabase client
│   ├── triage_logic.py         Pure business logic
│   ├── external_apis.py        Open Library + Gutendex
│   ├── ocr_pipeline.py         Tesseract OCR pipeline
│   ├── requirements.txt
│   ├── render.yaml
│   └── .env.template
│
└── db/
    └── schema.sql              Complete schema, indexes, triggers, RLS
```

`lib/types.ts` is the contract of record: the backend's Pydantic models in
`models.py` mirror it field-for-field. Change both together.

---

## Legal notes

This tooling is built around a specific legal position. Verify it against current law
and take your own advice before trading.

- **UK public domain** — copyright in a literary work generally expires 70 years after
  the end of the year in which the author died. BookScan's `confirmed_pd` verdict is a
  calculation, not legal advice. Translations, editorial apparatus, introductions,
  illustrations and typographical arrangement can all carry their own separate
  copyright even when the underlying text is out of copyright.
- **UK text and data mining** — the Section 29A exception covers non-commercial
  research only. It does **not** authorise scanning in-copyright works to sell as
  training data.
- **No US-style fair use** — the UK has no broad transformative-use defence. Fair
  dealing is narrow and purpose-limited.
- **Provenance matters** — buyers of training data care about a defensible chain of
  custody. Every book carries a `provenance_chain` recording acquisition, scanning and
  sale events; keep it accurate and keep your receipts.
- BookScan ships **no book text of any kind**. All mock descriptions are original
  neutral summaries written for demonstration purposes.

---

## Licence

No licence file is included — add one before publishing or distributing.
