from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Order, OrderBook, Book, POSTAGE_RATES
from app.schemas import (
    CustomerCreate,
    CustomerResponse,
    CustomerDetail,
    OrderDetail,
    BookResponse,
    PriceResponse,
)

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
            )
            if ob.book.price
            else None,
        )
        for ob in order.order_books
    ]
    total_outstanding = sum(
        b.price.outstanding_amount for b in books if b.price
    )
    postage_charge = (
        POSTAGE_RATES.get(order.postage_type) if order.postage_type else None
    )
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
            .selectinload(Book.price)
        )
        .where(User.id == customer_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerDetail(
        id=user.id,
        name=user.name,
        phone_number=user.phone_number,
        created_at=user.created_at,
        orders=[_build_order_detail(o) for o in user.orders],
    )
