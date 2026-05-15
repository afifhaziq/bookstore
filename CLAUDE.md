# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal bookstore inventory management system — a buy-and-deliver personal shopper tool replacing an Excel workflow. Customers place orders, each order contains books, and the operator tracks payment status through a lifecycle from deposit → paid → bought → under_delivery → delivered.

## Repository Structure

```
bookstore/
├── backend/          # FastAPI + SQLAlchemy async API
├── frontend/         # Next.js App Router frontend
├── supabase/         # schema.sql for Supabase migrations
└── schema.dbml       # Source-of-truth data model (DBML format)
```

## Backend

### Commands

All Python commands use `uv`, never pip/venv:

```bash
cd backend
uv run uvicorn app.main:app --reload      # dev server (port 8000)
uv run pytest                              # all tests
uv run pytest tests/test_books.py         # single test file
uv run pytest -k "test_create"            # single test by name
uv add <package>                           # add dependency
```

### Architecture

- **`app/main.py`** — FastAPI app with CORS for `localhost:3000`. Mounts four routers: `/customers`, `/orders`, `/books`, `/dashboard`.
- **`app/models.py`** — SQLAlchemy ORM. Five tables: `users`, `orders`, `books`, `prices`, `order_books`. All `Enum` columns use `native_enum=False` for SQLite test compatibility.
- **`app/schemas.py`** — Pydantic request/response models.
- **`app/database.py`** — Async SQLAlchemy engine. Uses `connect_args={"ssl": "require"}` for Postgres (Supabase), no SSL for SQLite.
- **`app/auth.py`** — Supabase JWT verification via JWKS (RS256). In-memory JWKS cache with key-rotation retry. Overridden in tests via `dependency_overrides`.
- **`app/config.py`** — `pydantic-settings` reads `DATABASE_URL` and `SUPABASE_URL` from `.env`.

### Testing

Tests use SQLite in-memory (`sqlite+aiosqlite:///:memory:`). `conftest.py` overrides both `get_db` and `get_current_user` dependencies so tests need no real DB or auth token. Each test gets a fresh schema (created + dropped per fixture).

Backend `.env` (not committed):
```
DATABASE_URL=postgresql+asyncpg://postgres:<password>@db.<project>.supabase.co:5432/postgres
SUPABASE_URL=https://<project>.supabase.co
```

### Data Model

Postage rates: premium RM10, hard_cover RM8, soft_cover RM5.  
`Price` is a 1:1 child of `Book` (separate table) storing `total_price`, `deposit_amount`; `outstanding_amount` is a computed property.  
`OrderBook` is the many-to-many join between `orders` and `books`.

## Frontend

### Commands

```bash
cd frontend
npm run dev        # dev server (port 3000)
npm run build      # production build
npm run lint       # ESLint
```

### Architecture

- **`app/layout.tsx`** — Root layout: loads IBM Plex Sans/Serif/Mono fonts, wraps with `QueryProvider`.
- **`app/page.tsx`** — Redirects `/` → `/dashboard`.
- **`app/login/page.tsx`** — Email/password login via Supabase Auth.
- **`app/(dashboard)/layout.tsx`** — Auth guard: checks session on mount, redirects to `/login` if none. Renders `<Sidebar>` + `<main>`.
- **`app/(dashboard)/dashboard/page.tsx`** — Book status counts + outstanding books table.
- **`app/(dashboard)/customers/`** — List with search + Add dialog; `[id]` shows customer orders.
- **`app/(dashboard)/orders/`** — List; `[id]` has inline editing of book status/deposit, cancel, address edit; `new/` is a 3-step stepper.
- **`app/(dashboard)/books/page.tsx`** — Filterable books table with delete.
- **`lib/api.ts`** — Typed API client. `request<T>()` attaches `Authorization: Bearer <token>` from Supabase session. All CRUD functions live here.
- **`lib/auth.ts`** — Thin wrappers around `supabase.auth`: `signIn`, `signOut`, `getSession`, `getAccessToken`.
- **`hooks/`** — TanStack Query hooks (`useBooks`, `useCustomers`, `useOrders`, `useDashboard`) with cache invalidation on mutations.
- **`providers/QueryProvider.tsx`** — `QueryClient` with `staleTime: 30s`, `retry: 1`.

### Key Constraints

- The shadcn install uses `@base-ui/react/button`, which does **not** support `asChild`. Use `buttonVariants()` as `className` on a plain `<Link>` instead of wrapping `<Link>` in `<Button>`.
- Base UI Select's `onValueChange` passes `value | null` — always null-guard before using the value.
- Next.js 16 App Router: use `use(params)` to unwrap params in client components (not `params.id` directly). See `frontend/AGENTS.md` for the reminder to read `node_modules/next/dist/docs/` before writing Next.js code.
- Route groups like `(dashboard)` don't add URL segments. `app/(dashboard)/page.tsx` and `app/page.tsx` would both map to `/` — conflict. Dashboard lives at `app/(dashboard)/dashboard/page.tsx`.

### Theme

tweakcn IBM Plex theme: warm background `rgb(249,247,243)`, sage-green primary `rgb(120,148,128)`. Defined in `app/globals.css`. Do not switch to default shadcn black/white theme.

Frontend `.env.local` (not committed):
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Supabase

- Auth is Supabase Auth (no custom `users` table for auth — Supabase Auth is separate from the `users`/customers table in the schema).
- All tables have RLS enabled. Backend connects as the `postgres` superuser which bypasses RLS.
- Schema source of truth: `schema.dbml`. Applied via `supabase/schema.sql`.

## WSL2 DNS Note

The default WSL2 nameserver (`10.255.255.254`) cannot resolve `db.*.supabase.co`. If the backend returns 500 errors and no DB connections appear in Supabase logs, fix DNS:

```bash
sudo rm /etc/resolv.conf
echo -e "nameserver 8.8.8.8\nnameserver 8.8.4.4" | sudo tee /etc/resolv.conf
sudo bash -c "printf '[network]\ngenerateResolvConf = false\n' >> /etc/wsl.conf"
```
