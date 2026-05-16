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
