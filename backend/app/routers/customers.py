from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Order, OrderBook, Book, PS_CHARGE_RATES
from app.schemas import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerDetail,
    OrderDetail,
    OrderBookResponse,
)

router = APIRouter()


def _build_order_book_response(ob: OrderBook) -> OrderBookResponse:
    ps_rate = PS_CHARGE_RATES[ob.book.ps_charge]
    total = float(ob.book.total_price) + ps_rate
    outstanding = total - float(ob.deposit_amount)
    return OrderBookResponse(
        id=ob.id,
        book_id=ob.book_id,
        title=ob.book.title,
        publisher_name=ob.book.publisher.name,
        ps_charge=ob.book.ps_charge,
        total_price=total,
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
        postage_paid=order.postage_paid,
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


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == customer_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    if data.name is not None:
        user.name = data.name
    if data.phone_number is not None:
        user.phone_number = data.phone_number
    if data.default_address is not None:
        user.default_address = data.default_address
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == customer_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    await db.delete(user)
    await db.commit()


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
    for o in user.orders:
        o.user = user
    return CustomerDetail(
        id=user.id,
        name=user.name,
        phone_number=user.phone_number,
        default_address=user.default_address,
        created_at=user.created_at,
        orders=[_build_order_detail(o) for o in user.orders],
    )
