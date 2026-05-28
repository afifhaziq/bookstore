from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.models import BookStatus, OrderStatus, PostageType, PsChargeType


class CustomerCreate(BaseModel):
    name: str
    phone_number: str
    default_address: str | None = None


class CustomerResponse(BaseModel):
    id: int
    name: str
    phone_number: str
    default_address: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone_number: str | None = None
    default_address: str | None = None


class PublisherCreate(BaseModel):
    name: str


class PublisherResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    model_config = {"from_attributes": True}


class BookCreate(BaseModel):
    title: str
    publisher_id: int
    ps_charge: PsChargeType
    total_price: Decimal
    deposit_amount: Decimal = Decimal("0")


class BookUpdate(BaseModel):
    title: Optional[str] = None
    publisher_id: Optional[int] = None
    ps_charge: Optional[PsChargeType] = None
    total_price: Optional[Decimal] = None
    deposit_amount: Optional[Decimal] = None


class BookResponse(BaseModel):
    id: int
    title: str
    publisher_id: int
    publisher_name: str
    ps_charge: PsChargeType
    total_price: Decimal
    deposit_amount: Decimal
    created_at: datetime
    updated_at: Optional[datetime]
    model_config = {"from_attributes": True}


class OrderBookResponse(BaseModel):
    id: int
    book_id: int
    title: str
    publisher_name: str
    ps_charge: PsChargeType
    total_price: Decimal
    status: BookStatus
    deposit_amount: Decimal
    outstanding_amount: float
    created_at: datetime
    updated_at: Optional[datetime]


class OrderBookUpdate(BaseModel):
    status: Optional[BookStatus] = None
    deposit_amount: Optional[Decimal] = None


class CopySpec(BaseModel):
    book_id: int
    quantity: int = Field(1, ge=1, le=50)


class OrderCreate(BaseModel):
    user_id: int
    postage_type: Optional[PostageType] = None
    postage_amount: Optional[Decimal] = None
    address: str
    note: Optional[str] = None
    copies: list[CopySpec] = []


class OrderUpdate(BaseModel):
    postage_type: Optional[PostageType] = None
    postage_amount: Optional[Decimal] = None
    postage_paid: Optional[bool] = None
    address: Optional[str] = None
    note: Optional[str] = None


class AddCopiesToOrderRequest(BaseModel):
    copies: list[CopySpec] = []


class OrderDetail(BaseModel):
    id: int
    user_id: int
    status: OrderStatus
    postage_type: Optional[PostageType]
    postage_amount: Optional[Decimal]
    postage_paid: bool
    address: str
    note: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    order_books: list[OrderBookResponse]
    total_outstanding: float
    customer_name: str
    customer_phone: str
    model_config = {"from_attributes": True}


class CustomerDetail(CustomerResponse):
    orders: list[OrderDetail]


class BookStatusCount(BaseModel):
    status: BookStatus
    count: int


class DashboardResponse(BaseModel):
    book_status_counts: list[BookStatusCount]
    total_outstanding: float
    copies_with_outstanding: list[OrderBookResponse]
