# Order Book Quantity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow adding multiple copies of the same book to an order in one step via a quantity field, each copy stored as a separate independently-tracked `Book` record.

**Architecture:** Backend gains two Pydantic models (`NewBookSpec`, `AddBooksToOrderRequest`) and the `POST /orders/{id}/books` endpoint is updated to create `Book` + `Price` records inline when `new_books` is supplied, looping `quantity` times per spec. The frontend `AddBooksDialog` is restructured into a two-tab UI (select existing | add new) using a state toggle; the API client and hook are updated to pass the new payload shape.

**Tech Stack:** FastAPI + SQLAlchemy async (backend), Next.js App Router + TanStack Query + TypeScript (frontend), Pydantic v2

---

### Task 1: Write failing backend tests for `new_books` + quantity

**Files:**
- Modify: `backend/tests/test_orders.py`

- [ ] **Step 1: Append three new tests to `test_orders.py`**

```python
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
```

- [ ] **Step 2: Run the three new tests — confirm they all fail**

```bash
cd backend && uv run pytest tests/test_orders.py::test_add_new_books_to_order tests/test_orders.py::test_add_new_books_quantity_creates_multiple tests/test_orders.py::test_add_books_combined_book_ids_and_new_books -v
```

Expected: 3 FAILED — the endpoint currently accepts a loose `dict` so `new_books` is silently ignored and the book count doesn't increase.

---

### Task 2: Add `NewBookSpec` and `AddBooksToOrderRequest` schemas

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: Add `Field` to the pydantic import**

Change line 2 from:

```python
from pydantic import BaseModel
```

to:

```python
from pydantic import BaseModel, Field
```

- [ ] **Step 2: Add the two new models after `OrderUpdate`**

Insert after the `OrderUpdate` class (before `OrderResponse`):

```python
class NewBookSpec(BaseModel):
    title: str
    author: Optional[str] = None
    total_price: Decimal
    deposit_amount: Decimal = Decimal("0")
    quantity: int = Field(1, ge=1, le=50)


class AddBooksToOrderRequest(BaseModel):
    book_ids: list[int] = []
    new_books: list[NewBookSpec] = []
```

---

### Task 3: Update `add_books_to_order` endpoint

**Files:**
- Modify: `backend/app/routers/orders.py`

- [ ] **Step 1: Add `Price` back to the models import**

Change:

```python
from app.models import Order, Book, OrderBook, OrderStatus, BookStatus, User
```

to:

```python
from app.models import Order, Book, Price, OrderBook, OrderStatus, BookStatus, User
```

- [ ] **Step 2: Add `AddBooksToOrderRequest` to the schemas import**

Change:

```python
from app.schemas import OrderCreate, OrderUpdate, OrderDetail
```

to:

```python
from app.schemas import OrderCreate, OrderUpdate, OrderDetail, AddBooksToOrderRequest
```

- [ ] **Step 3: Replace the entire `add_books_to_order` function**

```python
@router.post("/{order_id}/books", response_model=OrderDetail)
async def add_books_to_order(
    order_id: int,
    data: AddBooksToOrderRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    order = await _load_order(order_id, db)
    if order.status != OrderStatus.active:
        raise HTTPException(status_code=400, detail="Cannot add books to a cancelled order")

    existing_book_ids = {ob.book_id for ob in order.order_books}

    for book_id in data.book_ids:
        if book_id in existing_book_ids:
            continue
        result = await db.execute(select(Book).where(Book.id == book_id))
        book = result.scalar_one_or_none()
        if not book:
            raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
        db.add(OrderBook(order_id=order_id, book_id=book_id))

    for spec in data.new_books:
        for _ in range(spec.quantity):
            book = Book(title=spec.title, author=spec.author)
            db.add(book)
            await db.flush()
            db.add(Price(book_id=book.id, total_price=spec.total_price, deposit_amount=spec.deposit_amount))
            db.add(OrderBook(order_id=order_id, book_id=book.id))

    await db.commit()
    return _build_order_detail(await _load_order(order_id, db))
```

- [ ] **Step 4: Run the three new tests — confirm they all pass**

```bash
cd backend && uv run pytest tests/test_orders.py::test_add_new_books_to_order tests/test_orders.py::test_add_new_books_quantity_creates_multiple tests/test_orders.py::test_add_books_combined_book_ids_and_new_books -v
```

Expected: 3 PASSED.

- [ ] **Step 5: Run the full test suite — no regressions**

```bash
cd backend && uv run pytest -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/orders.py backend/tests/test_orders.py
git commit -m "feat: support new_books with quantity in POST /orders/{id}/books"
```

---

