ORDER_PAYLOAD = {
    "address": "Addr",
    "books": [
        {
            "title": "Book A",
            "status": "deposit",
            "price": {"total_price": "30.00", "deposit_amount": "5.00"},
        }
    ],
}


async def _seed(client):
    cid = (
        await client.post("/customers/", json={"name": "T", "phone_number": "0"})
    ).json()["id"]
    order = (
        await client.post("/orders/", json={**ORDER_PAYLOAD, "user_id": cid})
    ).json()
    return order["books"][0]["id"]


async def test_list_books(client):
    await _seed(client)
    resp = await client.get("/books/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_update_book_status(client):
    book_id = await _seed(client)
    resp = await client.patch(f"/books/{book_id}", json={"status": "paid"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"


async def test_update_book_price(client):
    book_id = await _seed(client)
    resp = await client.patch(f"/books/{book_id}", json={"deposit_amount": "15.00"})
    assert resp.json()["price"]["outstanding_amount"] == 15.0


async def test_outstanding_filter(client):
    await _seed(client)
    resp = await client.get("/books/?outstanding_only=true")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_delete_book_from_active_order(client):
    book_id = await _seed(client)
    resp = await client.delete(f"/books/{book_id}")
    assert resp.status_code == 204
