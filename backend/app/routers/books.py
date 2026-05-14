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
        id=book.id,
        title=book.title,
        author=book.author,
        status=book.status,
        created_at=book.created_at,
        updated_at=book.updated_at,
        price=PriceResponse(
            total_price=book.price.total_price,
            deposit_amount=book.price.deposit_amount,
            outstanding_amount=book.price.outstanding_amount,
        )
        if book.price
        else None,
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
        raise HTTPException(
            status_code=400, detail="Cannot delete book from a cancelled order"
        )
    book = await _load_book(book_id, db)
    # Remove junction row first to avoid FK constraint on delete
    if ob:
        await db.delete(ob)
        await db.flush()
    await db.delete(book)
    await db.commit()