### Task 4: Update frontend API client and hook

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/hooks/useOrders.ts`

- [ ] **Step 1: Add `NewBookSpec` interface to `lib/api.ts`**

After the `Dashboard` interface (after line 91), insert:

```ts
export interface NewBookSpec {
  title: string;
  author?: string;
  total_price: string;
  deposit_amount?: string;
  quantity?: number;
}
```

- [ ] **Step 2: Update `addBooks` in `lib/api.ts`**

Replace:

```ts
addBooks: (id: number, book_ids: number[]) =>
  request<Order>(`/orders/${id}/books`, {
    method: "POST",
    body: JSON.stringify({ book_ids }),
  }),
```

with:

```ts
addBooks: (id: number, payload: { book_ids?: number[]; new_books?: NewBookSpec[] }) =>
  request<Order>(`/orders/${id}/books`, {
    method: "POST",
    body: JSON.stringify(payload),
  }),
```

- [ ] **Step 3: Update `useAddBooksToOrder` in `hooks/useOrders.ts`**

Add `NewBookSpec` to the import:

```ts
import { api, PostageType, BookStatus, NewBookSpec } from "@/lib/api";
```

Replace the `mutationFn` line inside `useAddBooksToOrder`:

```ts
mutationFn: (payload: { book_ids?: number[]; new_books?: NewBookSpec[] }) =>
  api.orders.addBooks(orderId, payload),
```

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts frontend/hooks/useOrders.ts
git commit -m "feat: update addBooks API client and hook to support new_books payload"
```

---

### Task 5: Restructure `AddBooksDialog` with two tabs

**Files:**
- Modify: `frontend/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Step 1: Add `Label` to imports**

After the existing `import { ChevronLeft, Plus } from "lucide-react";` line, add:

```tsx
import { Label } from "@/components/ui/label";
```

- [ ] **Step 2: Replace the entire `AddBooksDialog` function (lines 50–135)**

```tsx
function AddBooksDialog({
  orderId,
  existingBookIds,
  open,
  onClose,
}: {
  orderId: number;
  existingBookIds: number[];
  open: boolean;
  onClose: () => void;
}) {
  const { data: allBooks } = useBooks();
  const addBooks = useAddBooksToOrder(orderId);

  const [tab, setTab] = useState<"existing" | "new">("existing");

  // existing-tab state
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // new-tab state
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [deposit, setDeposit] = useState("0");
  const [quantity, setQuantity] = useState(1);

  const available = (allBooks ?? []).filter((b) => !existingBookIds.includes(b.id));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function resetForm() {
    setSelected(new Set());
    setTitle("");
    setAuthor("");
    setTotalPrice("");
    setDeposit("0");
    setQuantity(1);
    setTab("existing");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleAddExisting() {
    if (selected.size === 0) return;
    await addBooks.mutateAsync({ book_ids: Array.from(selected) });
    resetForm();
    onClose();
  }

  async function handleAddNew() {
    if (!title.trim() || !totalPrice.trim()) return;
    await addBooks.mutateAsync({
      new_books: [
        {
          title: title.trim(),
          author: author.trim() || undefined,
          total_price: totalPrice,
          deposit_amount: deposit,
          quantity,
        },
      ],
    });
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Books to Order</DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setTab("existing")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "existing"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Select existing
          </button>
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "new"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Add new
          </button>
        </div>

        {tab === "existing" ? (
          available.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No available books. Add books from the Books page first.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {available.map((book) => {
                const sel = selected.has(book.id);
                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => toggle(book.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      sel ? "border-primary bg-primary/5" : "hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{book.title}</p>
                        {book.author && (
                          <p className="text-xs text-muted-foreground">{book.author}</p>
                        )}
                      </div>
                      {book.price && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          RM {Number(book.price.total_price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-title">Title *</Label>
              <Input
                id="new-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Book title"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-author">Author</Label>
              <Input
                id="new-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-price">Total price (RM) *</Label>
                <Input
                  id="new-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-deposit">Deposit (RM)</Label>
                <Input
                  id="new-deposit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-qty">Quantity</Label>
              <Input
                id="new-qty"
                type="number"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.min(50, Math.max(1, Number(e.target.value))))
                }
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {tab === "existing" ? (
            <Button
              onClick={handleAddExisting}
              disabled={selected.size === 0 || addBooks.isPending}
            >
              {addBooks.isPending
                ? "Adding…"
                : `Add ${selected.size > 0 ? selected.size : ""} Book${selected.size !== 1 ? "s" : ""}`}
            </Button>
          ) : (
            <Button
              onClick={handleAddNew}
              disabled={!title.trim() || !totalPrice.trim() || addBooks.isPending}
            >
              {addBooks.isPending
                ? "Adding…"
                : `Add ${quantity > 1 ? `${quantity} ` : ""}Book${quantity !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles without errors**

```bash
cd frontend && npm run build 2>&1 | tail -30
```

Expected: no type errors in the changed files. Fix any reported before proceeding.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat: two-tab AddBooksDialog with quantity field for new books"
```
