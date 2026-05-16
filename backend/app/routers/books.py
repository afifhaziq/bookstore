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
