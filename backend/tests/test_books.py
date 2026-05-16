async def _create_publisher(client, name="Penguin"):
    r = await client.post("/publishers/", json={"name": name})
    assert r.status_code == 201
    return r.json()["id"]


async def _create_book(client, pub_id=None, **kwargs):
    if pub_id is None:
        pub_id = await _create_publisher(client)
    payload = {
        "title": "Dune",
        "publisher_id": pub_id,
        "ps_charge": "premium",
        "total_price": "50.00",
        "deposit_amount": "10.00",
        **kwargs,
    }
    r = await client.post("/books/", json=payload)
    assert r.status_code == 201
    return r.json()["id"]


async def test_create_book(client):
    pub_id = await _create_publisher(client)
    resp = await client.post(
        "/books/",
        json={
            "title": "Dune",
            "publisher_id": pub_id,
            "ps_charge": "premium",
            "total_price": "50.00",
            "deposit_amount": "10.00",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Dune"
    assert data["publisher_name"] == "Penguin"
    assert data["ps_charge"] == "premium"
    assert float(data["total_price"]) == 50.0


async def test_create_book_invalid_publisher(client):
    resp = await client.post(
        "/books/",
        json={
            "title": "Dune",
            "publisher_id": 999,
            "ps_charge": "premium",
            "total_price": "50.00",
        },
    )
    assert resp.status_code == 404


async def test_list_books(client):
    await _create_book(client)
    resp = await client.get("/books/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_update_book_title(client):
    book_id = await _create_book(client)
    resp = await client.patch(f"/books/{book_id}", json={"title": "Foundation"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Foundation"


async def test_update_book_ps_charge(client):
    book_id = await _create_book(client)
    resp = await client.patch(f"/books/{book_id}", json={"ps_charge": "soft_cover"})
    assert resp.status_code == 200
    assert resp.json()["ps_charge"] == "soft_cover"


async def test_delete_book(client):
    book_id = await _create_book(client)
    resp = await client.delete(f"/books/{book_id}")
    assert resp.status_code == 204


async def test_delete_book_in_active_order_rejected(client):
    pub_id = await _create_publisher(client)
    book_id = await _create_book(client, pub_id=pub_id)
    cid = (
        await client.post("/customers/", json={"name": "T", "phone_number": "0"})
    ).json()["id"]
    await client.post(
        "/orders/",
        json={"user_id": cid, "address": "A", "copies": [{"book_id": book_id, "quantity": 1}]},
    )
    resp = await client.delete(f"/books/{book_id}")
    assert resp.status_code == 400
