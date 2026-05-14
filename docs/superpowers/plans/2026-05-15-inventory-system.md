# Bookstore Inventory Management System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack inventory management system for a personal book shopper — FastAPI backend + Next.js frontend with Supabase for database and auth.

**Architecture:** FastAPI REST API authenticated via Supabase JWT; Next.js App Router SPA (all client components) talks only to FastAPI; Supabase Postgres stores all data; Supabase Auth issues JWTs.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy (async), asyncpg, python-jose, pydantic-settings, pytest, httpx | Next.js 14 (App Router), TypeScript, shadcn/ui, TanStack Query v5, @supabase/supabase-js, IBM Plex fonts via next/font

---

## File Map

### Backend (`backend/`)
```
backend/
  app/
    __init__.py
    main.py            — FastAPI app, CORS, router registration
    config.py          — pydantic-settings (DATABASE_URL, SUPABASE_JWT_SECRET)
    database.py        — async SQLAlchemy engine + get_db dependency
    auth.py            — JWT bearer dependency
    models.py          — SQLAlchemy ORM models + enums + POSTAGE_RATES
    schemas.py         — Pydantic request/response models
    routers/
      __init__.py
      customers.py
      orders.py
      books.py
      dashboard.py
  tests/
    conftest.py        — async test client + test DB session
    test_customers.py
    test_orders.py
    test_books.py
    test_dashboard.py
  requirements.txt
  .env.example
```

### Frontend (`frontend/`)
```
frontend/
  app/
    layout.tsx                     — root layout: fonts + QueryProvider
    login/page.tsx                 — email/password login
    (dashboard)/
      layout.tsx                   — auth guard + sidebar shell
      page.tsx                     — dashboard
      customers/
        page.tsx
        [id]/page.tsx
      orders/
        page.tsx
        new/page.tsx
        [id]/page.tsx
      books/page.tsx
  components/
    layout/
      Sidebar.tsx
      PageShell.tsx
    shared/
      StatusBadge.tsx
      PriceSummary.tsx
      PostageBadge.tsx
      DataTable.tsx
    orders/
      NewOrderStepper.tsx
  lib/
    api.ts
    auth.ts
  hooks/
    useDashboard.ts
    useCustomers.ts
    useOrders.ts
    useBooks.ts
  providers/
    QueryProvider.tsx
```

---

## Phase 1: Project Setup

### Task 1: Initialise git and backend project

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`

- [ ] **Step 1: Initialise git repo**

```bash
cd /home/afif/bookstore
git init
echo "__pycache__/\n*.pyc\n.env\n.venv/\ndist/\n.next/\nnode_modules/" > .gitignore
```

- [ ] **Step 2: Create backend folder and requirements**

```bash
mkdir -p backend/app/routers backend/tests
touch backend/app/__init__.py backend/app/routers/__init__.py
```

`backend/requirements.txt`:
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
python-jose[cryptography]==3.3.0
pydantic-settings==2.2.1
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.7
```

- [ ] **Step 3: Create config**

`backend/app/config.py`:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_JWT_SECRET: str
    model_config = {"env_file": ".env"}

settings = Settings()
```

- [ ] **Step 4: Create .env.example**

`backend/.env.example`:
```
DATABASE_URL=postgresql+asyncpg://postgres:<password>@db.<project>.supabase.co:5432/postgres
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
```

- [ ] **Step 5: Create main.py**

`backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Bookstore Inventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 6: Install dependencies and verify server starts**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in real values
uvicorn app.main:app --reload
```

Expected: `Uvicorn running on http://127.0.0.1:8000`

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: initialise backend project structure"
```

---

### Task 2: Initialise Next.js frontend with shadcn and tweakcn theme

**Files:**
- Create: `frontend/` (full Next.js project)
- Create: `frontend/app/layout.tsx`
- Create: `frontend/providers/QueryProvider.tsx`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /home/afif/bookstore
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd frontend
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools @supabase/supabase-js
npx shadcn@latest init
```

When shadcn asks for style: choose **Default**. Base color: **Neutral**. CSS variables: **yes**.

- [ ] **Step 3: Apply tweakcn theme fonts**

`frontend/app/layout.tsx` (replace generated file):
```tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";

const fontSans = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "500", "600", "700"] });
const fontSerif = IBM_Plex_Serif({ subsets: ["latin"], variable: "--font-serif", weight: ["400", "600"] });
const fontMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = { title: "Bookstore Inventory" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Create QueryProvider**

`frontend/providers/QueryProvider.tsx`:
```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 1000 * 30 } }
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 5: Create .env.local**

`frontend/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: App running at `http://localhost:3000`

- [ ] **Step 7: Commit**

```bash
cd /home/afif/bookstore
git add frontend/
git commit -m "feat: initialise Next.js frontend with shadcn and IBM Plex fonts"
```

---

### Task 3: Supabase — apply schema and configure auth

**Files:**
- Read: `schema.dbml` (reference only)

- [ ] **Step 1: Apply schema in Supabase SQL editor**

Open Supabase dashboard → SQL editor. Run:

```sql
CREATE TYPE book_status AS ENUM ('deposit','paid','bought','under_delivery','delivered','cancelled');
CREATE TYPE order_status AS ENUM ('active','cancelled');
CREATE TYPE postage_type AS ENUM ('premium','hard_cover','soft_cover');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  phone_number VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status order_status NOT NULL DEFAULT 'active',
  postage_type postage_type,
  address VARCHAR NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  title VARCHAR NOT NULL,
  author VARCHAR,
  status book_status NOT NULL DEFAULT 'deposit',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE prices (
  id SERIAL PRIMARY KEY,
  book_id INTEGER UNIQUE NOT NULL REFERENCES books(id),
  total_price NUMERIC(10,2) NOT NULL,
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE order_books (
  order_id INTEGER NOT NULL REFERENCES orders(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  PRIMARY KEY (order_id, book_id)
);
```

- [ ] **Step 2: Configure Supabase Auth**

In Supabase dashboard → Authentication → Settings:
- Disable email confirmations (internal tool, no confirmation needed)
- Note the **JWT Secret** from Settings → API → JWT Secret

- [ ] **Step 3: Create team member accounts**

In Supabase dashboard → Authentication → Users → Invite user. Add email + set password for each team member.

- [ ] **Step 4: Add real values to backend .env**

```
DATABASE_URL=postgresql+asyncpg://postgres:<password>@db.<project>.supabase.co:5432/postgres
SUPABASE_JWT_SECRET=<jwt-secret-from-dashboard>
```

- [ ] **Step 5: Commit**

```bash
git add schema.dbml
git commit -m "feat: apply database schema to Supabase"
```

---

## Phase 2: Backend

### Task 4: Database connection + ORM models

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models.py`

- [ ] **Step 1: Write failing test**

`backend/tests/conftest.py`:
```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.database import get_db
from app.models import Base

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
```

`backend/tests/test_customers.py`:
```python
import pytest

@pytest.mark.asyncio
async def test_models_import():
    from app.models import User, Order, Book, Price, OrderBook
    assert User.__tablename__ == "users"
```

- [ ] **Step 2: Run test — expect ImportError (models don't exist yet)**

```bash
cd backend && source .venv/bin/activate
pip install aiosqlite  # for in-memory test DB
pytest tests/test_customers.py::test_models_import -v
```

Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Create database.py**

`backend/app/database.py`:
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 4: Create models.py**

`backend/app/models.py`:
```python
import enum
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func

