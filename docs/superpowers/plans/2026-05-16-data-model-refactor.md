# Data Model Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the data model so Books are unique catalog entries, OrderBooks track per-copy status/deposit, Publishers are a separate table, and postage_type becomes geographic (Semenanjung/Sabah Sarawak) with a new ps_charge on books.

**Architecture:** Book = catalog row (one per distinct title, has publisher_id, ps_charge, total_price, deposit_amount). OrderBook = one row per physical copy in an order (has its own PK id, status, deposit_amount per copy). Outstanding per copy = book.total_price − order_book.deposit_amount. Postage is a one-time amount per order stored in order.postage_amount (defaults to RM 8 / RM 16 based on postage_type, but editable).

**Tech Stack:** FastAPI + SQLAlchemy async (backend), Next.js App Router + TanStack Query (frontend), SQLite for tests, Supabase Postgres for prod.

---

## File Map

**Backend — modify:**
- `backend/app/models.py` — full rewrite: new Publisher, new enums, updated Book/Order/OrderBook, remove Price
- `backend/app/schemas.py` — full rewrite
- `backend/app/routers/books.py` — rewrite: publisher_id/ps_charge, no Price table
- `backend/app/routers/orders.py` — rewrite: copies-based add, per-copy PATCH, cancel sets OrderBook.status
- `backend/app/routers/customers.py` — update `_build_order_detail`
- `backend/app/routers/dashboard.py` — rewrite: count by OrderBook.status
- `backend/tests/test_books.py` — full rewrite
- `backend/tests/test_orders.py` — full rewrite
- `backend/tests/test_dashboard.py` — full rewrite

**Backend — create:**
- `backend/app/routers/publishers.py` — new router
- `backend/tests/test_publishers.py` — new tests

**Frontend — modify:**
- `frontend/lib/api.ts` — updated types + API functions
- `frontend/hooks/useBooks.ts` — remove status param
- `frontend/hooks/useOrders.ts` — add useUpdateOrderBook
- `frontend/app/(dashboard)/books/page.tsx` — publisher/ps_charge, remove author/status
- `frontend/app/(dashboard)/orders/new/page.tsx` — semenanjung/sabah_sarawak postage
- `frontend/app/(dashboard)/orders/[id]/page.tsx` — OrderBook-level status/deposit, postage_amount

**Frontend — create:**
- `frontend/hooks/usePublishers.ts` — new hook

**Other:**
- `supabase/schema.sql` — updated SQL

---

### Task 1: Backend models.py — full rewrite

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Write the failing test (smoke test that new models import)**

Create a temporary inline test to verify models compile. We'll verify via pytest import in Task 3.

- [ ] **Step 2: Rewrite `backend/app/models.py`**

```python
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, Enum, ForeignKey
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
    semenanjung = "semenanjung"
    sabah_sarawak = "sabah_sarawak"


class PsChargeType(str, enum.Enum):
    premium = "premium"
    hard_cover = "hard_cover"
    soft_cover = "soft_cover"


POSTAGE_DEFAULTS: dict[PostageType, float] = {
    PostageType.semenanjung: 8.00,
    PostageType.sabah_sarawak: 16.00,
}

PS_CHARGE_RATES: dict[PsChargeType, float] = {
    PsChargeType.premium: 10.00,
    PsChargeType.hard_cover: 8.00,
    PsChargeType.soft_cover: 5.00,
}


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    orders = relationship("Order", back_populates="user")


class Publisher(Base):
    __tablename__ = "publishers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    books = relationship("Book", back_populates="publisher")


class Book(Base):
    __tablename__ = "books"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    publisher_id = Column(Integer, ForeignKey("publishers.id"), nullable=False)
    ps_charge = Column(
        Enum(PsChargeType, name="ps_charge_type", native_enum=False),
        nullable=False,
    )
    total_price = Column(Numeric(10, 2), nullable=False)
    deposit_amount = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    publisher = relationship("Publisher", back_populates="books")
    order_books = relationship("OrderBook", back_populates="book")


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(
        Enum(OrderStatus, name="order_status", native_enum=False),
        nullable=False,
        default=OrderStatus.active,
    )
    postage_type = Column(
        Enum(PostageType, name="postage_type", native_enum=False), nullable=True
    )
    postage_amount = Column(Numeric(10, 2), nullable=True)
    address = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    user = relationship("User", back_populates="orders")
    order_books = relationship(
        "OrderBook", back_populates="order", cascade="all, delete-orphan"
    )


class OrderBook(Base):
    __tablename__ = "order_books"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    status = Column(
        Enum(BookStatus, name="book_status", native_enum=False),
        nullable=False,
        default=BookStatus.deposit,
    )
    deposit_amount = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    order = relationship("Order", back_populates="order_books")
    book = relationship("Book", back_populates="order_books")
```

- [ ] **Step 3: Verify models import cleanly**

```bash
cd backend && uv run python -c "from app.models import Publisher, Book, Order, OrderBook, PostageType, PsChargeType; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models.py
git commit -m "refactor: rewrite models — Publisher, updated Book/Order/OrderBook, new enums"
```

---

### Task 2: Backend schemas.py — full rewrite

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: Rewrite `backend/app/schemas.py`**

```python
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.models import BookStatus, OrderStatus, PostageType, PsChargeType


class CustomerCreate(BaseModel):
    name: str
    phone_number: str


class CustomerResponse(BaseModel):
    id: int
    name: str
    phone_number: str
    created_at: datetime
    model_config = {"from_attributes": True}


class PublisherCreate(BaseModel):
    name: str


class PublisherResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    model_config = {"from_attributes": True}


class BookCreate(BaseModel):
    title: str
    publisher_id: int
    ps_charge: PsChargeType
    total_price: Decimal
    deposit_amount: Decimal = Decimal("0")


class BookUpdate(BaseModel):
    title: Optional[str] = None
    publisher_id: Optional[int] = None
    ps_charge: Optional[PsChargeType] = None
    total_price: Optional[Decimal] = None
    deposit_amount: Optional[Decimal] = None


class BookResponse(BaseModel):
    id: int
    title: str
    publisher_id: int
    publisher_name: str
    ps_charge: PsChargeType
    total_price: Decimal
    deposit_amount: Decimal
    created_at: datetime
    updated_at: Optional[datetime]
    model_config = {"from_attributes": True}


class OrderBookResponse(BaseModel):
    id: int
    book_id: int
    title: str
    publisher_name: str
    ps_charge: PsChargeType
    total_price: Decimal
    status: BookStatus
    deposit_amount: Decimal
    outstanding_amount: float
    created_at: datetime
    updated_at: Optional[datetime]


class OrderBookUpdate(BaseModel):
    status: Optional[BookStatus] = None
    deposit_amount: Optional[Decimal] = None


class CopySpec(BaseModel):
    book_id: int
    quantity: int = Field(1, ge=1, le=50)


class OrderCreate(BaseModel):
    user_id: int
    postage_type: Optional[PostageType] = None
    postage_amount: Optional[Decimal] = None
    address: str
    note: Optional[str] = None
    copies: list[CopySpec] = []


class OrderUpdate(BaseModel):
    postage_type: Optional[PostageType] = None
    postage_amount: Optional[Decimal] = None
    address: Optional[str] = None
    note: Optional[str] = None


class AddCopiesToOrderRequest(BaseModel):
    copies: list[CopySpec] = []


class OrderDetail(BaseModel):
    id: int
    user_id: int
    status: OrderStatus
    postage_type: Optional[PostageType]
    postage_amount: Optional[Decimal]
    address: str
    note: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    order_books: list[OrderBookResponse]
    total_outstanding: float
    customer_name: str
    customer_phone: str
    model_config = {"from_attributes": True}


class CustomerDetail(CustomerResponse):
    orders: list[OrderDetail]


class BookStatusCount(BaseModel):
    status: BookStatus
    count: int


class DashboardResponse(BaseModel):
    book_status_counts: list[BookStatusCount]
    total_outstanding: float
    copies_with_outstanding: list[OrderBookResponse]
```

