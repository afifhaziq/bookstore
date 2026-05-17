async def _create_publisher(client, name="Penguin"):
    r = await client.post("/publishers/", json={"name": name})
    return r.json()["id"]


async def _create_book(client, pub_id):
    r = await client.post(
        "/books/",
        json={
            "title": "Dune",
            "publisher_id": pub_id,
            "ps_charge": "premium",
            "total_price": "50.00",
            "deposit_amount": "10.00",
        },
    )
    return r.json()["id"]


async def _create_customer(client):
    r = await client.post("/customers/", json={"name": "Test", "phone_number": "011"})
    return r.json()["id"]


async def test_create_order(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    resp = await client.post(
        "/orders/",
        json={
            "user_id": cid,
            "address": "123 Jalan Test",
            "postage_type": "semenanjung",
            "copies": [{"book_id": book_id, "quantity": 1}],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["address"] == "123 Jalan Test"
    assert len(data["order_books"]) == 1
    assert data["order_books"][0]["status"] == "deposit"
    assert float(data["order_books"][0]["outstanding_amount"]) == 50.0
    assert float(data["postage_amount"]) == 8.0


async def test_create_order_postage_amount_auto_set_sabah(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    resp = await client.post(
        "/orders/",
        json={
            "user_id": cid,
            "address": "Kota Kinabalu",
            "postage_type": "sabah_sarawak",
            "copies": [{"book_id": book_id, "quantity": 1}],
        },
    )
    assert resp.status_code == 201
    assert float(resp.json()["postage_amount"]) == 16.0


async def test_create_order_postage_amount_manual_override(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    resp = await client.post(
        "/orders/",
        json={
            "user_id": cid,
            "address": "Addr",
            "postage_type": "semenanjung",
            "postage_amount": "12.00",
            "copies": [{"book_id": book_id, "quantity": 1}],
        },
    )
    assert resp.status_code == 201
    assert float(resp.json()["postage_amount"]) == 12.0


async def test_create_order_quantity_multiple_copies(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    resp = await client.post(
        "/orders/",
        json={
            "user_id": cid,
            "address": "Addr",
            "copies": [{"book_id": book_id, "quantity": 3}],
        },
    )
    assert resp.status_code == 201
    assert len(resp.json()["order_books"]) == 3


async def test_list_orders(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    await client.post(
        "/orders/",
        json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
    )
    resp = await client.get("/orders/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_update_order_address(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    order = (
        await client.post(
            "/orders/",
            json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
        )
    ).json()
    resp = await client.patch(f"/orders/{order['id']}", json={"address": "New Addr"})
    assert resp.status_code == 200
    assert resp.json()["address"] == "New Addr"


async def test_update_order_postage_amount(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    order = (
        await client.post(
            "/orders/",
            json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
        )
    ).json()
    resp = await client.patch(f"/orders/{order['id']}", json={"postage_amount": "20.00"})
    assert resp.status_code == 200
    assert float(resp.json()["postage_amount"]) == 20.0


async def test_add_copies_to_order(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    order = (
        await client.post(
            "/orders/",
            json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
        )
    ).json()
    resp = await client.post(
        f"/orders/{order['id']}/books",
        json={"copies": [{"book_id": book_id, "quantity": 2}]},
    )
    assert resp.status_code == 200
    assert len(resp.json()["order_books"]) == 3


async def test_update_order_book_status(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    order = (
        await client.post(
            "/orders/",
            json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
        )
    ).json()
    ob_id = order["order_books"][0]["id"]
    resp = await client.patch(
        f"/orders/{order['id']}/books/{ob_id}",
        json={"status": "paid", "deposit_amount": "50.00"},
    )
    assert resp.status_code == 200
    ob = next(x for x in resp.json()["order_books"] if x["id"] == ob_id)
    assert ob["status"] == "paid"
    assert float(ob["deposit_amount"]) == 50.0


async def test_cancel_order(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id)
    cid = await _create_customer(client)
    order = (
        await client.post(
            "/orders/",
            json={"user_id": cid, "address": "Addr", "copies": [{"book_id": book_id, "quantity": 1}]},
        )
    ).json()
    resp = await client.patch(f"/orders/{order['id']}/cancel")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "cancelled"
    assert all(ob["status"] == "cancelled" for ob in data["order_books"])
