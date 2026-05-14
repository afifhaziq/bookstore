from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.auth import get_current_user
from app.models import Book
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
    status_counts = [
        BookStatusCount(status=row[0], count=row[1]) for row in count_result
    ]

    books_result = await db.execute(
        select(Book).options(selectinload(Book.price))
    )
    all_books = books_result.scalars().all()
    outstanding_books = [
        b for b in all_books if b.price and b.price.outstanding_amount > 0
    ]
    total_outstanding = sum(b.price.outstanding_amount for b in outstanding_books)

    def _resp(b: Book) -> BookResponse:
        return BookResponse(
            id=b.id,
            title=b.title,
            author=b.author,
            status=b.status,
            created_at=b.created_at,
            updated_at=b.updated_at,
            price=PriceResponse(
                total_price=b.price.total_price,
                deposit_amount=b.price.deposit_amount,
                outstanding_amount=b.price.outstanding_amount,
            )
            if b.price
            else None,
        )

    return DashboardResponse(
        book_status_counts=status_counts,
        total_outstanding=total_outstanding,
        books_with_outstanding=sorted(
            [_resp(b) for b in outstanding_books],
            key=lambda b: b.created_at,
        ),
    )
