def test_models_import():
    from app.models import User, Order, Book, Price, OrderBook

    assert User.__tablename__ == "users"
    assert Order.__tablename__ == "orders"
    assert Book.__tablename__ == "books"
