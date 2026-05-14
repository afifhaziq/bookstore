async def _seed(client):
    cid = (
        await client.post("/customers/", json={"name": "T", "phone_number": "0"})
    ).json()["id"]
    await client.post(
        "/orders/",
        json={
            "user_id": cid,
            "address": "A",
            "books": [
                {
                    "title": "B1",
                    "status": "deposit",
                    "price": {"total_price": "50.00", "deposit_amount": "10.00"},
                },
                {
                    "title": "B2",
                    "status": "delivered",
                    "price": {"total_price": "30.00", "deposit_amount": "30.00"},
                },
            ],
        },
    )


async def test_dashboard(client):
    await _seed(client)
    resp = await client.get("/dashboard/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_outstanding"] == 40.0
    assert len(data["books_with_outstanding"]) == 1
    statuses = {s["status"]: s["count"] for s in data["book_status_counts"]}
    assert statuses["deposit"] == 1
    assert statuses["delivered"] == 1