- [ ] **Step 2: Verify schemas import**

```bash
cd backend && uv run python -c "from app.schemas import OrderDetail, BookResponse, PublisherResponse; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas.py
git commit -m "refactor: rewrite schemas for new data model"
```

---

### Task 3: Backend publishers router + tests

**Files:**
- Create: `backend/app/routers/publishers.py`
- Create: `backend/tests/test_publishers.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_publishers.py`:

```python
async def test_create_publisher(client):
    resp = await client.post("/publishers/", json={"name": "Penguin"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Penguin"
    assert "id" in data


async def test_list_publishers(client):
    await client.post("/publishers/", json={"name": "Penguin"})
    await client.post("/publishers/", json={"name": "Harper"})
    resp = await client.get("/publishers/")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_duplicate_publisher_name_rejected(client):
    await client.post("/publishers/", json={"name": "Penguin"})
    resp = await client.post("/publishers/", json={"name": "Penguin"})
    assert resp.status_code == 400
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest tests/test_publishers.py -v
```

Expected: errors (router not found / 404)

- [ ] **Step 3: Create `backend/app/routers/publishers.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.auth import get_current_user
from app.models import Publisher
from app.schemas import PublisherCreate, PublisherResponse

router = APIRouter()


@router.get("/", response_model=list[PublisherResponse])
async def list_publishers(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(Publisher).order_by(Publisher.name))
    return result.scalars().all()


@router.post("/", response_model=PublisherResponse, status_code=201)
async def create_publisher(
    data: PublisherCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    publisher = Publisher(name=data.name)
    db.add(publisher)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Publisher name already exists")
    await db.refresh(publisher)
    return publisher
```

- [ ] **Step 4: Mount router in `backend/app/main.py`**

Read the current `main.py` first, then add the publishers router. The file should look like:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import customers, orders, books, dashboard, publishers

app = FastAPI()

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
app.include_router(publishers.router, prefix="/publishers", tags=["publishers"])
```

- [ ] **Step 5: Run tests**

```bash
cd backend && uv run pytest tests/test_publishers.py -v
```

Expected: all 3 pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/publishers.py backend/tests/test_publishers.py backend/app/main.py
git commit -m "feat: add publishers router with list and create endpoints"
```

---

### Task 4: Backend books router rewrite + tests

**Files:**
- Modify: `backend/app/routers/books.py`
- Modify: `backend/tests/test_books.py`

- [ ] **Step 1: Write the failing tests**

Replace all of `backend/tests/test_books.py`:

```python
async def _create_publisher(client, name="Penguin"):
    r = await client.post("/publishers/", json={"name": name})
    assert r.status_code == 201
    return r.json()["id"]


async def _create_book(client, pub_id=None, **kwargs):
    if pub_id is None:
        pub_id = await _create_publisher(client)
    payload = {
        "title": "Dune",
        "publisher_id": pub_id,
        "ps_charge": "premium",
        "total_price": "50.00",
        "deposit_amount": "10.00",
        **kwargs,
    }
    r = await client.post("/books/", json=payload)
    assert r.status_code == 201
    return r.json()["id"]


async def test_create_book(client):
    pub_id = await _create_publisher(client)
    resp = await client.post(
        "/books/",
        json={
            "title": "Dune",
            "publisher_id": pub_id,
            "ps_charge": "premium",
            "total_price": "50.00",
            "deposit_amount": "10.00",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Dune"
    assert data["publisher_name"] == "Penguin"
    assert data["ps_charge"] == "premium"
    assert float(data["total_price"]) == 50.0


async def test_create_book_invalid_publisher(client):
    resp = await client.post(
        "/books/",
        json={
            "title": "Dune",
            "publisher_id": 999,
            "ps_charge": "premium",
            "total_price": "50.00",
        },
    )
    assert resp.status_code == 404


async def test_list_books(client):
    await _create_book(client)
    resp = await client.get("/books/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_update_book_title(client):
    book_id = await _create_book(client)
    resp = await client.patch(f"/books/{book_id}", json={"title": "Foundation"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Foundation"


async def test_update_book_ps_charge(client):
    book_id = await _create_book(client)
    resp = await client.patch(f"/books/{book_id}", json={"ps_charge": "soft_cover"})
    assert resp.status_code == 200
    assert resp.json()["ps_charge"] == "soft_cover"


async def test_delete_book(client):
    book_id = await _create_book(client)
    resp = await client.delete(f"/books/{book_id}")
    assert resp.status_code == 204


async def test_delete_book_in_active_order_rejected(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id=pub_id)
    cid = (
        await client.post("/customers/", json={"name": "T", "phone_number": "0"})
    ).json()["id"]
    await client.post(
        "/orders/",
        json={"user_id": cid, "address": "A", "copies": [{"book_id": book_id, "quantity": 1}]},
    )
    resp = await client.delete(f"/books/{book_id}")
    assert resp.status_code == 400
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest tests/test_books.py -v
```

Expected: failures (old schemas in books router)

- [ ] **Step 3: Rewrite `backend/app/routers/books.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import Book, Publisher, OrderBook, Order, OrderStatus
from app.schemas import BookCreate, BookUpdate, BookResponse

router = APIRouter()


async def _load_book(book_id: int, db: AsyncSession) -> Book:
    result = await db.execute(
        select(Book)
        .options(selectinload(Book.publisher))
        .where(Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


def _book_response(book: Book) -> BookResponse:
    return BookResponse(
        id=book.id,
        title=book.title,
        publisher_id=book.publisher_id,
        publisher_name=book.publisher.name,
        ps_charge=book.ps_charge,
        total_price=book.total_price,
        deposit_amount=book.deposit_amount,
        created_at=book.created_at,
        updated_at=book.updated_at,
    )


@router.post("/", response_model=BookResponse, status_code=201)
async def create_book(
    data: BookCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    pub = await db.get(Publisher, data.publisher_id)
    if not pub:
        raise HTTPException(status_code=404, detail="Publisher not found")
    book = Book(
        title=data.title,
        publisher_id=data.publisher_id,
        ps_charge=data.ps_charge,
        total_price=data.total_price,
        deposit_amount=data.deposit_amount,
    )
    db.add(book)
    await db.commit()
    return _book_response(await _load_book(book.id, db))


@router.get("/", response_model=list[BookResponse])
async def list_books(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Book).options(selectinload(Book.publisher)).order_by(Book.created_at.desc())
    )
    return [_book_response(b) for b in result.scalars().all()]


@router.patch("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: int,
    data: BookUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    book = await _load_book(book_id, db)
    if data.publisher_id is not None:
        pub = await db.get(Publisher, data.publisher_id)
        if not pub:
            raise HTTPException(status_code=404, detail="Publisher not found")
        book.publisher_id = data.publisher_id
    for field in ("title", "ps_charge", "total_price", "deposit_amount"):
        val = getattr(data, field)
        if val is not None:
            setattr(book, field, val)
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
    ob = result.scalars().first()
    if ob and ob.order.status == OrderStatus.active:
        raise HTTPException(
            status_code=400, detail="Cannot delete a book that is part of an active order"
        )
    book = await _load_book(book_id, db)
    await db.delete(book)
    await db.commit()
```

