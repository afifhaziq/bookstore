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

- **`app/main.py`** — FastAPI app with CORS for `localhost:3000`. Mounts five routers: `/customers`, `/orders`, `/books`, `/publishers`, `/dashboard`.
- **`app/models.py`** — SQLAlchemy ORM. Five tables: `users`, `publishers`, `books`, `orders`, `order_books`. All `Enum` columns use `native_enum=False` for SQLite test compatibility.
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

**Enums**: `BookStatus` (deposit/paid/bought/under_delivery/delivered/cancelled), `OrderStatus` (active/cancelled), `PostageType` (semenanjung/sabah_sarawak), `PsChargeType` (premium/hard_cover/soft_cover).

**Constants**: `POSTAGE_DEFAULTS = {semenanjung: 8.00, sabah_sarawak: 16.00}`, `PS_CHARGE_RATES = {premium: 10.00, hard_cover: 8.00, soft_cover: 5.00}`.

`User` (customer) has `name`, `phone_number`, and optional `default_address` (pre-fills order address). `Publisher` is a catalog of publishers (id, name unique). `Book` is a catalog entry linked to a publisher (publisher_id FK, ps_charge, total_price, deposit_amount) — no per-book status. `OrderBook` is the per-copy join record with its own auto-increment PK, per-copy `status` (BookStatus) and `deposit_amount`. `Order` has `postage_type` and `postage_amount` (nullable Numeric; auto-filled from POSTAGE_DEFAULTS when type is set without explicit amount), `postage_paid` (Boolean, default `False`), plus required `address` (String) and optional `note` (Text).

**Outstanding per copy**: `(book.total_price + PS_CHARGE_RATES[book.ps_charge]) - order_book.deposit_amount`. The `OrderBookResponse.total_price` field is this computed sum (book price + ps rate), not the raw `Book.total_price`. When an `OrderBook` is created, its `deposit_amount` is initialized from `book.deposit_amount`.

**Books-first workflow**: Books are catalog entries created first (via `POST /books/` with publisher_id + ps_charge + prices). Orders are created with `copies: list[{book_id, quantity}]` — each spec creates `quantity` separate `OrderBook` rows. Additional copies added via `POST /orders/{id}/books` with `{"copies": [...]}`. Per-copy status/deposit updated via `PATCH /orders/{order_id}/books/{ob_id}`.

`OrderDetail` includes denormalized `customer_name`, `customer_phone` from the related `User`, and `order_books: list[OrderBookResponse]`. `DashboardResponse` returns `book_status_counts: list[{status, count}]`, scalar `total_outstanding`, and `copies_with_outstanding: list[OrderBookResponse]` (all non-delivered copies with a remaining balance).