class Base(DeclarativeBase):
    pass

class BookStatus(str, enum.Enum):
    deposit = "deposit"
    paid = "paid"
    bought = "bought"
    under_delivery = "under_delivery"
    delivered = "delivered"
    cancelled = "cancelled"

class OrderStatus(str, enum.Enum):
    active = "active"
    cancelled = "cancelled"

class PostageType(str, enum.Enum):
    premium = "premium"
    hard_cover = "hard_cover"
    soft_cover = "soft_cover"

POSTAGE_RATES: dict[PostageType, float] = {
    PostageType.premium: 10.00,
    PostageType.hard_cover: 8.00,
    PostageType.soft_cover: 5.00,
}

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    orders = relationship("Order", back_populates="user")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(OrderStatus, name="order_status"), nullable=False, default=OrderStatus.active)
    postage_type = Column(Enum(PostageType, name="postage_type"), nullable=True)
    address = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    user = relationship("User", back_populates="orders")
    order_books = relationship("OrderBook", back_populates="order", cascade="all, delete-orphan")

class Book(Base):
    __tablename__ = "books"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    status = Column(Enum(BookStatus, name="book_status"), nullable=False, default=BookStatus.deposit)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    price = relationship("Price", back_populates="book", uselist=False, cascade="all, delete-orphan")
    order_books = relationship("OrderBook", back_populates="book")

class Price(Base):
    __tablename__ = "prices"
    id = Column(Integer, primary_key=True, autoincrement=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False, unique=True)
    total_price = Column(Numeric(10, 2), nullable=False)
    deposit_amount = Column(Numeric(10, 2), nullable=False, default=0)
    book = relationship("Book", back_populates="price")

    @property
    def outstanding_amount(self) -> float:
        return float(self.total_price) - float(self.deposit_amount)

class OrderBook(Base):
    __tablename__ = "order_books"
    order_id = Column(Integer, ForeignKey("orders.id"), primary_key=True)
    book_id = Column(Integer, ForeignKey("books.id"), primary_key=True)
    order = relationship("Order", back_populates="order_books")
    book = relationship("Book", back_populates="order_books")
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pytest tests/test_customers.py::test_models_import -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/database.py backend/app/models.py backend/tests/conftest.py
git commit -m "feat: add SQLAlchemy models and test database fixture"
```

---

### Task 5: Pydantic schemas

**Files:**
- Create: `backend/app/schemas.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_customers.py`:
```python
def test_schemas_import():
    from app.schemas import CustomerCreate, CustomerResponse, OrderCreate, BookCreate, PriceCreate, DashboardResponse
    c = CustomerCreate(name="Ali", phone_number="0123456789")
    assert c.name == "Ali"
```

- [ ] **Step 2: Run test — expect ImportError**

```bash
pytest tests/test_customers.py::test_schemas_import -v
```

Expected: FAIL

- [ ] **Step 3: Create schemas.py**

`backend/app/schemas.py`:
```python
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.models import BookStatus, OrderStatus, PostageType

class CustomerCreate(BaseModel):
    name: str
    phone_number: str

class CustomerResponse(BaseModel):
    id: int
    name: str
    phone_number: str
    created_at: datetime
    model_config = {"from_attributes": True}

class PriceCreate(BaseModel):
    total_price: Decimal
    deposit_amount: Decimal = Decimal("0")

class PriceResponse(BaseModel):
    total_price: Decimal
    deposit_amount: Decimal
    outstanding_amount: float
    model_config = {"from_attributes": True}

class BookCreate(BaseModel):
    title: str
    author: Optional[str] = None
    status: BookStatus = BookStatus.deposit
    price: PriceCreate

class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    status: Optional[BookStatus] = None
    total_price: Optional[Decimal] = None
    deposit_amount: Optional[Decimal] = None

class BookResponse(BaseModel):
    id: int
    title: str
    author: Optional[str]
    status: BookStatus
    created_at: datetime
    updated_at: Optional[datetime]
    price: Optional[PriceResponse]
    model_config = {"from_attributes": True}

class OrderCreate(BaseModel):
    user_id: int
    postage_type: Optional[PostageType] = None
    address: str
    note: Optional[str] = None
    books: list[BookCreate]

class OrderUpdate(BaseModel):
    postage_type: Optional[PostageType] = None
    address: Optional[str] = None
    note: Optional[str] = None

class OrderResponse(BaseModel):
    id: int
    user_id: int
    status: OrderStatus
    postage_type: Optional[PostageType]
    address: str
    note: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    model_config = {"from_attributes": True}

class OrderDetail(OrderResponse):
    books: list[BookResponse]
    postage_charge: Optional[float]
    total_outstanding: float

class CustomerDetail(CustomerResponse):
    orders: list[OrderDetail]

class BookStatusCount(BaseModel):
    status: BookStatus
    count: int

class DashboardResponse(BaseModel):
    book_status_counts: list[BookStatusCount]
    total_outstanding: float
    books_with_outstanding: list[BookResponse]
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pytest tests/test_customers.py -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat: add Pydantic schemas"
```

---

### Task 6: Auth middleware

**Files:**
- Create: `backend/app/auth.py`

- [ ] **Step 1: Write failing test**

`backend/tests/test_auth.py`:
```python
import pytest
from unittest.mock import patch
from fastapi import HTTPException

@pytest.mark.asyncio
async def test_valid_token_returns_user_id():
    from app.auth import get_current_user
    from fastapi.security import HTTPAuthorizationCredentials

    fake_payload = {"sub": "user-uuid-123"}
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="fake.token.here")

    with patch("app.auth.jwt.decode", return_value=fake_payload):
        result = await get_current_user(credentials)
    assert result == "user-uuid-123"

@pytest.mark.asyncio
async def test_invalid_token_raises_401():
    from app.auth import get_current_user
    from app.auth import JWTError
    from fastapi.security import HTTPAuthorizationCredentials

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad.token")

    with patch("app.auth.jwt.decode", side_effect=JWTError("bad")):
        with pytest.raises(HTTPException) as exc:
            await get_current_user(credentials)
    assert exc.value.status_code == 401
```

- [ ] **Step 2: Run tests — expect ImportError**

```bash
pytest tests/test_auth.py -v
```

Expected: FAIL

- [ ] **Step 3: Create auth.py**

`backend/app/auth.py`:
```python
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config import settings

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pytest tests/test_auth.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/auth.py backend/tests/test_auth.py
git commit -m "feat: add JWT auth middleware"
```

---

### Task 7: Customer endpoints

**Files:**
- Create: `backend/app/routers/customers.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_customers.py` (replace file):
```python
import pytest
from unittest.mock import patch

