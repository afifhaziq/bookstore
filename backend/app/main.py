from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import customers, orders

app = FastAPI(title="Bookstore Inventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customers.router, prefix="/customers", tags=["customers"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
