from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import Order, Book, Price, OrderBook, OrderStatus, BookStatus
from app.schemas import OrderCreate, OrderUpdate, OrderDetail
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
        selectinload(Order.order_books)
        .selectinload(OrderBook.book)
        .selectinload(Book.price)
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
        book = Book(
            title=book_data.title,
            author=book_data.author,
            status=book_data.status,
        )
        db.add(book)
        await db.flush()
        db.add(
            Price(
                book_id=book.id,
                total_price=book_data.price.total_price,
                deposit_amount=book_data.price.deposit_amount,
            )
        )
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