@pytest.mark.asyncio
async def test_create_customer(client):
    with patch("app.routers.customers.get_current_user", return_value="uid"):
        resp = await client.post("/customers/", json={"name": "Amir", "phone_number": "0123456789"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "Amir"

@pytest.mark.asyncio
async def test_list_customers(client):
    with patch("app.routers.customers.get_current_user", return_value="uid"):
        await client.post("/customers/", json={"name": "Amir", "phone_number": "011"})
        resp = await client.get("/customers/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

@pytest.mark.asyncio
async def test_search_customers(client):
    with patch("app.routers.customers.get_current_user", return_value="uid"):
        await client.post("/customers/", json={"name": "Zara", "phone_number": "012"})
        resp = await client.get("/customers/?search=zar")
    assert resp.status_code == 200
    assert resp.json()[0]["name"] == "Zara"

@pytest.mark.asyncio
async def test_get_customer_not_found(client):
    with patch("app.routers.customers.get_current_user", return_value="uid"):
        resp = await client.get("/customers/999")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests — expect 404 route not found**

```bash
pytest tests/test_customers.py -v
```

Expected: FAIL

- [ ] **Step 3: Create customers router**

`backend/app/routers/customers.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Order, OrderBook, Book
from app.schemas import CustomerCreate, CustomerResponse, CustomerDetail, OrderDetail, BookResponse, PriceResponse
from app.models import POSTAGE_RATES

router = APIRouter()

def _build_order_detail(order: Order) -> OrderDetail:
    books = [
        BookResponse(
            id=ob.book.id,
            title=ob.book.title,
            author=ob.book.author,
            status=ob.book.status,
            created_at=ob.book.created_at,
            updated_at=ob.book.updated_at,
            price=PriceResponse(
                total_price=ob.book.price.total_price,
                deposit_amount=ob.book.price.deposit_amount,
                outstanding_amount=ob.book.price.outstanding_amount,
            ) if ob.book.price else None,
        )
        for ob in order.order_books
    ]
    total_outstanding = sum(b.price.outstanding_amount for b in books if b.price)
    postage_charge = POSTAGE_RATES.get(order.postage_type) if order.postage_type else None
    return OrderDetail(
        id=order.id,
        user_id=order.user_id,
        status=order.status,
        postage_type=order.postage_type,
        address=order.address,
        note=order.note,
        created_at=order.created_at,
        updated_at=order.updated_at,
        books=books,
        postage_charge=postage_charge,
        total_outstanding=total_outstanding,
    )

@router.get("/", response_model=list[CustomerResponse])
async def list_customers(
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    query = select(User)
    if search:
        query = query.where(
            (User.name.ilike(f"%{search}%")) | (User.phone_number.ilike(f"%{search}%"))
        )
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=CustomerResponse, status_code=201)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    user = User(**data.model_dump())
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/{customer_id}", response_model=CustomerDetail)
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.orders)
            .selectinload(Order.order_books)
            .selectinload(OrderBook.book)
            .selectinload(Book.price)
        )
        .where(User.id == customer_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    orders = [_build_order_detail(o) for o in user.orders]
    return CustomerDetail(
        id=user.id,
        name=user.name,
        phone_number=user.phone_number,
        created_at=user.created_at,
        orders=orders,
    )
```

- [ ] **Step 4: Register router in main.py**

`backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import customers

app = FastAPI(title="Bookstore Inventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customers.router, prefix="/customers", tags=["customers"])
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pytest tests/test_customers.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/customers.py backend/app/main.py backend/tests/test_customers.py
git commit -m "feat: add customer endpoints"
```

---

### Task 8: Orders endpoints

**Files:**
- Create: `backend/app/routers/orders.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_orders.py`:
```python
import pytest
from unittest.mock import patch

ORDER_PAYLOAD = {
    "user_id": None,  # filled in fixture
    "address": "123 Jalan Test",
    "postage_type": "premium",
    "books": [
        {"title": "Dune", "author": "Herbert", "status": "deposit",
         "price": {"total_price": "50.00", "deposit_amount": "10.00"}}
    ]
}

async def _create_customer(client):
    with patch("app.routers.customers.get_current_user", return_value="uid"):
        r = await client.post("/customers/", json={"name": "Test", "phone_number": "011"})
    return r.json()["id"]

@pytest.mark.asyncio
async def test_create_order(client):
    cid = await _create_customer(client)
    payload = {**ORDER_PAYLOAD, "user_id": cid}
    with patch("app.routers.orders.get_current_user", return_value="uid"):
        resp = await client.post("/orders/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["address"] == "123 Jalan Test"
    assert len(data["books"]) == 1
    assert data["books"][0]["price"]["outstanding_amount"] == 40.0
    assert data["postage_charge"] == 10.0

@pytest.mark.asyncio
async def test_list_orders(client):
    cid = await _create_customer(client)
    payload = {**ORDER_PAYLOAD, "user_id": cid}
    with patch("app.routers.orders.get_current_user", return_value="uid"):
        await client.post("/orders/", json=payload)
        resp = await client.get("/orders/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

@pytest.mark.asyncio
async def test_update_order_address(client):
    cid = await _create_customer(client)
    payload = {**ORDER_PAYLOAD, "user_id": cid}
    with patch("app.routers.orders.get_current_user", return_value="uid"):
        order = (await client.post("/orders/", json=payload)).json()
        resp = await client.patch(f"/orders/{order['id']}", json={"address": "456 Jalan Baru"})
    assert resp.status_code == 200
    assert resp.json()["address"] == "456 Jalan Baru"

@pytest.mark.asyncio
async def test_cancel_order(client):
    cid = await _create_customer(client)
    payload = {**ORDER_PAYLOAD, "user_id": cid}
    with patch("app.routers.orders.get_current_user", return_value="uid"):
        order = (await client.post("/orders/", json=payload)).json()
        resp = await client.patch(f"/orders/{order['id']}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert resp.json()["books"][0]["status"] == "cancelled"
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pytest tests/test_orders.py -v
```

Expected: FAIL

- [ ] **Step 3: Create orders router**

`backend/app/routers/orders.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import Order, Book, Price, OrderBook, OrderStatus, BookStatus, POSTAGE_RATES
from app.schemas import OrderCreate, OrderUpdate, OrderDetail, BookResponse, PriceResponse
from app.routers.customers import _build_order_detail

router = APIRouter()

async def _load_order(order_id: int, db: AsyncSession) -> Order:
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.order_books)
            .selectinload(OrderBook.book)
            .selectinload(Book.price)
        )
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.get("/", response_model=list[OrderDetail])
async def list_orders(
    status: str | None = None,
    postage_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    query = select(Order).options(
        selectinload(Order.order_books).selectinload(OrderBook.book).selectinload(Book.price)
    )
    if status:
        query = query.where(Order.status == status)
    if postage_type:
        query = query.where(Order.postage_type == postage_type)
    result = await db.execute(query)
    return [_build_order_detail(o) for o in result.scalars().all()]

@router.post("/", response_model=OrderDetail, status_code=201)
async def create_order(
    data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    order = Order(
        user_id=data.user_id,
        postage_type=data.postage_type,
        address=data.address,
        note=data.note,
    )
    db.add(order)
    await db.flush()

    for book_data in data.books:
        book = Book(title=book_data.title, author=book_data.author, status=book_data.status)
        db.add(book)
        await db.flush()
        price = Price(
            book_id=book.id,
            total_price=book_data.price.total_price,
            deposit_amount=book_data.price.deposit_amount,
        )
        db.add(price)
        db.add(OrderBook(order_id=order.id, book_id=book.id))

    await db.commit()
    return _build_order_detail(await _load_order(order.id, db))

@router.get("/{order_id}", response_model=OrderDetail)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return _build_order_detail(await _load_order(order_id, db))

@router.patch("/{order_id}", response_model=OrderDetail)
async def update_order(
    order_id: int,
    data: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    order = await _load_order(order_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    await db.commit()
    return _build_order_detail(await _load_order(order_id, db))

@router.patch("/{order_id}/cancel", response_model=OrderDetail)
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    order = await _load_order(order_id, db)
    order.status = OrderStatus.cancelled
    for ob in order.order_books:
        ob.book.status = BookStatus.cancelled
    await db.commit()
    return _build_order_detail(await _load_order(order_id, db))
```

- [ ] **Step 4: Register router in main.py**

Add to `backend/app/main.py`:
```python
from app.routers import customers, orders

app.include_router(orders.router, prefix="/orders", tags=["orders"])
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pytest tests/test_orders.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/orders.py backend/app/main.py backend/tests/test_orders.py
git commit -m "feat: add order endpoints including cancellation"
```

---

### Task 9: Books endpoints

**Files:**
- Create: `backend/app/routers/books.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_books.py`:
```python
import pytest
from unittest.mock import patch

async def _seed(client):
    with patch("app.routers.customers.get_current_user", return_value="uid"):
        cid = (await client.post("/customers/", json={"name": "T", "phone_number": "0"})).json()["id"]
    with patch("app.routers.orders.get_current_user", return_value="uid"):
        order = (await client.post("/orders/", json={
            "user_id": cid, "address": "Addr",
            "books": [{"title": "Book A", "status": "deposit",
                       "price": {"total_price": "30.00", "deposit_amount": "5.00"}}]
        })).json()
    return order["books"][0]["id"]

@pytest.mark.asyncio
async def test_list_books(client):
    await _seed(client)
    with patch("app.routers.books.get_current_user", return_value="uid"):
        resp = await client.get("/books/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

@pytest.mark.asyncio
async def test_update_book_status(client):
    book_id = await _seed(client)
    with patch("app.routers.books.get_current_user", return_value="uid"):
        resp = await client.patch(f"/books/{book_id}", json={"status": "paid"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"

@pytest.mark.asyncio
async def test_update_book_price(client):
    book_id = await _seed(client)
    with patch("app.routers.books.get_current_user", return_value="uid"):
        resp = await client.patch(f"/books/{book_id}", json={"deposit_amount": "15.00"})
    assert resp.json()["price"]["outstanding_amount"] == 15.0

@pytest.mark.asyncio
async def test_delete_book_from_active_order(client):
    book_id = await _seed(client)
    with patch("app.routers.books.get_current_user", return_value="uid"):
        resp = await client.delete(f"/books/{book_id}")
    assert resp.status_code == 204
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pytest tests/test_books.py -v
```

Expected: FAIL

- [ ] **Step 3: Create books router**

`backend/app/routers/books.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import Book, Price, OrderBook, Order, OrderStatus
from app.schemas import BookUpdate, BookResponse, PriceResponse

router = APIRouter()

async def _load_book(book_id: int, db: AsyncSession) -> Book:
    result = await db.execute(
        select(Book).options(selectinload(Book.price)).where(Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

def _book_response(book: Book) -> BookResponse:
    return BookResponse(
        id=book.id, title=book.title, author=book.author,
        status=book.status, created_at=book.created_at, updated_at=book.updated_at,
        price=PriceResponse(
            total_price=book.price.total_price,
            deposit_amount=book.price.deposit_amount,
            outstanding_amount=book.price.outstanding_amount,
        ) if book.price else None,
    )

@router.get("/", response_model=list[BookResponse])
async def list_books(
    status: str | None = None,
    outstanding_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    query = select(Book).options(selectinload(Book.price))
    if status:
        query = query.where(Book.status == status)
    result = await db.execute(query)
    books = result.scalars().all()
    if outstanding_only:
        books = [b for b in books if b.price and b.price.outstanding_amount > 0]
    return [_book_response(b) for b in books]

@router.patch("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: int,
    data: BookUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    book = await _load_book(book_id, db)
    if data.title is not None:
        book.title = data.title
    if data.author is not None:
        book.author = data.author
    if data.status is not None:
        book.status = data.status
    if book.price:
        if data.total_price is not None:
            book.price.total_price = data.total_price
        if data.deposit_amount is not None:
            book.price.deposit_amount = data.deposit_amount
    await db.commit()
    return _book_response(await _load_book(book_id, db))

@router.delete("/{book_id}", status_code=204)
async def delete_book(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(OrderBook)
        .options(selectinload(OrderBook.order))
        .where(OrderBook.book_id == book_id)
    )
    ob = result.scalar_one_or_none()
    if ob and ob.order.status != OrderStatus.active:
        raise HTTPException(status_code=400, detail="Cannot delete book from a cancelled order")
    book = await _load_book(book_id, db)
    await db.delete(book)
    await db.commit()
```

- [ ] **Step 4: Register router in main.py**

Add to `backend/app/main.py`:
```python
from app.routers import customers, orders, books

app.include_router(books.router, prefix="/books", tags=["books"])
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pytest tests/test_books.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/books.py backend/app/main.py backend/tests/test_books.py
git commit -m "feat: add books endpoints"
```

---

### Task 10: Dashboard endpoint

**Files:**
- Create: `backend/app/routers/dashboard.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing test**

`backend/tests/test_dashboard.py`:
```python
import pytest
from unittest.mock import patch

async def _seed(client):
    with patch("app.routers.customers.get_current_user", return_value="uid"):
        cid = (await client.post("/customers/", json={"name": "T", "phone_number": "0"})).json()["id"]
    with patch("app.routers.orders.get_current_user", return_value="uid"):
        await client.post("/orders/", json={
            "user_id": cid, "address": "A",
            "books": [
                {"title": "B1", "status": "deposit", "price": {"total_price": "50.00", "deposit_amount": "10.00"}},
                {"title": "B2", "status": "delivered", "price": {"total_price": "30.00", "deposit_amount": "30.00"}},
            ]
        })

@pytest.mark.asyncio
async def test_dashboard(client):
    await _seed(client)
    with patch("app.routers.dashboard.get_current_user", return_value="uid"):
        resp = await client.get("/dashboard/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_outstanding"] == 40.0
    assert len(data["books_with_outstanding"]) == 1
    statuses = {s["status"]: s["count"] for s in data["book_status_counts"]}
    assert statuses["deposit"] == 1
    assert statuses["delivered"] == 1
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pytest tests/test_dashboard.py -v
```

Expected: FAIL

- [ ] **Step 3: Create dashboard router**

`backend/app/routers/dashboard.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import Book, Price, BookStatus
from app.schemas import DashboardResponse, BookStatusCount, BookResponse, PriceResponse

router = APIRouter()

@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    count_result = await db.execute(
        select(Book.status, func.count(Book.id)).group_by(Book.status)
    )
    status_counts = [BookStatusCount(status=row[0], count=row[1]) for row in count_result]

    books_result = await db.execute(
        select(Book).options(selectinload(Book.price))
    )
    all_books = books_result.scalars().all()

    outstanding_books = [b for b in all_books if b.price and b.price.outstanding_amount > 0]
    total_outstanding = sum(b.price.outstanding_amount for b in outstanding_books)

    def _resp(b: Book) -> BookResponse:
        return BookResponse(
            id=b.id, title=b.title, author=b.author,
            status=b.status, created_at=b.created_at, updated_at=b.updated_at,
            price=PriceResponse(
                total_price=b.price.total_price,
                deposit_amount=b.price.deposit_amount,
                outstanding_amount=b.price.outstanding_amount,
            ) if b.price else None,
        )

    return DashboardResponse(
        book_status_counts=status_counts,
        total_outstanding=total_outstanding,
        books_with_outstanding=sorted(
            [_resp(b) for b in outstanding_books],
            key=lambda b: b.created_at,
        ),
    )
```

- [ ] **Step 4: Register router in main.py**

Final `backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import customers, orders, books, dashboard

app = FastAPI(title="Bookstore Inventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customers.router, prefix="/customers", tags=["customers"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(books.router, prefix="/books", tags=["books"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
```

- [ ] **Step 5: Run all backend tests**

```bash
pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/dashboard.py backend/app/main.py backend/tests/test_dashboard.py
git commit -m "feat: add dashboard endpoint — backend complete"
```

---

## Phase 3: Frontend

### Task 11: Auth — Supabase client, login page, auth guard

**Files:**
- Create: `frontend/lib/auth.ts`
- Create: `frontend/app/login/page.tsx`
- Create: `frontend/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create auth helpers**

`frontend/lib/auth.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}
```

- [ ] **Step 2: Create login page**

`frontend/app/login/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Bookstore</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Install required shadcn components**

```bash
cd frontend
npx shadcn@latest add button input label card
```

- [ ] **Step 4: Create dashboard layout with auth guard**

`frontend/app/(dashboard)/layout.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login");
      else setChecking(false);
    });
  }, [router]);

  if (checking) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd /home/afif/bookstore
