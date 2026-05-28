from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import Order, Book, OrderBook, OrderStatus, BookStatus, POSTAGE_DEFAULTS
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
        result = await db.execute(select(Book).where(Book.id == spec.book_id))
        book = result.scalar_one_or_none()
        if not book:
            raise HTTPException(status_code=404, detail=f"Book {spec.book_id} not found")
        for _ in range(spec.quantity):
            db.add(OrderBook(order_id=order_id, book_id=spec.book_id, deposit_amount=book.deposit_amount))


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
    order_id = order.id
    await _validate_and_add_copies(order_id, data.copies, db)
    await db.commit()
    db.expire(order)
    return _build_order_detail(await _load_order(order_id, db))


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


@router.patch("/{order_id}/reactivate", response_model=OrderDetail)
async def reactivate_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    order = await _load_order(order_id, db)
    if order.status != OrderStatus.cancelled:
        raise HTTPException(status_code=400, detail="Order is not cancelled")
    order.status = OrderStatus.active
    for ob in order.order_books:
        ob.status = BookStatus.deposit
    await db.commit()
    db.expire(order)
    return _build_order_detail(await _load_order(order_id, db))
