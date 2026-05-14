# Bookstore Inventory Management System — Design Spec
Date: 2026-05-14

## Overview

A web-based inventory management system for a personal shopper who buys and delivers books for customers. Replaces an Excel-based workflow. Order placement by customers is out of scope for now — this phase covers internal inventory tracking only.

---

## Users & Auth

- Small team (shopper + helpers), all with full access — no role differentiation
- Login via email + password (Supabase Auth)
- Supabase issues a JWT; FastAPI validates it on every request
- No custom `auth` table — Supabase Auth manages credentials entirely

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) + shadcn (tweakcn theme, IBM Plex fonts) |
| Backend | FastAPI |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (JWT) |
| Frontend hosting | Vercel |
| Backend hosting | TBD (Railway / Render / Fly.io) |

Frontend never talks to Supabase directly — all requests go through FastAPI. All inventory pages are client components (`"use client"`); no SSR needed for this phase.

---

## Architecture

```
Browser (Next.js App Router + shadcn)
    │
    │  REST (JSON) + Authorization: Bearer <JWT>
    ▼
FastAPI  ──── Supabase (Postgres + Auth)
```

---

## Database Schema

See `schema.dbml` for the full schema. Key design decisions:

- `outstanding_amount` is derived (`total_price - deposit_amount`), never stored
- Postage charge is derived from `postage_type` enum (premium=RM10, hard_cover=RM8, soft_cover=RM5), never stored as a number
- `order_status` enum: `active`, `cancelled`
- `book_status` enum: `deposit`, `paid`, `bought`, `under_delivery`, `delivered`, `cancelled`
- Books are never hard-deleted — cancellation sets status to `cancelled`

---

## Pages & Routes

Next.js App Router file-based routing:

| Route | File | Purpose |
|---|---|---|
| `/login` | `app/login/page.tsx` | Email + password login |
| `/` | `app/(dashboard)/page.tsx` | Dashboard |
| `/customers` | `app/(dashboard)/customers/page.tsx` | Customer list with search |
| `/customers/[id]` | `app/(dashboard)/customers/[id]/page.tsx` | Customer detail |
| `/orders` | `app/(dashboard)/orders/page.tsx` | Orders list |
| `/orders/new` | `app/(dashboard)/orders/new/page.tsx` | Guided 3-step new order flow |
| `/orders/[id]` | `app/(dashboard)/orders/[id]/page.tsx` | Order detail |
| `/books` | `app/(dashboard)/books/page.tsx` | Books list |

All routes under `(dashboard)` share a layout with the persistent sidebar. The `(dashboard)` route group has a `layout.tsx` that renders the sidebar and wraps content in `PageShell`. Auth guard lives in this layout — redirects to `/login` if no session.

A global **New Order** button in the sidebar header is always one click away.

---

## New Order Flow (3 Steps)

1. **Customer** — search by name or phone; create new if not found
2. **Order details** — address, postage type (optional), note
3. **Books** — repeatable rows: title, author, status, total price, deposit amount

Submitted as a single transaction. Books cannot be created outside an order.

---

## Order Cancellation

- `PATCH /orders/:id/cancel` sets the order to `cancelled` and all its books to `cancelled` in one transaction
- Cancelled orders remain visible in the orders list (muted style) for historical reference
- No partial cancellation — cancel the whole order or individual books are edited directly

---

## API Endpoints

```
# Dashboard
GET  /dashboard              — counts by book status, total outstanding amount

# Customers
GET  /customers              — list, search by name/phone
POST /customers              — create
GET  /customers/:id          — detail with orders and books

# Orders
GET  /orders                 — list, filter by status/postage/date
POST /orders                 — create order + books in one transaction
GET  /orders/:id             — detail with books, prices, address
PATCH /orders/:id            — update order fields
PATCH /orders/:id/cancel     — cancel order and all child books

# Books
GET  /books                  — list, filter by status / outstanding > 0
PATCH /books/:id             — update status, price, deposit
DELETE /books/:id            — remove book from order; only allowed when parent order is active
```

---

## Frontend Structure

```
frontend/
  app/
    layout.tsx                        — root layout: IBM Plex fonts, globals.css
    login/
      page.tsx                        — login page (client component)
    (dashboard)/
      layout.tsx                      — auth guard + sidebar shell
      page.tsx                        — dashboard
      customers/
        page.tsx
        [id]/page.tsx
      orders/
        page.tsx
        new/page.tsx
        [id]/page.tsx
      books/
        page.tsx
  components/
    layout/
      Sidebar.tsx                     — nav links + New Order button
      PageShell.tsx                   — page title + content wrapper
    shared/
      StatusBadge.tsx                 — colour-coded pill for book/order status
      PriceSummary.tsx                — total / deposit / outstanding display
      PostageBadge.tsx                — postage type + derived RM amount
      DataTable.tsx                   — shadcn table wrapper with filters
    orders/
      NewOrderStepper.tsx             — 3-step form (customer → order → books)
  lib/
    api.ts                            — typed fetch wrappers for all endpoints
    auth.ts                           — Supabase client + session helpers
  hooks/
    useDashboard.ts
    useCustomers.ts
    useOrders.ts
    useBooks.ts
  providers/
    QueryProvider.tsx                 — TanStack Query client wrapper
```

- All `page.tsx` files under `(dashboard)` are `"use client"` components
- **State** — TanStack Query for server state, local `useState` for the NewOrder stepper steps; no global state library
- **Fonts** — IBM Plex Sans / Serif / Mono via `next/font/google`, CSS variables `--font-sans`, `--font-serif`, `--font-mono`

---

## Dashboard Content

- Summary cards: count of books per status (deposit, paid, bought, under delivery, delivered)
- Total outstanding amount (RM) across all active orders
- Table of books with outstanding balance > 0, sorted by oldest first

---

## Out of Scope (This Phase)

- Customer-facing login or order placement
- Export / CSV download (nice to have, future)
- Notifications or reminders
- Mobile app