git add frontend/lib/auth.ts frontend/app/login/ frontend/app/\(dashboard\)/layout.tsx
git commit -m "feat: add Supabase auth, login page, and dashboard auth guard"
```

---

### Task 12: Layout components — Sidebar and PageShell

**Files:**
- Create: `frontend/components/layout/Sidebar.tsx`
- Create: `frontend/components/layout/PageShell.tsx`

- [ ] **Step 1: Install shadcn components**

```bash
cd frontend
npx shadcn@latest add separator
```

- [ ] **Step 2: Create Sidebar**

`frontend/components/layout/Sidebar.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, ShoppingBag, BookOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/books", label: "Books", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="w-56 border-r flex flex-col py-4 px-3 shrink-0">
      <p className="font-serif text-lg font-semibold px-2 mb-4">Bookstore</p>
      <Button asChild size="sm" className="mb-4">
        <Link href="/orders/new">+ New Order</Link>
      </Button>
      <Separator className="mb-3" />
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
              pathname === href && "bg-accent font-medium"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start gap-2"
        onClick={async () => { await signOut(); router.push("/login"); }}
      >
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </aside>
  );
}
```

- [ ] **Step 3: Create PageShell**

`frontend/components/layout/PageShell.tsx`:
```tsx
interface PageShellProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function PageShell({ title, action, children }: PageShellProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">{title}</h1>
        {action}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/afif/bookstore
git add frontend/components/layout/
git commit -m "feat: add Sidebar and PageShell layout components"
```

---

### Task 13: Shared components — StatusBadge, PriceSummary, PostageBadge, DataTable

**Files:**
- Create: `frontend/components/shared/StatusBadge.tsx`
- Create: `frontend/components/shared/PriceSummary.tsx`
- Create: `frontend/components/shared/PostageBadge.tsx`
- Create: `frontend/components/shared/DataTable.tsx`

- [ ] **Step 1: Install shadcn components**

```bash
cd frontend
npx shadcn@latest add badge table
```

- [ ] **Step 2: Create StatusBadge**

`frontend/components/shared/StatusBadge.tsx`:
```tsx
import { Badge } from "@/components/ui/badge";

type BookStatus = "deposit" | "paid" | "bought" | "under_delivery" | "delivered" | "cancelled";
type OrderStatus = "active" | "cancelled";

const BOOK_COLORS: Record<BookStatus, string> = {
  deposit: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  bought: "bg-purple-100 text-purple-800",
  under_delivery: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500 line-through",
};

const BOOK_LABELS: Record<BookStatus, string> = {
  deposit: "Deposit",
  paid: "Paid",
  bought: "Bought",
  under_delivery: "Under Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function BookStatusBadge({ status }: { status: BookStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BOOK_COLORS[status]}`}>
      {BOOK_LABELS[status]}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={status === "active" ? "default" : "secondary"}>
      {status === "active" ? "Active" : "Cancelled"}
    </Badge>
  );
}
```

- [ ] **Step 3: Create PriceSummary**

`frontend/components/shared/PriceSummary.tsx`:
```tsx
interface PriceSummaryProps {
  totalPrice: number;
  depositAmount: number;
  outstandingAmount: number;
}

