BOOK_PAYLOAD = {
    "title": "Dune",
    "author": "Herbert",
    "status": "deposit",
    "price": {"total_price": "50.00", "deposit_amount": "10.00"},
}


async def _create_customer(client):
    r = await client.post(
        "/customers/", json={"name": "Test", "phone_number": "011"}
    )
    return r.json()["id"]


async def _create_book(client):
    r = await client.post("/books/", json=BOOK_PAYLOAD)
    return r.json()["id"]


async def test_create_order(client):
    cid = await _create_customer(client)
    bid = await _create_book(client)
    resp = await client.post(
        "/orders/",
        json={
            "user_id": cid,
            "address": "123 Jalan Test",
            "postage_type": "premium",
            "book_ids": [bid],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["address"] == "123 Jalan Test"
    assert len(data["books"]) == 1
    assert data["books"][0]["price"]["outstanding_amount"] == 40.0
    assert data["postage_charge"] == 10.0


async def test_list_orders(client):
    cid = await _create_customer(client)
    bid = await _create_book(client)
    await client.post(
        "/orders/", json={"user_id": cid, "address": "Addr", "book_ids": [bid]}
    )
    resp = await client.get("/orders/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_update_order_address(client):
    cid = await _create_customer(client)
    bid = await _create_book(client)
    order = (
        await client.post(
            "/orders/", json={"user_id": cid, "address": "Addr", "book_ids": [bid]}
        )
    ).json()
    resp = await client.patch(
        f"/orders/{order['id']}", json={"address": "456 Jalan Baru"}
    )
    assert resp.status_code == 200
    assert resp.json()["address"] == "456 Jalan Baru"


async def test_cancel_order(client):
    cid = await _create_customer(client)
    bid = await _create_book(client)
    order = (
        await client.post(
            "/orders/", json={"user_id": cid, "address": "Addr", "book_ids": [bid]}
        )
    ).json()
    resp = await client.patch(f"/orders/{order['id']}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert resp.json()["books"][0]["status"] == "cancelled"


async def test_add_new_books_to_order(client):
    cid = await _create_customer(client)
    bid = await _create_book(client)
    order = (
        await client.post(
            "/orders/", json={"user_id": cid, "address": "Addr", "book_ids": [bid]}
        )
    ).json()
    resp = await client.post(
        f"/orders/{order['id']}/books",
        json={
            "new_books": [
                {
                    "title": "New Book",
                    "author": "Author",
                    "total_price": "30.00",
                    "deposit_amount": "10.00",
                    "quantity": 1,
                }
            ]
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["books"]) == 2
    assert any(b["title"] == "New Book" for b in data["books"])


async def test_add_new_books_quantity_creates_multiple(client):
    cid = await _create_customer(client)
    bid = await _create_book(client)
    order = (
        await client.post(
            "/orders/", json={"user_id": cid, "address": "Addr", "book_ids": [bid]}
        )
    ).json()
    resp = await client.post(
        f"/orders/{order['id']}/books",
        json={
            "new_books": [
                {
                    "title": "Repeated Book",
                    "total_price": "25.00",
                    "quantity": 3,
                }
            ]
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    repeated = [b for b in data["books"] if b["title"] == "Repeated Book"]
    assert len(repeated) == 3


async def test_add_books_combined_book_ids_and_new_books(client):
    cid = await _create_customer(client)
    bid1 = await _create_book(client)
    bid2 = await _create_book(client)
    order = (
        await client.post(
            "/orders/", json={"user_id": cid, "address": "Addr", "book_ids": [bid1]}
        )
    ).json()
    resp = await client.post(
        f"/orders/{order['id']}/books",
        json={
            "book_ids": [bid2],
            "new_books": [{"title": "Brand New", "total_price": "20.00", "quantity": 2}],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["books"]) == 4  # bid1 + bid2 + 2 copies of Brand New
