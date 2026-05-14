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
    premium = "premium"
    hard_cover = "hard_cover"
    soft_cover = "soft_cover"


POSTAGE_RATES: dict[PostageType, float] = {
    PostageType.premium: 10.00,
    PostageType.hard_cover: 8.00,
    PostageType.soft_cover: 5.00,
}


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    orders = relationship("Order", back_populates="user")


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
    address = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    user = relationship("User", back_populates="orders")
    order_books = relationship(
        "OrderBook", back_populates="order", cascade="all, delete-orphan"
    )


class Book(Base):
    __tablename__ = "books"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    status = Column(
        Enum(BookStatus, name="book_status", native_enum=False),
        nullable=False,
        default=BookStatus.deposit,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    price = relationship(
        "Price", back_populates="book", uselist=False, cascade="all, delete-orphan"
    )
    order_books = relationship("OrderBook", back_populates="book")


class Price(Base):
    __tablename__ = "prices"
    id = Column(Integer, primary_key=True, autoincrement=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False, unique=True)
    total_price = Column(Numeric(10, 2), nullable=False)
    deposit_amount = Column(Numeric(10, 2), nullable=False, default=0)
    book = relationship("Book", back_populates="price")

    @property
    def outstanding_amount(self) -> float:
        return float(self.total_price) - float(self.deposit_amount)


class OrderBook(Base):
    __tablename__ = "order_books"
    order_id = Column(Integer, ForeignKey("orders.id"), primary_key=True)
    book_id = Column(Integer, ForeignKey("books.id"), primary_key=True)
    order = relationship("Order", back_populates="order_books")
    book = relationship("Book", back_populates="order_books")