export function PriceSummary({ totalPrice, depositAmount, outstandingAmount }: PriceSummaryProps) {
  return (
    <div className="text-sm space-y-0.5">
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Total</span>
        <span>RM {totalPrice.toFixed(2)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Deposit</span>
        <span>RM {depositAmount.toFixed(2)}</span>
      </div>
      <div className="flex justify-between gap-4 font-medium">
        <span>Outstanding</span>
        <span className={outstandingAmount > 0 ? "text-destructive" : "text-green-600"}>
          RM {outstandingAmount.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create PostageBadge**

`frontend/components/shared/PostageBadge.tsx`:
```tsx
type PostageType = "premium" | "hard_cover" | "soft_cover";

const POSTAGE_LABELS: Record<PostageType, string> = {
  premium: "Premium",
  hard_cover: "Hard Cover",
  soft_cover: "Soft Cover",
};

const POSTAGE_RATES: Record<PostageType, number> = {
  premium: 10,
  hard_cover: 8,
  soft_cover: 5,
};

export function PostageBadge({ type }: { type: PostageType | null }) {
  if (!type) return <span className="text-muted-foreground text-sm">No postage</span>;
  return (
    <span className="text-sm">
      {POSTAGE_LABELS[type]} <span className="text-muted-foreground">(RM {POSTAGE_RATES[type]})</span>
    </span>
  );
}
```

- [ ] **Step 5: Create DataTable**

`frontend/components/shared/DataTable.tsx`:
```tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export function DataTable<T>({ columns, data, emptyMessage = "No results." }: DataTableProps<T>) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => (
              <TableHead key={col.key}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => (
              <TableRow key={i}>
                {columns.map(col => (
                  <TableCell key={col.key}>{col.cell(row)}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /home/afif/bookstore
git add frontend/components/shared/
git commit -m "feat: add shared components (StatusBadge, PriceSummary, PostageBadge, DataTable)"
```

---

### Task 14: API client and React Query hooks

**Files:**
- Create: `frontend/lib/api.ts`
- Create: `frontend/hooks/useDashboard.ts`
- Create: `frontend/hooks/useCustomers.ts`
- Create: `frontend/hooks/useOrders.ts`
- Create: `frontend/hooks/useBooks.ts`

- [ ] **Step 1: Create typed API client**

`frontend/lib/api.ts`:
```typescript
import { getToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL!;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
};
```

- [ ] **Step 2: Create hooks**

`frontend/hooks/useDashboard.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<DashboardResponse>("/dashboard/") });
}

interface DashboardResponse {
  book_status_counts: { status: string; count: number }[];
  total_outstanding: number;
  books_with_outstanding: BookResponse[];
}

interface BookResponse {
  id: number; title: string; author: string | null; status: string;
  price: { total_price: number; deposit_amount: number; outstanding_amount: number } | null;
}
```

`frontend/hooks/useCustomers.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ["customers", search],
    queryFn: () => api.get<CustomerResponse[]>(`/customers/${search ? `?search=${search}` : ""}`),
  });
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: () => api.get<CustomerDetail>(`/customers/${id}`),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; phone_number: string }) => api.post<CustomerResponse>("/customers/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

interface CustomerResponse { id: number; name: string; phone_number: string; created_at: string; }
interface CustomerDetail extends CustomerResponse { orders: OrderDetail[]; }
interface OrderDetail { id: number; status: string; address: string; created_at: string; books: BookSummary[]; total_outstanding: number; postage_charge: number | null; postage_type: string | null; }
interface BookSummary { id: number; title: string; status: string; price: { total_price: number; deposit_amount: number; outstanding_amount: number } | null; }
```

`frontend/hooks/useOrders.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useOrders(status?: string) {
  return useQuery({
    queryKey: ["orders", status],
    queryFn: () => api.get<OrderDetail[]>(`/orders/${status ? `?status=${status}` : ""}`),
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: () => api.get<OrderDetail>(`/orders/${id}`),
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: OrderCreatePayload) => api.post<OrderDetail>("/orders/", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<OrderDetail>(`/orders/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });
}

interface OrderDetail { id: number; user_id: number; status: string; postage_type: string | null; postage_charge: number | null; address: string; note: string | null; created_at: string; books: BookSummary[]; total_outstanding: number; }
interface BookSummary { id: number; title: string; author: string | null; status: string; price: { total_price: number; deposit_amount: number; outstanding_amount: number } | null; }
interface OrderCreatePayload { user_id: number; address: string; postage_type?: string; note?: string; books: { title: string; author?: string; status: string; price: { total_price: string; deposit_amount: string } }[]; }
```

`frontend/hooks/useBooks.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useBooks(params?: { status?: string; outstanding_only?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.outstanding_only) qs.set("outstanding_only", "true");
  return useQuery({
    queryKey: ["books", params],
    queryFn: () => api.get<BookResponse[]>(`/books/${qs.toString() ? `?${qs}` : ""}`),
  });
}

export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BookUpdatePayload }) => api.patch<BookResponse>(`/books/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["orders"] }); },
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/books/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); qc.invalidateQueries({ queryKey: ["orders"] }); },
  });
}

interface BookResponse { id: number; title: string; author: string | null; status: string; created_at: string; price: { total_price: number; deposit_amount: number; outstanding_amount: number } | null; }
interface BookUpdatePayload { title?: string; author?: string; status?: string; total_price?: string; deposit_amount?: string; }
```

- [ ] **Step 3: Commit**

```bash
cd /home/afif/bookstore
git add frontend/lib/api.ts frontend/hooks/
git commit -m "feat: add API client and React Query hooks"
```

---

### Task 15: Dashboard page

**Files:**
- Create: `frontend/app/(dashboard)/page.tsx`

- [ ] **Step 1: Install shadcn card component**

```bash
cd frontend && npx shadcn@latest add card
```

- [ ] **Step 2: Create dashboard page**

`frontend/app/(dashboard)/page.tsx`:
```tsx
"use client";
import { useDashboard } from "@/hooks/useDashboard";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { BookStatusBadge } from "@/components/shared/StatusBadge";

const STATUS_ORDER = ["deposit", "paid", "bought", "under_delivery", "delivered"];

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading) return <PageShell title="Dashboard"><p className="text-muted-foreground">Loading…</p></PageShell>;
  if (!data) return null;

  const countMap = Object.fromEntries(data.book_status_counts.map(s => [s.status, s.count]));

  return (
    <PageShell title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATUS_ORDER.map(status => (
          <Card key={status}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {status.replace("_", " ")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-semibold">{countMap[status] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex justify-between">
            Outstanding Payments
            <span className="text-destructive font-semibold">RM {data.total_outstanding.toFixed(2)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            data={data.books_with_outstanding}
            emptyMessage="No outstanding payments."
            columns={[
              { key: "title", header: "Book", cell: r => r.title },
              { key: "status", header: "Status", cell: r => <BookStatusBadge status={r.status as any} /> },
              { key: "outstanding", header: "Outstanding", cell: r => r.price ? `RM ${r.price.outstanding_amount.toFixed(2)}` : "—" },
            ]}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/afif/bookstore
git add "frontend/app/(dashboard)/page.tsx"
git commit -m "feat: add dashboard page"
```

---

### Task 16: Customers pages

**Files:**
- Create: `frontend/app/(dashboard)/customers/page.tsx`
- Create: `frontend/app/(dashboard)/customers/[id]/page.tsx`

- [ ] **Step 1: Install shadcn input component**

```bash
cd frontend && npx shadcn@latest add input
```

- [ ] **Step 2: Create customers list page**

`frontend/app/(dashboard)/customers/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomers, useCreateCustomer } from "@/hooks/useCustomers";
import { PageShell } from "@/components/layout/PageShell";
import { DataTable } from "@/components/shared/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { data = [], isLoading } = useCustomers(search || undefined);
  const createCustomer = useCreateCustomer();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createCustomer.mutateAsync({ name, phone_number: phone });
    setName(""); setPhone(""); setOpen(false);
  }

  return (
    <PageShell
      title="Customers"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm">+ Add Customer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={createCustomer.isPending}>Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Input placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      <DataTable
        data={data}
        emptyMessage={isLoading ? "Loading…" : "No customers found."}
        columns={[
          { key: "name", header: "Name", cell: r => (
            <button className="hover:underline font-medium" onClick={() => router.push(`/customers/${r.id}`)}>{r.name}</button>
          )},
          { key: "phone", header: "Phone", cell: r => r.phone_number },
          { key: "joined", header: "Joined", cell: r => new Date(r.created_at).toLocaleDateString() },
        ]}
      />
    </PageShell>
  );
}
```

- [ ] **Step 3: Install dialog component**

```bash
cd frontend && npx shadcn@latest add dialog
```

- [ ] **Step 4: Create customer detail page**

`frontend/app/(dashboard)/customers/[id]/page.tsx`:
```tsx
"use client";
import { useParams } from "next/navigation";
import { useCustomer } from "@/hooks/useCustomers";
import { PageShell } from "@/components/layout/PageShell";
import { DataTable } from "@/components/shared/DataTable";
import { OrderStatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useCustomer(Number(id));

  if (isLoading) return <PageShell title="Customer"><p className="text-muted-foreground">Loading…</p></PageShell>;
  if (!data) return null;

  return (
    <PageShell title={data.name}>
      <Card>
        <CardContent className="pt-4 text-sm space-y-1">
          <p><span className="text-muted-foreground">Phone: </span>{data.phone_number}</p>
          <p><span className="text-muted-foreground">Joined: </span>{new Date(data.created_at).toLocaleDateString()}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Orders</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DataTable
            data={data.orders}
            emptyMessage="No orders yet."
            columns={[
              { key: "id", header: "Order", cell: r => (
                <Link href={`/orders/${r.id}`} className="hover:underline font-medium">#{r.id}</Link>
              )},
              { key: "status", header: "Status", cell: r => <OrderStatusBadge status={r.status as any} /> },
              { key: "books", header: "Books", cell: r => r.books.length },
              { key: "outstanding", header: "Outstanding", cell: r => `RM ${r.total_outstanding.toFixed(2)}` },
              { key: "date", header: "Date", cell: r => new Date(r.created_at).toLocaleDateString() },
            ]}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd /home/afif/bookstore
git add "frontend/app/(dashboard)/customers/"
git commit -m "feat: add customers list and detail pages"
```

---

### Task 17: Orders list and detail pages

**Files:**
- Create: `frontend/app/(dashboard)/orders/page.tsx`
- Create: `frontend/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Step 1: Install shadcn select and alert-dialog**

```bash
cd frontend && npx shadcn@latest add select alert-dialog
```

- [ ] **Step 2: Create orders list page**

`frontend/app/(dashboard)/orders/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrders } from "@/hooks/useOrders";
import { PageShell } from "@/components/layout/PageShell";
import { DataTable } from "@/components/shared/DataTable";
import { OrderStatusBadge, BookStatusBadge } from "@/components/shared/StatusBadge";
import { PostageBadge } from "@/components/shared/PostageBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function OrdersPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { data = [], isLoading } = useOrders(statusFilter);

  return (
    <PageShell title="Orders">
      <Select onValueChange={v => setStatusFilter(v === "all" ? undefined : v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>
      <DataTable
        data={data}
        emptyMessage={isLoading ? "Loading…" : "No orders found."}
        columns={[
          { key: "id", header: "Order", cell: r => (
            <button className="hover:underline font-medium" onClick={() => router.push(`/orders/${r.id}`)}>#{r.id}</button>
          )},
          { key: "status", header: "Status", cell: r => <OrderStatusBadge status={r.status as any} /> },
          { key: "address", header: "Address", cell: r => <span className="max-w-[200px] truncate block">{r.address}</span> },
          { key: "postage", header: "Postage", cell: r => <PostageBadge type={r.postage_type as any} /> },
          { key: "books", header: "Books", cell: r => r.books.length },
          { key: "outstanding", header: "Outstanding", cell: r => `RM ${r.total_outstanding.toFixed(2)}` },
          { key: "date", header: "Date", cell: r => new Date(r.created_at).toLocaleDateString() },
        ]}
      />
    </PageShell>
  );
}
```

- [ ] **Step 3: Create order detail page**

`frontend/app/(dashboard)/orders/[id]/page.tsx`:
```tsx
"use client";
import { useParams, useRouter } from "next/navigation";
import { useOrder, useCancelOrder } from "@/hooks/useOrders";
import { useUpdateBook, useDeleteBook } from "@/hooks/useBooks";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { BookStatusBadge, OrderStatusBadge } from "@/components/shared/StatusBadge";
import { PriceSummary } from "@/components/shared/PriceSummary";
import { PostageBadge } from "@/components/shared/PostageBadge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BOOK_STATUSES = ["deposit", "paid", "bought", "under_delivery", "delivered", "cancelled"];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useOrder(Number(id));
  const cancelOrder = useCancelOrder();
  const updateBook = useUpdateBook();
  const deleteBook = useDeleteBook();

  if (isLoading) return <PageShell title="Order"><p className="text-muted-foreground">Loading…</p></PageShell>;
  if (!data) return null;

  const isActive = data.status === "active";

  return (
    <PageShell
      title={`Order #${data.id}`}
      action={
        isActive && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">Cancel Order</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                <AlertDialogDescription>All books in this order will be marked as cancelled. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Order</AlertDialogCancel>
                <AlertDialogAction onClick={() => cancelOrder.mutate(data.id)}>Cancel Order</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )
      }
    >
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <div className="flex gap-2 items-center"><span className="text-muted-foreground w-20">Status</span><OrderStatusBadge status={data.status as any} /></div>
            <div className="flex gap-2"><span className="text-muted-foreground w-20">Address</span><span>{data.address}</span></div>
            <div className="flex gap-2 items-center"><span className="text-muted-foreground w-20">Postage</span><PostageBadge type={data.postage_type as any} /></div>
            {data.note && <div className="flex gap-2"><span className="text-muted-foreground w-20">Note</span><span>{data.note}</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Payment Summary</CardTitle></CardHeader>
          <CardContent>
            <PriceSummary
              totalPrice={data.books.reduce((s, b) => s + (b.price?.total_price ?? 0), 0)}
              depositAmount={data.books.reduce((s, b) => s + (b.price?.deposit_amount ?? 0), 0)}
              outstandingAmount={data.total_outstanding}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Books</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DataTable
            data={data.books}
            emptyMessage="No books in this order."
            columns={[
              { key: "title", header: "Title", cell: r => r.title },
              { key: "status", header: "Status", cell: r => (
                isActive ? (
                  <Select value={r.status} onValueChange={v => updateBook.mutate({ id: r.id, data: { status: v } })}>
                    <SelectTrigger className="h-7 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{BOOK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <BookStatusBadge status={r.status as any} />
              )},
              { key: "price", header: "Price", cell: r => r.price ? `RM ${Number(r.price.total_price).toFixed(2)}` : "—" },
              { key: "deposit", header: "Deposit", cell: r => r.price ? `RM ${Number(r.price.deposit_amount).toFixed(2)}` : "—" },
              { key: "outstanding", header: "Outstanding", cell: r => r.price ? (
                <span className={r.price.outstanding_amount > 0 ? "text-destructive" : "text-green-600"}>
                  RM {r.price.outstanding_amount.toFixed(2)}
                </span>
              ) : "—"},
              { key: "actions", header: "", cell: r => (
                isActive && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteBook.mutate(r.id)}>Remove</Button>
                )
              )},
            ]}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/afif/bookstore
git add "frontend/app/(dashboard)/orders/page.tsx" "frontend/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat: add orders list and detail pages"
```

---

### Task 18: New Order 3-step flow

**Files:**
- Create: `frontend/components/orders/NewOrderStepper.tsx`
- Create: `frontend/app/(dashboard)/orders/new/page.tsx`

- [ ] **Step 1: Create NewOrderStepper**

`frontend/components/orders/NewOrderStepper.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomers, useCreateCustomer } from "@/hooks/useCustomers";
import { useCreateOrder } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface BookRow { title: string; author: string; status: string; total_price: string; deposit_amount: string; }

