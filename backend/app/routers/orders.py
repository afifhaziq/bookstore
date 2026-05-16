from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import Order, Book, Price, OrderBook, OrderStatus, BookStatus, User
from app.schemas import OrderCreate, OrderUpdate, OrderDetail, AddBooksToOrderRequest
from app.routers.customers import _build_order_detail

router = APIRouter()


async def _load_order(order_id: int, db: AsyncSession) -> Order:
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.user),
            selectinload(Order.order_books)
            .selectinload(OrderBook.book)
            .selectinload(Book.price),
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
        selectinload(Order.user),
        selectinload(Order.order_books)
        .selectinload(OrderBook.book)
        .selectinload(Book.price),
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

    for book_id in data.book_ids:
        result = await db.execute(select(Book).where(Book.id == book_id))
        book = result.scalar_one_or_none()
        if not book:
            raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
        db.add(OrderBook(order_id=order.id, book_id=book_id))

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


@router.post("/{order_id}/books", response_model=OrderDetail)
async def add_books_to_order(
    order_id: int,
    data: AddBooksToOrderRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    order = await _load_order(order_id, db)
    if order.status != OrderStatus.active:
        raise HTTPException(status_code=400, detail="Cannot add books to a cancelled order")

    existing_book_ids = {ob.book_id for ob in order.order_books}

    for book_id in data.book_ids:
        if book_id in existing_book_ids:
            continue
        result = await db.execute(select(Book).where(Book.id == book_id))
        book = result.scalar_one_or_none()
        if not book:
            raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
        db.add(OrderBook(order_id=order_id, book_id=book_id))

    for spec in data.new_books:
        for _ in range(spec.quantity):
            book = Book(title=spec.title, author=spec.author)
            db.add(book)
            await db.flush()
            db.add(Price(book_id=book.id, total_price=spec.total_price, deposit_amount=spec.deposit_amount))
            db.add(OrderBook(order_id=order_id, book_id=book.id))

    await db.commit()
    db.expire(order)
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