- [ ] **Step 4: Run tests**

```bash
cd backend && uv run pytest tests/test_books.py -v
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/books.py backend/tests/test_books.py
git commit -m "refactor: rewrite books router — publisher_id, ps_charge, no Price table"
```

---

### Task 5: Backend orders router rewrite + tests

**Files:**
- Modify: `backend/app/routers/orders.py`
- Modify: `backend/app/routers/customers.py`
- Modify: `backend/tests/test_orders.py`

- [ ] **Step 1: Write the failing tests**

Replace all of `backend/tests/test_orders.py`:

```python
from decimal import Decimal


async def _create_publisher(client, name="Penguin"):
    r = await client.post("/publishers/", json={"name": name})
    return r.json()["id"]


async def _create_book(client, pub_id):
    r = await client.post(
        "/books/",
        json={
            "title": "Dune",
            "publisher_id": pub_id,
            "ps_charge": "premium",
            "total_price": "50.00",
            "deposit_amount": "10.00",
        },
    )
    return r.json()["id"]


async def _create_customer(client):
    r = await client.post("/customers/", json={"name": "Test", "phone_number": "011"})
    return r.json()["id"]


async def test_create_order(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    resp = await client.post(
        "/orders/",
        json={
            "user_id": cid,
            "address": "123 Jalan Test",
            "postage_type": "semenanjung",
            "copies": [{"book_id": book_id, "quantity": 1}],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["address"] == "123 Jalan Test"
    assert len(data["order_books"]) == 1
    assert data["order_books"][0]["status"] == "deposit"
    assert float(data["order_books"][0]["outstanding_amount"]) == 40.0
    assert float(data["postage_amount"]) == 8.0


async def test_create_order_postage_amount_auto_set_sabah(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    resp = await client.post(
        "/orders/",
        json={
            "user_id": cid,
            "address": "Kota Kinabalu",
            "postage_type": "sabah_sarawak",
            "copies": [{"book_id": book_id, "quantity": 1}],
        },
    )
    assert resp.status_code == 201
    assert float(resp.json()["postage_amount"]) == 16.0


async def test_create_order_postage_amount_manual_override(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    resp = await client.post(
        "/orders/",
        json={
            "user_id": cid,
            "address": "Addr",
            "postage_type": "semenanjung",
            "postage_amount": "12.00",
            "copies": [{"book_id": book_id, "quantity": 1}],
        },
    )
    assert resp.status_code == 201
    assert float(resp.json()["postage_amount"]) == 12.0


async def test_create_order_quantity_multiple_copies(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    resp = await client.post(
        "/orders/",
        json={
            "user_id": cid,
            "address": "Addr",
            "copies": [{"book_id": book_id, "quantity": 3}],
        },
    )
    assert resp.status_code == 201
    assert len(resp.json()["order_books"]) == 3


async def test_list_orders(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    await client.post(
        "/orders/",
        json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
    )
    resp = await client.get("/orders/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_update_order_address(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    order = (
        await client.post(
            "/orders/",
            json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
        )
    ).json()
    resp = await client.patch(f"/orders/{order['id']}", json={"address": "New Addr"})
    assert resp.status_code == 200
    assert resp.json()["address"] == "New Addr"


async def test_update_order_postage_amount(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    order = (
        await client.post(
            "/orders/",
            json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
        )
    ).json()
    resp = await client.patch(f"/orders/{order['id']}", json={"postage_amount": "20.00"})
    assert resp.status_code == 200
    assert float(resp.json()["postage_amount"]) == 20.0


async def test_add_copies_to_order(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    order = (
        await client.post(
            "/orders/",
            json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
        )
    ).json()
    resp = await client.post(
        f"/orders/{order['id']}/books",
        json={"copies": [{"book_id": book_id, "quantity": 2}]},
    )
    assert resp.status_code == 200
    assert len(resp.json()["order_books"]) == 3


async def test_update_order_book_status(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    order = (
        await client.post(
            "/orders/",
            json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
        )
    ).json()
    ob_id = order["order_books"][0]["id"]
    resp = await client.patch(
        f"/orders/{order['id']}/books/{ob_id}",
        json={"status": "paid", "deposit_amount": "50.00"},
    )
    assert resp.status_code == 200
    ob = next(x for x in resp.json()["order_books"] if x["id"] == ob_id)
    assert ob["status"] == "paid"
    assert float(ob["deposit_amount"]) == 50.0


async def test_cancel_order(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    order = (
        await client.post(
            "/orders/",
            json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
        )
    ).json()
    resp = await client.patch(f"/orders/{order['id']}/cancel")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "cancelled"
    assert all(ob["status"] == "cancelled" for ob in data["order_books"])
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest tests/test_orders.py -v
```

Expected: failures (old router)

- [ ] **Step 3: Rewrite `backend/app/routers/customers.py`**

Update `_build_order_detail` to use the new model (OrderBook has status/deposit_amount):

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Order, OrderBook, Book, Publisher
from app.schemas import (
    CustomerCreate,
    CustomerResponse,
    CustomerDetail,
    OrderDetail,
    OrderBookResponse,
)

router = APIRouter()


def _build_order_book_response(ob: OrderBook) -> OrderBookResponse:
    outstanding = float(ob.book.total_price) - float(ob.deposit_amount)
    return OrderBookResponse(
        id=ob.id,
        book_id=ob.book_id,
        title=ob.book.title,
        publisher_name=ob.book.publisher.name,
        ps_charge=ob.book.ps_charge,
        total_price=ob.book.total_price,
        status=ob.status,
        deposit_amount=ob.deposit_amount,
        outstanding_amount=outstanding,
        created_at=ob.created_at,
        updated_at=ob.updated_at,
    )


def _build_order_detail(order: Order) -> OrderDetail:
    ob_responses = [_build_order_book_response(ob) for ob in order.order_books]
    total_outstanding = sum(r.outstanding_amount for r in ob_responses)
    return OrderDetail(
        id=order.id,
        user_id=order.user_id,
        status=order.status,
        postage_type=order.postage_type,
        postage_amount=order.postage_amount,
        address=order.address,
        note=order.note,
        created_at=order.created_at,
        updated_at=order.updated_at,
        order_books=ob_responses,
        total_outstanding=total_outstanding,
        customer_name=order.user.name if order.user else "",
        customer_phone=order.user.phone_number if order.user else "",
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
            (User.name.ilike(f"%{search}%"))
            | (User.phone_number.ilike(f"%{search}%"))
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
            .selectinload(Book.publisher)
        )
        .where(User.id == customer_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    # also load user on each order
    for o in user.orders:
        o.user = user
    return CustomerDetail(
        id=user.id,
        name=user.name,
        phone_number=user.phone_number,
        created_at=user.created_at,
        orders=[_build_order_detail(o) for o in user.orders],
    )
```

- [ ] **Step 4: Rewrite `backend/app/routers/orders.py`**

```python
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import Order, Book, OrderBook, OrderStatus, BookStatus, Publisher, POSTAGE_DEFAULTS
from app.schemas import OrderCreate, OrderUpdate, OrderDetail, AddCopiesToOrderRequest, OrderBookUpdate
from app.routers.customers import _build_order_detail, _build_order_book_response

router = APIRouter()


async def _load_order(order_id: int, db: AsyncSession) -> Order:
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.user),
            selectinload(Order.order_books)
            .selectinload(OrderBook.book)
            .selectinload(Book.publisher),
        )
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


