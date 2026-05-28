from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import customers, orders, books, dashboard, publishers
from app.config import settings

app = FastAPI(title="Bookstore Inventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customers.router, prefix="/customers", tags=["customers"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(books.router, prefix="/books", tags=["books"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(publishers.router, prefix="/publishers", tags=["publishers"])
