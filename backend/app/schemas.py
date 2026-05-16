from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.models import BookStatus, OrderStatus, PostageType


class CustomerCreate(BaseModel):
    name: str
    phone_number: str


class CustomerResponse(BaseModel):
    id: int
    name: str
    phone_number: str
    created_at: datetime
    model_config = {"from_attributes": True}


class PriceCreate(BaseModel):
    total_price: Decimal
    deposit_amount: Decimal = Decimal("0")


class PriceResponse(BaseModel):
    total_price: Decimal
    deposit_amount: Decimal
    outstanding_amount: float
    model_config = {"from_attributes": True}


class BookCreate(BaseModel):
    title: str
    author: Optional[str] = None
    status: BookStatus = BookStatus.deposit
    price: PriceCreate


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    status: Optional[BookStatus] = None
    total_price: Optional[Decimal] = None
    deposit_amount: Optional[Decimal] = None


class BookResponse(BaseModel):
    id: int
    title: str
    author: Optional[str]
    status: BookStatus
    created_at: datetime
    updated_at: Optional[datetime]
    price: Optional[PriceResponse]
    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    user_id: int
    postage_type: Optional[PostageType] = None
    address: str
    note: Optional[str] = None
    book_ids: list[int]


class OrderUpdate(BaseModel):
    postage_type: Optional[PostageType] = None
    address: Optional[str] = None
    note: Optional[str] = None


class NewBookSpec(BaseModel):
    title: str
    author: Optional[str] = None
    total_price: Decimal
    deposit_amount: Decimal = Decimal("0")
    quantity: int = Field(1, ge=1, le=50)


class AddBooksToOrderRequest(BaseModel):
    book_ids: list[int] = []
    new_books: list[NewBookSpec] = []


class OrderResponse(BaseModel):
    id: int
    user_id: int
    status: OrderStatus
    postage_type: Optional[PostageType]
    address: str
    note: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    model_config = {"from_attributes": True}


class OrderDetail(OrderResponse):
    books: list[BookResponse]
    postage_charge: Optional[float]
    total_outstanding: float
    customer_name: str
    customer_phone: str


class CustomerDetail(CustomerResponse):
    orders: list[OrderDetail]


class BookStatusCount(BaseModel):
    status: BookStatus
    count: int


class DashboardResponse(BaseModel):
    book_status_counts: list[BookStatusCount]
    total_outstanding: float
    books_with_outstanding: list[BookResponse]