async def _validate_and_add_copies(order_id: int, copies, db: AsyncSession):
    for spec in copies:
        book = await db.get(Book, spec.book_id)
        if not book:
            raise HTTPException(status_code=404, detail=f"Book {spec.book_id} not found")
        for _ in range(spec.quantity):
            db.add(OrderBook(order_id=order_id, book_id=spec.book_id))


@router.get("/", response_model=list[OrderDetail])
async def list_orders(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Order).options(
            selectinload(Order.user),
            selectinload(Order.order_books)
            .selectinload(OrderBook.book)
            .selectinload(Book.publisher),
        )
    )
    return [_build_order_detail(o) for o in result.scalars().all()]


@router.post("/", response_model=OrderDetail, status_code=201)
async def create_order(
    data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    postage_amount = data.postage_amount
    if postage_amount is None and data.postage_type is not None:
        postage_amount = Decimal(str(POSTAGE_DEFAULTS[data.postage_type]))

    order = Order(
        user_id=data.user_id,
        postage_type=data.postage_type,
        postage_amount=postage_amount,
        address=data.address,
        note=data.note,
    )
    db.add(order)
    await db.flush()
    await _validate_and_add_copies(order.id, data.copies, db)
    await db.commit()
    db.expire(order)
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
    update_data = data.model_dump(exclude_none=True)
    # auto-fill postage_amount when postage_type changes and no explicit amount given
    if "postage_type" in update_data and "postage_amount" not in update_data:
        update_data["postage_amount"] = Decimal(str(POSTAGE_DEFAULTS[update_data["postage_type"]]))
    for field, value in update_data.items():
        setattr(order, field, value)
    await db.commit()
    db.expire(order)
    return _build_order_detail(await _load_order(order_id, db))


@router.post("/{order_id}/books", response_model=OrderDetail)
async def add_copies_to_order(
    order_id: int,
    data: AddCopiesToOrderRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    order = await _load_order(order_id, db)
    if order.status != OrderStatus.active:
        raise HTTPException(status_code=400, detail="Cannot add books to a cancelled order")
    await _validate_and_add_copies(order_id, data.copies, db)
    await db.commit()
    db.expire(order)
    return _build_order_detail(await _load_order(order_id, db))


@router.patch("/{order_id}/books/{ob_id}", response_model=OrderDetail)
async def update_order_book(
    order_id: int,
    ob_id: int,
    data: OrderBookUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(OrderBook).where(OrderBook.id == ob_id, OrderBook.order_id == order_id)
    )
    ob = result.scalar_one_or_none()
    if not ob:
        raise HTTPException(status_code=404, detail="Order book entry not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(ob, field, value)
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
        ob.status = BookStatus.cancelled
    await db.commit()
    db.expire(order)
    return _build_order_detail(await _load_order(order_id, db))
```

- [ ] **Step 5: Run tests**

```bash
cd backend && uv run pytest tests/test_orders.py -v
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/orders.py backend/app/routers/customers.py backend/tests/test_orders.py
git commit -m "refactor: rewrite orders router — copies-based add, per-copy status/deposit, new postage model"
```

---

### Task 6: Backend dashboard router rewrite + tests

**Files:**
- Modify: `backend/app/routers/dashboard.py`
- Modify: `backend/tests/test_dashboard.py`

- [ ] **Step 1: Write the failing tests**

Replace all of `backend/tests/test_dashboard.py`:

```python
async def _seed(client):
    pub_id = (await client.post("/publishers/", json={"name": "Pub"})).json()["id"]
    cid = (
        await client.post("/customers/", json={"name": "T", "phone_number": "0"})
    ).json()["id"]
    b1 = (
        await client.post(
            "/books/",
            json={
                "title": "B1",
                "publisher_id": pub_id,
                "ps_charge": "soft_cover",
                "total_price": "50.00",
                "deposit_amount": "10.00",
            },
        )
    ).json()["id"]
    b2 = (
        await client.post(
            "/books/",
            json={
                "title": "B2",
                "publisher_id": pub_id,
                "ps_charge": "soft_cover",
                "total_price": "30.00",
                "deposit_amount": "30.00",
            },
        )
    ).json()["id"]
    order = (
        await client.post(
            "/orders/",
            json={
                "user_id": cid,
                "address": "A",
                "copies": [
                    {"book_id": b1, "quantity": 1},
                    {"book_id": b2, "quantity": 1},
                ],
            },
        )
    ).json()
    # mark b2's copy as "delivered" and fully paid
    ob2_id = next(ob["id"] for ob in order["order_books"] if ob["book_id"] == b2)
    await client.patch(
        f"/orders/{order['id']}/books/{ob2_id}",
        json={"status": "delivered", "deposit_amount": "30.00"},
    )
    return order


async def test_dashboard(client):
    await _seed(client)
    resp = await client.get("/dashboard/")
    assert resp.status_code == 200
    data = resp.json()
    # b1 copy is still deposit (outstanding 40), b2 copy is delivered (outstanding 0)
    assert data["total_outstanding"] == 40.0
    assert len(data["copies_with_outstanding"]) == 1
    statuses = {s["status"]: s["count"] for s in data["book_status_counts"]}
    assert statuses["deposit"] == 1
    assert statuses["delivered"] == 1
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest tests/test_dashboard.py -v
```

Expected: failure

- [ ] **Step 3: Rewrite `backend/app/routers/dashboard.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import OrderBook, Book, Publisher
from app.schemas import DashboardResponse, BookStatusCount
from app.routers.customers import _build_order_book_response

router = APIRouter()


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    count_result = await db.execute(
        select(OrderBook.status, func.count(OrderBook.id)).group_by(OrderBook.status)
    )
    status_counts = [
        BookStatusCount(status=row[0], count=row[1]) for row in count_result
    ]

    ob_result = await db.execute(
        select(OrderBook)
        .options(
            selectinload(OrderBook.book).selectinload(Book.publisher)
        )
    )
    all_obs = ob_result.scalars().all()
    outstanding_obs = [
        ob for ob in all_obs
        if float(ob.book.total_price) - float(ob.deposit_amount) > 0
    ]
    total_outstanding = sum(
        float(ob.book.total_price) - float(ob.deposit_amount)
        for ob in outstanding_obs
    )

    return DashboardResponse(
        book_status_counts=status_counts,
        total_outstanding=total_outstanding,
        copies_with_outstanding=sorted(
            [_build_order_book_response(ob) for ob in outstanding_obs],
            key=lambda r: r.created_at,
        ),
    )
```

- [ ] **Step 4: Run tests**

```bash
cd backend && uv run pytest tests/test_dashboard.py -v
```

Expected: all pass

- [ ] **Step 5: Run full test suite**

```bash
cd backend && uv run pytest -v
```

Expected: all tests in test_publishers, test_books, test_orders, test_dashboard pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/dashboard.py backend/tests/test_dashboard.py
git commit -m "refactor: rewrite dashboard — count by OrderBook.status, outstanding per copy"
```

---

### Task 7: Frontend api.ts — update types and API functions

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Rewrite `frontend/lib/api.ts`**

```typescript
import { getAccessToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Types ----

export type BookStatus =
  | "deposit"
  | "paid"
  | "bought"
  | "under_delivery"
  | "delivered"
  | "cancelled";

export type OrderStatus = "active" | "cancelled";
export type PostageType = "semenanjung" | "sabah_sarawak";
export type PsChargeType = "premium" | "hard_cover" | "soft_cover";

export interface Publisher {
  id: number;
  name: string;
  created_at: string;
}

export interface Book {
  id: number;
  title: string;
  publisher_id: number;
  publisher_name: string;
  ps_charge: PsChargeType;
  total_price: number;
  deposit_amount: number;
  created_at: string;
  updated_at: string | null;
}

export interface OrderBook {
  id: number;
  book_id: number;
  title: string;
  publisher_name: string;
  ps_charge: PsChargeType;
  total_price: number;
  status: BookStatus;
  deposit_amount: number;
  outstanding_amount: number;
  created_at: string;
  updated_at: string | null;
}

export interface Order {
  id: number;
  user_id: number;
  status: OrderStatus;
  postage_type: PostageType | null;
  postage_amount: number | null;
  address: string;
  note: string | null;
  created_at: string;
  updated_at: string | null;
  order_books: OrderBook[];
  total_outstanding: number;
  customer_name: string;
  customer_phone: string;
}

export interface Customer {
  id: number;
  name: string;
  phone_number: string;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  orders: Order[];
}

export interface BookStatusCount {
  status: BookStatus;
  count: number;
}

export interface Dashboard {
  book_status_counts: BookStatusCount[];
  total_outstanding: number;
  copies_with_outstanding: OrderBook[];
}

export interface CopySpec {
  book_id: number;
  quantity: number;
}

// ---- API functions ----

export const api = {
  dashboard: {
    get: () => request<Dashboard>("/dashboard/"),
  },

  publishers: {
    list: () => request<Publisher[]>("/publishers/"),
    create: (data: { name: string }) =>
      request<Publisher>("/publishers/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  customers: {
    list: (search?: string) =>
      request<Customer[]>(
        `/customers/${search ? `?search=${encodeURIComponent(search)}` : ""}`
      ),
    get: (id: number) => request<CustomerDetail>(`/customers/${id}`),
    create: (data: { name: string; phone_number: string }) =>
      request<Customer>("/customers/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  orders: {
    list: () => request<Order[]>("/orders/"),
    get: (id: number) => request<Order>(`/orders/${id}`),
    create: (data: {
      user_id: number;
      address: string;
      note?: string;
      postage_type?: PostageType;
      postage_amount?: string;
      copies: CopySpec[];
    }) =>
      request<Order>("/orders/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { address?: string; note?: string; postage_type?: PostageType; postage_amount?: string }) =>
      request<Order>(`/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    addCopies: (id: number, copies: CopySpec[]) =>
      request<Order>(`/orders/${id}/books`, {
        method: "POST",
        body: JSON.stringify({ copies }),
      }),
    updateOrderBook: (orderId: number, obId: number, data: { status?: BookStatus; deposit_amount?: string }) =>
      request<Order>(`/orders/${orderId}/books/${obId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    cancel: (id: number) =>
      request<Order>(`/orders/${id}/cancel`, { method: "PATCH" }),
  },

  books: {
    list: () => request<Book[]>("/books/"),
    create: (data: {
      title: string;
      publisher_id: number;
      ps_charge: PsChargeType;
      total_price: string;
      deposit_amount?: string;
    }) =>
      request<Book>("/books/", { method: "POST", body: JSON.stringify(data) }),
    update: (
      id: number,
      data: {
        title?: string;
        publisher_id?: number;
        ps_charge?: PsChargeType;
        total_price?: string;
        deposit_amount?: string;
      }
    ) =>
      request<Book>(`/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) => request<void>(`/books/${id}`, { method: "DELETE" }),
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "refactor: update api.ts types and functions for new data model"
```

---

### Task 8: Frontend hooks — usePublishers + update existing hooks

**Files:**
- Create: `frontend/hooks/usePublishers.ts`
- Modify: `frontend/hooks/useBooks.ts`
- Modify: `frontend/hooks/useOrders.ts`

- [ ] **Step 1: Create `frontend/hooks/usePublishers.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function usePublishers() {
  return useQuery({
    queryKey: ["publishers"],
    queryFn: api.publishers.list,
  });
}

export function useCreatePublisher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.publishers.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publishers"] });
    },
  });
}
```

- [ ] **Step 2: Rewrite `frontend/hooks/useBooks.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useBooks() {
  return useQuery({
    queryKey: ["books"],
    queryFn: api.books.list,
  });
}