const EMPTY_BOOK: BookRow = { title: "", author: "", status: "deposit", total_price: "", deposit_amount: "0" };

export function NewOrderStepper() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postageType, setPostageType] = useState<string>("");
  const [note, setNote] = useState("");
  const [books, setBooks] = useState<BookRow[]>([{ ...EMPTY_BOOK }]);

  const { data: customers = [] } = useCustomers(search || undefined);
  const createCustomer = useCreateCustomer();
  const createOrder = useCreateOrder();

  async function handleSelectOrCreateCustomer() {
    if (!customerId && newName && newPhone) {
      const c = await createCustomer.mutateAsync({ name: newName, phone_number: newPhone });
      setCustomerId(c.id);
    }
    setStep(2);
  }

  async function handleSubmit() {
    if (!customerId) return;
    const order = await createOrder.mutateAsync({
      user_id: customerId,
      address,
      postage_type: postageType || undefined,
      note: note || undefined,
      books: books.map(b => ({
        title: b.title,
        author: b.author || undefined,
        status: b.status,
        price: { total_price: b.total_price, deposit_amount: b.deposit_amount },
      })),
    });
    router.push(`/orders/${order.id}`);
  }

  const updateBook = (i: number, field: keyof BookRow, value: string) =>
    setBooks(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b));

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex gap-2 text-sm text-muted-foreground">
        {["Customer", "Order Details", "Books"].map((label, i) => (
          <span key={i} className={step === i + 1 ? "text-foreground font-medium" : ""}>
            {i + 1}. {label}{i < 2 && " →"}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Search existing customer</Label>
            <Input placeholder="Name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {customers.length > 0 && (
            <div className="border rounded-md divide-y">
              {customers.map(c => (
                <button key={c.id} onClick={() => { setCustomerId(c.id); setSearch(c.name); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${customerId === c.id ? "bg-accent" : ""}`}>
                  {c.name} — {c.phone_number}
                </button>
              ))}
            </div>
          )}
          {!customerId && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Or create new customer</p>
              <div className="space-y-1"><Label>Name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={newPhone} onChange={e => setNewPhone(e.target.value)} /></div>
            </div>
          )}
          <Button onClick={handleSelectOrCreateCustomer} disabled={!customerId && (!newName || !newPhone)}>
            Next
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-1"><Label>Delivery Address *</Label><Textarea value={address} onChange={e => setAddress(e.target.value)} required /></div>
          <div className="space-y-1">
            <Label>Postage Type (optional)</Label>
            <Select value={postageType} onValueChange={setPostageType}>
              <SelectTrigger><SelectValue placeholder="No postage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="premium">Premium — RM10</SelectItem>
                <SelectItem value="hard_cover">Hard Cover — RM8</SelectItem>
                <SelectItem value="soft_cover">Soft Cover — RM5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Note (optional)</Label><Textarea value={note} onChange={e => setNote(e.target.value)} /></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={!address}>Next</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {books.map((book, i) => (
            <div key={i} className="border rounded-md p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Book {i + 1}</span>
                {books.length > 1 && (
                  <Button variant="ghost" size="sm" className="text-destructive h-7"
                    onClick={() => setBooks(prev => prev.filter((_, idx) => idx !== i))}>Remove</Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 space-y-1"><Label>Title *</Label><Input value={book.title} onChange={e => updateBook(i, "title", e.target.value)} /></div>
                <div className="space-y-1"><Label>Author</Label><Input value={book.author} onChange={e => updateBook(i, "author", e.target.value)} /></div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={book.status} onValueChange={v => updateBook(i, "status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["deposit","paid","bought","under_delivery","delivered"].map(s => (
                        <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Price (RM) *</Label><Input type="number" step="0.01" value={book.total_price} onChange={e => updateBook(i, "total_price", e.target.value)} /></div>
                <div className="space-y-1"><Label>Deposit (RM)</Label><Input type="number" step="0.01" value={book.deposit_amount} onChange={e => updateBook(i, "deposit_amount", e.target.value)} /></div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setBooks(prev => [...prev, { ...EMPTY_BOOK }])}>
            + Add Another Book
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button
              onClick={handleSubmit}
              disabled={books.some(b => !b.title || !b.total_price) || createOrder.isPending}
            >
              {createOrder.isPending ? "Creating…" : "Create Order"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Install textarea**

```bash
cd frontend && npx shadcn@latest add textarea
```

- [ ] **Step 3: Create new order page**

`frontend/app/(dashboard)/orders/new/page.tsx`:
```tsx
import { PageShell } from "@/components/layout/PageShell";
import { NewOrderStepper } from "@/components/orders/NewOrderStepper";

export default function NewOrderPage() {
  return (
    <PageShell title="New Order">
      <NewOrderStepper />
    </PageShell>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/afif/bookstore
git add frontend/components/orders/ "frontend/app/(dashboard)/orders/new/"
git commit -m "feat: add new order 3-step flow"
```

---

### Task 19: Books page

**Files:**
- Create: `frontend/app/(dashboard)/books/page.tsx`

- [ ] **Step 1: Create books page**

`frontend/app/(dashboard)/books/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useBooks, useUpdateBook } from "@/hooks/useBooks";
import { PageShell } from "@/components/layout/PageShell";
import { DataTable } from "@/components/shared/DataTable";
import { BookStatusBadge } from "@/components/shared/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const BOOK_STATUSES = ["deposit", "paid", "bought", "under_delivery", "delivered", "cancelled"];

export default function BooksPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const { data = [], isLoading } = useBooks({ status: statusFilter, outstanding_only: outstandingOnly });
  const updateBook = useUpdateBook();

  return (
    <PageShell title="Books">
      <div className="flex items-center gap-4 flex-wrap">
        <Select onValueChange={v => setStatusFilter(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {BOOK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox id="outstanding" checked={outstandingOnly} onCheckedChange={v => setOutstandingOnly(Boolean(v))} />
          <Label htmlFor="outstanding" className="text-sm cursor-pointer">Outstanding only</Label>
        </div>
      </div>
      <DataTable
        data={data}
        emptyMessage={isLoading ? "Loading…" : "No books found."}
        columns={[
          { key: "title", header: "Title", cell: r => r.title },
          { key: "author", header: "Author", cell: r => r.author ?? "—" },
          { key: "status", header: "Status", cell: r => (
            <Select value={r.status} onValueChange={v => updateBook.mutate({ id: r.id, data: { status: v } })}>
              <SelectTrigger className="h-7 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{BOOK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          )},
          { key: "price", header: "Price", cell: r => r.price ? `RM ${Number(r.price.total_price).toFixed(2)}` : "—" },
          { key: "deposit", header: "Deposit", cell: r => r.price ? `RM ${Number(r.price.deposit_amount).toFixed(2)}` : "—" },
          { key: "outstanding", header: "Outstanding", cell: r => r.price ? (
            <span className={r.price.outstanding_amount > 0 ? "text-destructive font-medium" : "text-green-600"}>
              RM {r.price.outstanding_amount.toFixed(2)}
            </span>
          ) : "—" },
          { key: "added", header: "Added", cell: r => new Date(r.created_at).toLocaleDateString() },
        ]}
      />
    </PageShell>
  );
}
```

- [ ] **Step 2: Install checkbox**

```bash
cd frontend && npx shadcn@latest add checkbox
```

- [ ] **Step 3: Commit**

```bash
cd /home/afif/bookstore
git add "frontend/app/(dashboard)/books/"
git commit -m "feat: add books page with status filter and outstanding toggle"
```

---

### Task 20: Final wiring — redirect root, verify full app

**Files:**
- Modify: `frontend/app/page.tsx` (remove default Next.js content)

- [ ] **Step 1: Run all backend tests one final time**

```bash
cd /home/afif/bookstore/backend && source .venv/bin/activate
pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 2: Remove default Next.js home page (dashboard layout handles routing)**

`frontend/app/page.tsx` — delete the default boilerplate and replace:
```tsx
export { default } from "./(dashboard)/page";
```

- [ ] **Step 3: Start both servers and smoke-test**

Terminal 1:
```bash
cd backend && uvicorn app.main:app --reload
```

Terminal 2:
```bash
cd frontend && npm run dev
```

Smoke test checklist:
- [ ] `/login` renders and rejects wrong credentials
- [ ] Valid login redirects to `/`
- [ ] Dashboard shows status cards and outstanding table
- [ ] `/customers` — add a customer, search by name
- [ ] `/orders/new` — complete all 3 steps, order appears in `/orders`
- [ ] `/orders/:id` — change a book status, cancel order
- [ ] `/books` — filter by status, toggle outstanding only
- [ ] Sign out returns to `/login`

- [ ] **Step 4: Final commit**

```bash
cd /home/afif/bookstore
git add frontend/app/page.tsx
git commit -m "feat: inventory management system complete"
```
