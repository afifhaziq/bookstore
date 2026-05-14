def test_models_import():
    from app.models import User, Order, Book, Price, OrderBook

    assert User.__tablename__ == "users"
    assert Order.__tablename__ == "orders"
    assert Book.__tablename__ == "books"


def test_schemas_import():
    from app.schemas import CustomerCreate, CustomerResponse

    c = CustomerCreate(name="Ali", phone_number="0123456789")
    assert c.name == "Ali"


async def test_create_customer(client):
    resp = await client.post(
        "/customers/", json={"name": "Amir", "phone_number": "0123456789"}
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Amir"


async def test_list_customers(client):
    await client.post("/customers/", json={"name": "Amir", "phone_number": "011"})
    resp = await client.get("/customers/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_search_customers(client):
    await client.post("/customers/", json={"name": "Zara", "phone_number": "012"})
    resp = await client.get("/customers/?search=zar")
    assert resp.status_code == 200
    assert resp.json()[0]["name"] == "Zara"


async def test_get_customer_not_found(client):
    resp = await client.get("/customers/999")
    assert resp.status_code == 404