export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.books.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export function useUpdateBook(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.books.update>[1]) =>
      api.books.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.books.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
```

- [ ] **Step 3: Rewrite `frontend/hooks/useOrders.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, PostageType, CopySpec } from "@/lib/api";

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: api.orders.list,
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: () => api.orders.get(id),
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.orders.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateOrder(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { address?: string; note?: string; postage_type?: PostageType; postage_amount?: string }) =>
      api.orders.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useAddCopiesToOrder(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (copies: CopySpec[]) => api.orders.addCopies(orderId, copies),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateOrderBook(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obId, data }: { obId: number; data: { status?: string; deposit_amount?: string } }) =>
      api.orders.updateOrderBook(orderId, obId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", orderId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.orders.cancel,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["orders", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/hooks/usePublishers.ts frontend/hooks/useBooks.ts frontend/hooks/useOrders.ts
git commit -m "refactor: update hooks — usePublishers, useAddCopiesToOrder, useUpdateOrderBook"
```

---

### Task 9: Frontend books page — publisher/ps_charge

**Files:**
- Modify: `frontend/app/(dashboard)/books/page.tsx`

- [ ] **Step 1: Rewrite `frontend/app/(dashboard)/books/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useBooks, useCreateBook, useDeleteBook } from "@/hooks/useBooks";
import { usePublishers, useCreatePublisher } from "@/hooks/usePublishers";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Book, PsChargeType } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

const PS_CHARGE_OPTIONS: { value: PsChargeType; label: string }[] = [
  { value: "premium", label: "Premium (RM 10)" },
  { value: "hard_cover", label: "Hard Cover (RM 8)" },
  { value: "soft_cover", label: "Soft Cover (RM 5)" },
];

