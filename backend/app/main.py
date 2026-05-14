from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import customers

app = FastAPI(title="Bookstore Inventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customers.router, prefix="/customers", tags=["customers"])
