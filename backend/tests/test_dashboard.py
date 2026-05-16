async def _seed(client):
    pub_id = (await client.post("/publishers/", json={"name": "Pub"})).json()["id"]
    cid = (
        await client.post("/customers/", json={"name": "T", "phone_number": "0"})
    ).json()["id"]
    b1 = (
        await client.post(
            "/books/",
            json={
                "title": "B1",
                "publisher_id": pub_id,
                "ps_charge": "soft_cover",
                "total_price": "50.00",
                "deposit_amount": "10.00",
            },
        )
    ).json()["id"]
    b2 = (
        await client.post(
            "/books/",
            json={
                "title": "B2",
                "publisher_id": pub_id,
                "ps_charge": "soft_cover",
                "total_price": "30.00",
                "deposit_amount": "30.00",
            },
        )
    ).json()["id"]
    order = (
        await client.post(
            "/orders/",
            json={
                "user_id": cid,
                "address": "A",
                "copies": [
                    {"book_id": b1, "quantity": 1},
                    {"book_id": b2, "quantity": 1},
                ],
            },
        )
    ).json()
    ob2_id = next(ob["id"] for ob in order["order_books"] if ob["book_id"] == b2)
    await client.patch(
        f"/orders/{order['id']}/books/{ob2_id}",
        json={"status": "delivered", "deposit_amount": "30.00"},
    )
    return order


async def test_dashboard(client):
    await _seed(client)
    resp = await client.get("/dashboard/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_outstanding"] == 40.0
    assert len(data["copies_with_outstanding"]) == 1
    statuses = {s["status"]: s["count"] for s in data["book_status_counts"]}
    assert statuses["deposit"] == 1
    assert statuses["delivered"] == 1
