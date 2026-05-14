ORDER_PAYLOAD = {
    "address": "123 Jalan Test",
    "postage_type": "premium",
    "books": [
        {
            "title": "Dune",
            "author": "Herbert",
            "status": "deposit",
            "price": {"total_price": "50.00", "deposit_amount": "10.00"},
        }
    ],
}


async def _create_customer(client):
    r = await client.post(
        "/customers/", json={"name": "Test", "phone_number": "011"}
    )
    return r.json()["id"]


async def test_create_order(client):
    cid = await _create_customer(client)
    resp = await client.post("/orders/", json={**ORDER_PAYLOAD, "user_id": cid})
    assert resp.status_code == 201
    data = resp.json()
    assert data["address"] == "123 Jalan Test"
    assert len(data["books"]) == 1
    assert data["books"][0]["price"]["outstanding_amount"] == 40.0
    assert data["postage_charge"] == 10.0


async def test_list_orders(client):
    cid = await _create_customer(client)
    await client.post("/orders/", json={**ORDER_PAYLOAD, "user_id": cid})
    resp = await client.get("/orders/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_update_order_address(client):
    cid = await _create_customer(client)
    order = (
        await client.post("/orders/", json={**ORDER_PAYLOAD, "user_id": cid})
    ).json()
    resp = await client.patch(
        f"/orders/{order['id']}", json={"address": "456 Jalan Baru"}
    )
    assert resp.status_code == 200
    assert resp.json()["address"] == "456 Jalan Baru"


async def test_cancel_order(client):
    cid = await _create_customer(client)
    order = (
        await client.post("/orders/", json={**ORDER_PAYLOAD, "user_id": cid})
    ).json()
    resp = await client.patch(f"/orders/{order['id']}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert resp.json()["books"][0]["status"] == "cancelled"