`_build_order_book_response` and `_build_order_detail` are both defined in `customers.py` and imported by `orders.py` and `dashboard.py`.

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
- **`app/(dashboard)/layout.tsx`** — Auth guard: checks session on mount via `supabase.auth.getSession()`, redirects to `/login` if none; listens for `SIGNED_OUT` event. Renders `<TopNav />` above `<main>`.
- **`app/(dashboard)/dashboard/page.tsx`** — Book status counts card grid + two tabbed views: "Event Day" (books with deposit/paid status grouped by publisher, expandable to show linked orders) and "Packaging & Shipping" (all active orders with address, postage, and outstanding balance). Tab sub-components live in `event-day-table.tsx` and `packaging-table.tsx`.
- **`app/(dashboard)/customers/`** — List with search + Add dialog; `[id]` shows customer orders.
- **`app/(dashboard)/orders/`** — List; `[id]` has inline editing of book status/deposit, cancel, address edit; `new/` is a 3-step stepper (customer → select existing books → delivery details).
- **`app/(dashboard)/books/page.tsx`** — Filterable books table with delete.
- **`lib/api.ts`** — Typed API client. `request<T>()` attaches `Authorization: Bearer <token>` from Supabase session. All CRUD functions live here.
- **`lib/auth.ts`** — Thin wrappers around `supabase.auth`: `signIn`, `signOut`, `getSession`, `getAccessToken`.
- **`lib/supabase.ts`** — Creates the Supabase JS client from env vars. Import `supabase` from here for direct auth access (e.g., in the layout).
- **`hooks/`** — TanStack Query hooks with cache invalidation on mutations. Per-file: `useBooks.ts` (`useBooks`, `useCreateBook`, `useUpdateBook`, `useDeleteBook`); `useCustomers.ts` (`useCustomers`, `useCustomer`, `useCreateCustomer`, `useUpdateCustomer`, `useDeleteCustomer`); `useOrders.ts` (`useOrders`, `useOrder`, `useCreateOrder`, `useUpdateOrder`, `useAddCopiesToOrder`, `useUpdateOrderBook`, `useCancelOrder`); `usePublishers.ts` (`usePublishers`, `useCreatePublisher`); `useDashboard.ts` (`useDashboard`).
- **`providers/QueryProvider.tsx`** — `QueryClient` with `staleTime: 30s`, `retry: 1`.
- **`components/PageShell.tsx`** — Standard page wrapper with title + optional action slot. Use for every dashboard page.
- **`components/AddBookDialog.tsx`** — Reusable dialog for creating a book catalog entry (title, publisher with inline create, ps_charge, total_price, deposit_amount). Accepts `onSuccess(book)` callback — used by books page and the new-order stepper.
- **`components/TopNav.tsx`** — Sticky horizontal nav bar (Dashboard/Customers/Orders/Books links) with animated active/hover indicators via `motion/react`, `ThemeSwitch`, and sign-out button. Used in the dashboard layout.
- **`components/Sidebar.tsx`** — Shadcn sidebar built with `components/ui/sidebar.tsx`. Installed but **not wired into the dashboard layout** — the layout uses `TopNav` instead. Do not add a second sidebar; update this one if a sidebar nav is ever needed.
- **`components/StatusBadge.tsx`** — Colored badge for `BookStatus`/`OrderStatus` values.
- **`components/PostageBadge.tsx`** — Colored badge for `PostageType` values.
- **`components/PriceSummary.tsx`** — Three-column Total/Deposit/Outstanding price display.
- **`components/ui/glowing-badge.tsx`** — `GlowingBadge` — animated pulsing badge with a blurred glow ring behind it. Variants: `default`, `success`, `warning`, `error`, `info`, `neutral`, `deposit`, `paid`, `bought`, `gold`, `purple`, `silver`. Accepts `dot` boolean prop to toggle the animated dot.
- **`components/ui/tabs.tsx`** — Base UI tabs wrapper. Named exports: `TabsRoot`, `TabsList`, `TabsTrigger`, `TabsContent`. Built on `@base-ui/react/tabs` (not shadcn Tabs).
- **`components/ui/data-table.tsx`** — TanStack Table wrapper with client-side sorting. Generic `DataTable<TData, TValue>` takes `columns: ColumnDef[]`, `data`, and optional `defaultSorting`.
- **`components/charts/`** — Custom chart library built on `@visx/*` + `d3-shape` + `motion/react`. Three chart families:
  - **Ring**: `RingChart` (container, `ParentSize`-responsive) + `Ring` (arc primitive) + `RingCenter` (animated center stat via `@number-flow/react`). Pass `data: RingData[]` (label/value/color).
  - **Pie**: `PieChart` + `PieSlice` + `PieCenter` / `PieCenterShell`. Uses `d3-shape` `pie()` layout internally.
  - **Bar**: `BarChart` + `Bar` + `BarXAxis` + `BarYAxis`. Scales via `@visx/scale`.
  - **Shared**: `ChartStatFlow` (animated number with `@number-flow/react`), `Legend` sub-components (`components/charts/legend/`), `ChartTooltip` sub-components (`components/charts/tooltip/`), `useChartInteraction`, `useMountProgress` hooks.
  - CSS theme vars live in `globals.css` under `--chart-*` and `--legend-*` prefixes (light + dark).

`lib/api.ts` also exports TypeScript types (`BookStatus`, `PostageType`, `PsChargeType`) and constants (`PS_CHARGE_RATES`) — import from there rather than redefining.

### Key Constraints

- The shadcn install uses `@base-ui/react/button`, which does **not** support `asChild`. Use `buttonVariants()` as `className` on a plain `<Link>` instead of wrapping `<Link>` in `<Button>`. If using shadcn `SidebarMenuButton`, use the `render` prop: `render={<Link href={href} />}`.
- Base UI Select's `onValueChange` passes `value | null` — always null-guard before using the value.
- Tabs use Base UI (`@base-ui/react/tabs`) via `components/ui/tabs.tsx`. Import `TabsRoot`, `TabsList`, `TabsTrigger`, `TabsContent` — do not use shadcn's `Tabs`.
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
