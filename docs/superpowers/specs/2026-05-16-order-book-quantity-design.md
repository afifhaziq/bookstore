# Order Book Quantity — Design Spec

## Summary

When adding books to an existing order from the order detail page, the operator can now create multiple copies of the same book in one step by specifying a quantity. Each copy becomes a separate, individually-tracked `Book` record with its own status lifecycle (deposit → paid → bought → under_delivery → delivered).

## Backend

### Schema changes

Add two new Pydantic models to `backend/app/schemas.py`:

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

### Endpoint change

`POST /orders/{order_id}/books` replaces its loose `data: dict` parameter with `data: AddBooksToOrderRequest`.

For each entry in `data.new_books`, the endpoint creates `quantity` `Book` + `Price` record pairs (all with the same title, author, and price values) and links each to the order via `OrderBook`. This runs in the same transaction as any `book_ids` additions. The `quantity` cap of 50 prevents accidental runaway creation.

Both `book_ids` and `new_books` can be used together in a single request.

## Frontend

### `AddBooksDialog` — two-tab layout

The dialog (`/orders/[id]/page.tsx`) is restructured with two tabs using the existing shadcn `Tabs` component:

**Tab 1 — Select existing** (unchanged)
- Filterable list of books not yet in this order
- Multi-select by clicking rows
- Footer button: "Add N Book(s)"

**Tab 2 — Add new**
- Form fields: Title (required), Author (optional), Total price (required), Deposit (default 0), Quantity (number input, min 1, max 50)
- Footer button: "Add Book(s)" (adapts label based on quantity)
- On submit: calls `api.orders.addBooks(orderId, { new_books: [...] })`
- Form resets and dialog closes on success

No changes to `BookRow`, `PriceSummary`, `PostageBadge`, `StatusBadge`, or any other component.

### API client

Add a `NewBookSpec` interface to `lib/api.ts`:

```ts
export interface NewBookSpec {
  title: string;
  author?: string;
  total_price: string;
  deposit_amount?: string;
  quantity?: number;
}
```

`api.orders.addBooks` currently sends `{ book_ids: number[] }`. Update its parameter to `{ book_ids?: number[], new_books?: NewBookSpec[] }` to match the new backend schema.

### Hooks

`useAddBooksToOrder` in `hooks/useOrders.ts` already invalidates `["orders", id]`, `["orders"]`, `["books"]`, and `["dashboard"]` on success — no changes needed.

## Constraints

- Quantity is capped at 50 on both backend (Pydantic `le=50`) and frontend (input `max={50}`).
- The dialog is only reachable when order status is `active` — the "Add Books" button is already conditionally rendered. No additional gating needed on the tab itself.
- All new books start at `deposit` status (the `BookStatus` default).
