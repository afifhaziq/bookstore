import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, Enum, ForeignKey
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class BookStatus(str, enum.Enum):
    deposit = "deposit"
    paid = "paid"
    bought = "bought"
    under_delivery = "under_delivery"
    delivered = "delivered"
    cancelled = "cancelled"


class OrderStatus(str, enum.Enum):
    active = "active"
    cancelled = "cancelled"


class PostageType(str, enum.Enum):
    semenanjung = "semenanjung"
    sabah_sarawak = "sabah_sarawak"


class PsChargeType(str, enum.Enum):
    premium = "premium"
    hard_cover = "hard_cover"
    soft_cover = "soft_cover"


POSTAGE_DEFAULTS: dict[PostageType, float] = {
    PostageType.semenanjung: 8.00,
    PostageType.sabah_sarawak: 16.00,
}

PS_CHARGE_RATES: dict[PsChargeType, float] = {
    PsChargeType.premium: 10.00,
    PsChargeType.hard_cover: 8.00,
    PsChargeType.soft_cover: 5.00,
}


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    default_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    orders = relationship("Order", back_populates="user")


class Publisher(Base):
    __tablename__ = "publishers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    books = relationship("Book", back_populates="publisher")


class Book(Base):
    __tablename__ = "books"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    publisher_id = Column(Integer, ForeignKey("publishers.id"), nullable=False)
    ps_charge = Column(
        Enum(PsChargeType, name="ps_charge_type", native_enum=False),
        nullable=False,
    )
    total_price = Column(Numeric(10, 2), nullable=False)
    deposit_amount = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    publisher = relationship("Publisher", back_populates="books")
    order_books = relationship("OrderBook", back_populates="book")


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(
        Enum(OrderStatus, name="order_status", native_enum=False),
        nullable=False,
        default=OrderStatus.active,
    )
    postage_type = Column(
        Enum(PostageType, name="postage_type", native_enum=False), nullable=True
    )
    postage_amount = Column(Numeric(10, 2), nullable=True)
    address = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    user = relationship("User", back_populates="orders")
    order_books = relationship(
        "OrderBook", back_populates="order", cascade="all, delete-orphan"
    )


class OrderBook(Base):
    __tablename__ = "order_books"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    status = Column(
        Enum(BookStatus, name="book_status", native_enum=False),
        nullable=False,
        default=BookStatus.deposit,
    )
    deposit_amount = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    order = relationship("Order", back_populates="order_books")
    book = relationship("Book", back_populates="order_books")
