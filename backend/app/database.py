from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings

_is_postgres = settings.DATABASE_URL.startswith("postgresql")
engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args={"ssl": "require"} if _is_postgres else {},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
