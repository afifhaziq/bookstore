async def test_create_publisher(client):
    resp = await client.post("/publishers/", json={"name": "Penguin"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Penguin"
    assert "id" in data


async def test_list_publishers(client):
    await client.post("/publishers/", json={"name": "Penguin"})
    await client.post("/publishers/", json={"name": "Harper"})
    resp = await client.get("/publishers/")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_duplicate_publisher_name_rejected(client):
    await client.post("/publishers/", json={"name": "Penguin"})
    resp = await client.post("/publishers/", json={"name": "Penguin"})
    assert resp.status_code == 400