function BookRow({ book, onDelete }: { book: Book; onDelete: () => void }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{book.title}</TableCell>
      <TableCell className="text-muted-foreground">{book.publisher_name}</TableCell>
      <TableCell className="text-muted-foreground capitalize">
        {book.ps_charge.replace("_", " ")}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        RM {Number(book.total_price).toFixed(2)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        RM {Number(book.deposit_amount).toFixed(2)}
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AddBookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createBook = useCreateBook();
  const createPublisher = useCreatePublisher();
  const { data: publishers } = usePublishers();

  const [title, setTitle] = useState("");
  const [publisherId, setPublisherId] = useState<string>("");
  const [newPublisherName, setNewPublisherName] = useState("");
  const [showNewPublisher, setShowNewPublisher] = useState(false);
  const [psCharge, setPsCharge] = useState<PsChargeType | "">("");
  const [totalPrice, setTotalPrice] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  function reset() {
    setTitle("");
    setPublisherId("");
    setNewPublisherName("");
    setShowNewPublisher(false);
    setPsCharge("");
    setTotalPrice("");
    setDepositAmount("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let resolvedPublisherId = Number(publisherId);

    if (showNewPublisher && newPublisherName.trim()) {
      const pub = await createPublisher.mutateAsync({ name: newPublisherName.trim() });
      resolvedPublisherId = pub.id;
    }

    if (!resolvedPublisherId || !psCharge) return;

    await createBook.mutateAsync({
      title,
      publisher_id: resolvedPublisherId,
      ps_charge: psCharge,
      total_price: totalPrice,
      deposit_amount: depositAmount || "0",
    });
    reset();
    onClose();
  }

  const isPending = createBook.isPending || createPublisher.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Book</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
            />
          </div>

          <div className="space-y-1">
            <Label>Publisher *</Label>
            {showNewPublisher ? (
              <div className="flex gap-2">
                <Input
                  value={newPublisherName}
                  onChange={(e) => setNewPublisherName(e.target.value)}
                  placeholder="New publisher name"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewPublisher(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={publisherId} onValueChange={(v) => v && setPublisherId(v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select publisher…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(publishers ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewPublisher(true)}
                >
                  <Plus size={14} />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>PS Charge *</Label>
            <Select value={psCharge} onValueChange={(v) => v && setPsCharge(v as PsChargeType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select PS charge type…" />
              </SelectTrigger>
              <SelectContent>
                {PS_CHARGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Total price (RM) *</Label>
              <Input
                required
                type="number"
                step="0.01"
                min="0"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Deposit paid (RM)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add Book"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BooksPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: books, isLoading } = useBooks();
  const deleteBook = useDeleteBook();

  async function handleDelete() {
    if (deleteId == null) return;
    await deleteBook.mutateAsync(deleteId);
    setDeleteId(null);
  }

  return (
    <PageShell
      title="Books"
      action={
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} className="mr-1" />
          Add Book
        </Button>
      }
    >
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Publisher</TableHead>
              <TableHead>PS Charge</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Deposit</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(books ?? []).map((book) => (
              <BookRow
                key={book.id}
                book={book}
                onDelete={() => setDeleteId(book.id)}
              />
            ))}
            {books?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No books found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <AddBookDialog open={addOpen} onClose={() => setAddOpen(false)} />

      <AlertDialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this book?</AlertDialogTitle>
            <AlertDialogDescription>
              The book will be permanently removed from the catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/(dashboard)/books/page.tsx
git commit -m "refactor: books page — publisher/ps_charge fields, remove author/status"
```

---

### Task 10: Frontend orders new page — updated postage options

**Files:**
- Modify: `frontend/app/(dashboard)/orders/new/page.tsx`

- [ ] **Step 1: Update `orders/new/page.tsx`**

Change the imports and POSTAGE_OPTIONS, update `OrderCreate` call to use `copies`, and use new postage values:

Replace the top section of the file:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import { useCreateOrder } from "@/hooks/useOrders";
import { useBooks } from "@/hooks/useBooks";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PostageType } from "@/lib/api";

const POSTAGE_OPTIONS: { value: PostageType; label: string; amount: string }[] = [
  { value: "semenanjung", label: "Semenanjung (RM 8)", amount: "8.00" },
  { value: "sabah_sarawak", label: "Sabah / Sarawak (RM 16)", amount: "16.00" },
];

export default function NewOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — customer
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const { data: customers } = useCustomers(customerSearch || undefined);

  // Step 2 — book selection with quantities
  const [steppers, setSteppers] = useState<Record<number, number>>({});
  const { data: availableBooks } = useBooks();

  // Step 3 — delivery
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [postageType, setPostageType] = useState<PostageType | "">("");

  const createOrder = useCreateOrder();

  function increment(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function decrement(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  }

  const totalSelected = Object.values(steppers).reduce((s, n) => s + n, 0);

  async function handleSubmit() {
    if (!customerId || totalSelected === 0) return;
    const copies = Object.entries(steppers)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ book_id: Number(id), quantity: qty }));
    const order = await createOrder.mutateAsync({
      user_id: customerId,
      address,
      note: note || undefined,
      postage_type: postageType || undefined,
      copies,
    });
    router.push(`/orders/${order.id}`);
  }

  const selectedCustomer = customers?.find((c) => c.id === customerId);
```

Then Step 2 body changes from checkbox to stepper rows:

```typescript
  // Step 2: Select books with quantities
  {step === 2 && (
    <div className="space-y-4">
      <h2 className="font-medium">
        Select books for {selectedCustomer?.name}
      </h2>

      {!availableBooks || availableBooks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No books in catalog. Add books on the Books page first.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {availableBooks.map((book) => {
            const count = steppers[book.id] ?? 0;
            return (
              <div
                key={book.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border"
              >
                <div className="min-w-0 flex-1 mr-3">
                  <p className="font-medium text-sm">{book.title}</p>
                  <p className="text-xs text-muted-foreground">{book.publisher_name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    RM {Number(book.total_price).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => decrement(book.id)}
                    disabled={count === 0}
                    className="w-7 h-7 rounded border flex items-center justify-center text-sm font-medium disabled:opacity-30 hover:bg-accent transition-colors"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm tabular-nums">{count}</span>
                  <button
                    type="button"
                    onClick={() => increment(book.id)}
                    className="w-7 h-7 rounded border flex items-center justify-center text-sm font-medium hover:bg-accent transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalSelected > 0 && (
        <p className="text-sm text-muted-foreground">
          {totalSelected} cop{totalSelected !== 1 ? "ies" : "y"} selected
        </p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
        <Button onClick={() => setStep(3)} disabled={totalSelected === 0}>
          Next: Delivery
        </Button>
      </div>
    </div>
  )}
```

Full rewrite of `frontend/app/(dashboard)/orders/new/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import { useCreateOrder } from "@/hooks/useOrders";
import { useBooks } from "@/hooks/useBooks";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PostageType } from "@/lib/api";

const POSTAGE_OPTIONS: { value: PostageType; label: string }[] = [
  { value: "semenanjung", label: "Semenanjung (RM 8)" },
  { value: "sabah_sarawak", label: "Sabah / Sarawak (RM 16)" },
];

export default function NewOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const { data: customers } = useCustomers(customerSearch || undefined);

  const [steppers, setSteppers] = useState<Record<number, number>>({});
  const { data: availableBooks } = useBooks();

  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [postageType, setPostageType] = useState<PostageType | "">("");

  const createOrder = useCreateOrder();

  function increment(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function decrement(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  }

  const totalSelected = Object.values(steppers).reduce((s, n) => s + n, 0);

  async function handleSubmit() {
    if (!customerId || totalSelected === 0) return;
    const copies = Object.entries(steppers)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ book_id: Number(id), quantity: qty }));
    const order = await createOrder.mutateAsync({
      user_id: customerId,
      address,
      note: note || undefined,
      postage_type: postageType || undefined,
      copies,
    });
    router.push(`/orders/${order.id}`);
  }

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  return (
    <PageShell title="New Order">
      <div className="flex items-center gap-2 text-sm">
        {["Customer", "Books", "Delivery"].map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const active = step === n;
          return (
            <span key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                    ? "border-2 border-primary text-primary"
                    : "border text-muted-foreground"
                }`}
              >
                {n}
              </span>
              <span className={active ? "font-medium" : "text-muted-foreground"}>
                {label}
              </span>
              {i < 2 && <span className="text-muted-foreground mx-1">→</span>}
            </span>
          );
        })}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-medium">Select a customer</h2>
          <Input
            placeholder="Search by name or phone…"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(customers ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCustomerId(c.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  customerId === c.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                }`}
              >
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.phone_number}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!customerId}>
              Next: Books
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-medium">Select books for {selectedCustomer?.name}</h2>
          {!availableBooks || availableBooks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No books in catalog. Add books on the Books page first.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableBooks.map((book) => {
                const count = steppers[book.id] ?? 0;
                return (
                  <div
                    key={book.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="font-medium text-sm">{book.title}</p>
                      <p className="text-xs text-muted-foreground">{book.publisher_name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        RM {Number(book.total_price).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => decrement(book.id)}
                        disabled={count === 0}
                        className="w-7 h-7 rounded border flex items-center justify-center text-sm font-medium disabled:opacity-30 hover:bg-accent transition-colors"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">{count}</span>
                      <button
                        type="button"
                        onClick={() => increment(book.id)}
                        className="w-7 h-7 rounded border flex items-center justify-center text-sm font-medium hover:bg-accent transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {totalSelected > 0 && (
            <p className="text-sm text-muted-foreground">
              {totalSelected} cop{totalSelected !== 1 ? "ies" : "y"} selected
            </p>
          )}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={totalSelected === 0}>
              Next: Delivery
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-medium">Delivery details</h2>
          <div className="space-y-3 max-w-md">
            <div className="space-y-1">
              <label className="text-sm font-medium">Address *</label>
              <Textarea
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full delivery address"
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Note</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any special instructions…"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Postage type</label>
              <Select
                value={postageType}
                onValueChange={(v) => v && setPostageType(v as PostageType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select postage…" />
                </SelectTrigger>
                <SelectContent>
                  {POSTAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button
              onClick={handleSubmit}
              disabled={!address || createOrder.isPending}
            >
              {createOrder.isPending ? "Creating…" : "Create order"}
            </Button>
          </div>
          {createOrder.isError && (
            <p className="text-destructive text-sm">Failed to create order. Please try again.</p>
          )}
        </div>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/(dashboard)/orders/new/page.tsx
git commit -m "refactor: orders/new — stepper book selection, semenanjung/sabah_sarawak postage"
```

---

### Task 11: Frontend order detail page — OrderBook-level status/deposit

**Files:**
- Modify: `frontend/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Step 1: Rewrite `frontend/app/(dashboard)/orders/[id]/page.tsx`**

```typescript
"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useOrder, useCancelOrder, useUpdateOrder, useAddCopiesToOrder, useUpdateOrderBook } from "@/hooks/useOrders";
import { useBooks } from "@/hooks/useBooks";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { PostageBadge } from "@/components/PostageBadge";
import { PriceSummary } from "@/components/PriceSummary";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronLeft, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { BookStatus, OrderBook, CopySpec } from "@/lib/api";

const BOOK_STATUSES: BookStatus[] = [
  "deposit",
  "paid",
  "bought",
  "under_delivery",
  "delivered",
  "cancelled",
];

function AddBooksDialog({
  orderId,
  open,
  onClose,
}: {
  orderId: number;
  open: boolean;
  onClose: () => void;
}) {
  const { data: allBooks } = useBooks();
  const addCopies = useAddCopiesToOrder(orderId);
  const [steppers, setSteppers] = useState<Record<number, number>>({});

  const books = allBooks ?? [];
  const totalToAdd = Object.values(steppers).reduce((s, n) => s + n, 0);

  function increment(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function decrement(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  }

  function handleClose() {
    setSteppers({});
    onClose();
  }

  async function handleAdd() {
    if (totalToAdd === 0) return;
    const copies: CopySpec[] = Object.entries(steppers)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ book_id: Number(id), quantity: qty }));
    await addCopies.mutateAsync(copies);
    setSteppers({});
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Books to Order</DialogTitle>
        </DialogHeader>

        {books.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No books in catalog. Add books from the Books page first.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {books.map((book) => {
              const count = steppers[book.id] ?? 0;
              return (
                <div
                  key={book.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="font-medium text-sm">{book.title}</p>
                    <p className="text-xs text-muted-foreground">{book.publisher_name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      RM {Number(book.total_price).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => decrement(book.id)}
                      disabled={count === 0}
                      className="w-7 h-7 rounded border flex items-center justify-center text-sm font-medium disabled:opacity-30 hover:bg-accent transition-colors"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">{count}</span>
                    <button
                      type="button"
                      onClick={() => increment(book.id)}
                      className="w-7 h-7 rounded border flex items-center justify-center text-sm font-medium hover:bg-accent transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={totalToAdd === 0 || addCopies.isPending}>
            {addCopies.isPending
              ? "Adding…"
              : `Add ${totalToAdd > 0 ? totalToAdd : ""} Book${totalToAdd !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderBookRow({ ob, orderId }: { ob: OrderBook; orderId: number }) {
  const updateOrderBook = useUpdateOrderBook(orderId);
  const [editing, setEditing] = useState(false);
  const [deposit, setDeposit] = useState(ob.deposit_amount.toString());

  async function handleStatusChange(status: BookStatus) {
    if (status === "paid" && ob.outstanding_amount > 0) return;
    await updateOrderBook.mutateAsync({ obId: ob.id, data: { status } });
  }

  async function handleDepositSave() {
    await updateOrderBook.mutateAsync({ obId: ob.id, data: { deposit_amount: deposit } });
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-2 py-3 border-b last:border-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{ob.title}</p>
          <p className="text-xs text-muted-foreground">{ob.publisher_name}</p>
        </div>
        <Select value={ob.status} onValueChange={(v) => v && handleStatusChange(v as BookStatus)}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOOK_STATUSES.map((s) => {
              const disabled = s === "paid" && ob.outstanding_amount > 0;
              return (
                <SelectItem key={s} value={s} className="text-xs" disabled={disabled}>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s} />
                    {disabled && (
                      <span className="text-muted-foreground text-xs">(clear balance first)</span>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end gap-3 text-xs">
        <PriceSummary
          totalPrice={ob.total_price}
          depositAmount={ob.deposit_amount}
          outstandingAmount={ob.outstanding_amount}
        />
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              className="h-7 w-24 text-xs"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
            <Button size="sm" className="h-7 text-xs px-2" onClick={handleDepositSave}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2"
            onClick={() => {
              setDeposit(ob.deposit_amount.toString());
              setEditing(true);
            }}
          >
            Edit deposit
          </Button>
        )}
      </div>
    </div>
  );
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: order, isLoading, error } = useOrder(Number(id));
  const cancelOrder = useCancelOrder();
  const updateOrder = useUpdateOrder(Number(id));
  const [cancelOpen, setCancelOpen] = useState(false);
  const [addBooksOpen, setAddBooksOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [address, setAddress] = useState("");
  const [editingPostage, setEditingPostage] = useState(false);
  const [postageAmount, setPostageAmount] = useState("");

  if (isLoading) {
    return (
      <PageShell title="Order">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </PageShell>
    );
  }

  if (error || !order) {
    return (
      <PageShell title="Order">
        <p className="text-destructive text-sm">Order not found.</p>
      </PageShell>
    );
  }

  async function handleCancel() {
    await cancelOrder.mutateAsync(Number(id));
    setCancelOpen(false);
  }

  async function handleAddressSave() {
    await updateOrder.mutateAsync({ address });
    setEditingAddress(false);
  }

  async function handlePostageSave() {
    await updateOrder.mutateAsync({ postage_amount: postageAmount });
    setEditingPostage(false);
  }

  return (
    <PageShell
      title={`Order #${order.id}`}
      action={
        <div className="flex items-center gap-2">
          {order.status === "active" && (
            <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
              Cancel order
            </Button>
          )}
          <Link href="/orders" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ChevronLeft size={14} />
            Back
          </Link>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status} />
              {order.postage_type && <PostageBadge type={order.postage_type} />}
            </div>

            <div>
              <p className="text-muted-foreground text-xs mb-1">Address</p>
              {editingAddress ? (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <Button size="sm" className="h-8" onClick={handleAddressSave}>Save</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingAddress(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p>{order.address}</p>
                  {order.status === "active" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => { setAddress(order.address); setEditingAddress(true); }}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </div>

            {order.note && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Note</p>
                <p>{order.note}</p>
              </div>
            )}

            <div>
              <p className="text-muted-foreground text-xs mb-1">Created</p>
              <p>{new Date(order.created_at).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {order.postage_type && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Postage ({order.postage_type === "semenanjung" ? "Semenanjung" : "Sabah/Sarawak"})
                </span>
                {editingPostage ? (
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-7 w-24 text-xs"
                      value={postageAmount}
                      onChange={(e) => setPostageAmount(e.target.value)}
                    />
                    <Button size="sm" className="h-7 text-xs px-2" onClick={handlePostageSave}>Save</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setEditingPostage(false)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>
                      {order.postage_amount != null
                        ? `RM ${Number(order.postage_amount).toFixed(2)}`
                        : "—"}
                    </span>
                    {order.status === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setPostageAmount(order.postage_amount?.toString() ?? "");
                          setEditingPostage(true);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Total outstanding</span>
              <span className={order.total_outstanding > 0 ? "text-destructive" : "text-green-700"}>
                RM {Number(order.total_outstanding).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-sans text-lg font-semibold">
            Books ({order.order_books.length})
          </h2>
          {order.status === "active" && (
            <Button size="sm" variant="outline" onClick={() => setAddBooksOpen(true)}>
              <Plus size={14} className="mr-1" />
              Add Books
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="pt-4">
            {order.order_books.map((ob) => (
              <OrderBookRow key={ob.id} ob={ob} orderId={Number(id)} />
            ))}
          </CardContent>
        </Card>
      </div>

      <AddBooksDialog
        orderId={Number(id)}
        open={addBooksOpen}
        onClose={() => setAddBooksOpen(false)}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order #{order.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the order and all its book copies as cancelled. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/(dashboard)/orders/[id]/page.tsx
git commit -m "refactor: order detail — OrderBook per-copy status/deposit, editable postage amount"
```

---

### Task 12: Frontend orders list page — update postage display

**Files:**
- Modify: `frontend/app/(dashboard)/orders/page.tsx`

- [ ] **Step 1: Update `orders/page.tsx` to use `order_books` instead of `books`**

Read the current file. Find any references to `order.books` and replace with `order.order_books`. Also update the PostageBadge labels if needed to display semenanjung/sabah_sarawak.

```bash
cd frontend && grep -n "order\.books" app/\(dashboard\)/orders/page.tsx
```

Change `order.books` → `order.order_books` and update any postage type labels like "premium" → "Semenanjung" if displayed.

- [ ] **Step 2: Commit**

```bash
git add frontend/app/(dashboard)/orders/page.tsx
git commit -m "fix: orders list page — use order_books, updated postage display"
```

---

### Task 13: Update PostageBadge component

**Files:**
- Modify: `frontend/components/PostageBadge.tsx` (or wherever it is defined)

- [ ] **Step 1: Find and update PostageBadge**

```bash
cd frontend && grep -rn "PostageBadge\|postage_type\|premium\|hard_cover\|soft_cover" components/
```

Update the badge to display "Semenanjung" and "Sabah/Sarawak" instead of "premium"/"hard_cover"/"soft_cover".

- [ ] **Step 2: Commit**

```bash
git add frontend/components/
git commit -m "fix: update PostageBadge for new postage_type values"
```

---

### Task 14: Update supabase/schema.sql

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Rewrite `supabase/schema.sql`**

```sql
-- Jaslin's Pages Inventory Management System
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- WARNING: This drops all existing tables. Back up data first.

DROP TABLE IF EXISTS order_books CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS publishers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS book_status;
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS postage_type;
DROP TYPE IF EXISTS ps_charge_type;

CREATE TYPE book_status AS ENUM (
  'deposit', 'paid', 'bought', 'under_delivery', 'delivered', 'cancelled'
);

CREATE TYPE order_status AS ENUM ('active', 'cancelled');

CREATE TYPE postage_type AS ENUM ('semenanjung', 'sabah_sarawak');

CREATE TYPE ps_charge_type AS ENUM ('premium', 'hard_cover', 'soft_cover');

CREATE TABLE users (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR NOT NULL,
  phone_number VARCHAR NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE publishers (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE books (
  id             SERIAL PRIMARY KEY,
  title          VARCHAR NOT NULL,
  publisher_id   INTEGER NOT NULL REFERENCES publishers(id),
  ps_charge      ps_charge_type NOT NULL,
  total_price    NUMERIC(10, 2) NOT NULL,
  deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ
);

CREATE TABLE orders (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  status         order_status NOT NULL DEFAULT 'active',
  postage_type   postage_type,
  postage_amount NUMERIC(10, 2),
  address        VARCHAR NOT NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ
);

CREATE TABLE order_books (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  book_id        INTEGER NOT NULL REFERENCES books(id),
  status         book_status NOT NULL DEFAULT 'deposit',
  deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ
);

-- Enable RLS (backend connects as postgres superuser, bypasses RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_books ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "refactor: update schema.sql for new data model"
```

---

### Task 15: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md data model section**

In `CLAUDE.md`, update the Data Model section to reflect:
- `Publisher` table (id, name)
- `Book`: publisher_id, ps_charge, total_price, deposit_amount (no status, no author, no separate Price table)
- `OrderBook`: auto-PK id, status, deposit_amount per copy
- `Order`: postage_type (semenanjung/sabah_sarawak), postage_amount
- PS_CHARGE_RATES: premium=10, hard_cover=8, soft_cover=5
- POSTAGE_DEFAULTS: semenanjung=8, sabah_sarawak=16
- Outstanding per copy = book.total_price - order_book.deposit_amount

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for new data model"
```

---

## Self-Review

**Spec coverage:**
- Publisher table and router: Task 3 ✓
- Book as catalog (no status/author, add publisher_id/ps_charge): Tasks 1, 2, 4 ✓
- OrderBook with auto-PK, status, deposit_amount per copy: Tasks 1, 2, 5 ✓
- Order postage_type (semenanjung/sabah_sarawak) + postage_amount: Tasks 1, 2, 5 ✓
- Per-copy status/deposit editing via `PATCH /orders/{id}/books/{ob_id}`: Task 5, 11 ✓
- Dashboard counts by OrderBook.status: Task 6 ✓
- Frontend all pages updated: Tasks 7–13 ✓
- Supabase schema.sql updated: Task 14 ✓

**Type consistency check:**
- `_build_order_book_response` defined in customers.py (Task 5 Step 3), imported in orders.py and dashboard.py ✓
- `OrderBookResponse` schema used in `OrderDetail.order_books` ✓
- `useAddCopiesToOrder` → `api.orders.addCopies` ✓
- `useUpdateOrderBook` → `api.orders.updateOrderBook` ✓
- `order.order_books` (not `order.books`) used in frontend ✓
- `POSTAGE_DEFAULTS` (not `POSTAGE_RATES`) imported in orders.py ✓

**PostageBadge note:** Task 13 instructs to grep first since the component path isn't known. This is intentional — find the actual file rather than assuming the path.
