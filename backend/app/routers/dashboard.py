from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import OrderBook, Book
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
        select(OrderBook).options(
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
