import { getAccessToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Types ----

export type BookStatus =
  | "deposit"
  | "paid"
  | "bought"
  | "under_delivery"
  | "delivered"
  | "cancelled";

export type OrderStatus = "active" | "cancelled";
export type PostageType = "semenanjung" | "sabah_sarawak";
export type PsChargeType = "premium" | "hard_cover" | "soft_cover";

export interface Publisher {
  id: number;
  name: string;
  created_at: string;
}

export interface Book {
  id: number;
  title: string;
  publisher_id: number;
  publisher_name: string;
  ps_charge: PsChargeType;
  total_price: number;
  deposit_amount: number;
  created_at: string;
  updated_at: string | null;
}

export interface OrderBook {
  id: number;
  book_id: number;
  title: string;
  publisher_name: string;
  ps_charge: PsChargeType;
  total_price: number;
  status: BookStatus;
  deposit_amount: number;
  outstanding_amount: number;
  created_at: string;
  updated_at: string | null;
}

export interface Order {
  id: number;
  user_id: number;
  status: OrderStatus;
  postage_type: PostageType | null;
  postage_amount: number | null;
  address: string;
  note: string | null;
  created_at: string;
  updated_at: string | null;
  order_books: OrderBook[];
  total_outstanding: number;
  customer_name: string;
  customer_phone: string;
}

export interface Customer {
  id: number;
  name: string;
  phone_number: string;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  orders: Order[];
}

export interface BookStatusCount {
  status: BookStatus;
  count: number;
}

export interface Dashboard {
  book_status_counts: BookStatusCount[];
  total_outstanding: number;
  copies_with_outstanding: OrderBook[];
}

export interface CopySpec {
  book_id: number;
  quantity: number;
}

// ---- API functions ----

export const api = {
  dashboard: {
    get: () => request<Dashboard>("/dashboard/"),
  },

  publishers: {
    list: () => request<Publisher[]>("/publishers/"),
    create: (data: { name: string }) =>
      request<Publisher>("/publishers/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  customers: {
    list: (search?: string) =>
      request<Customer[]>(
        `/customers/${search ? `?search=${encodeURIComponent(search)}` : ""}`
      ),
    get: (id: number) => request<CustomerDetail>(`/customers/${id}`),
    create: (data: { name: string; phone_number: string }) =>
      request<Customer>("/customers/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  orders: {
    list: () => request<Order[]>("/orders/"),
    get: (id: number) => request<Order>(`/orders/${id}`),
    create: (data: {
      user_id: number;
      address: string;
      note?: string;
      postage_type?: PostageType;
      postage_amount?: string;
      copies: CopySpec[];
    }) =>
      request<Order>("/orders/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { address?: string; note?: string; postage_type?: PostageType; postage_amount?: string }) =>
      request<Order>(`/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    addCopies: (id: number, copies: CopySpec[]) =>
      request<Order>(`/orders/${id}/books`, {
        method: "POST",
        body: JSON.stringify({ copies }),
      }),
    updateOrderBook: (orderId: number, obId: number, data: { status?: BookStatus; deposit_amount?: string }) =>
      request<Order>(`/orders/${orderId}/books/${obId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    cancel: (id: number) =>
      request<Order>(`/orders/${id}/cancel`, { method: "PATCH" }),
  },

  books: {
    list: () => request<Book[]>("/books/"),
    create: (data: {
      title: string;
      publisher_id: number;
      ps_charge: PsChargeType;
      total_price: string;
      deposit_amount?: string;
    }) =>
      request<Book>("/books/", { method: "POST", body: JSON.stringify(data) }),
    update: (
      id: number,
      data: {
        title?: string;
        publisher_id?: number;
        ps_charge?: PsChargeType;
        total_price?: string;
        deposit_amount?: string;
      }
    ) =>
      request<Book>(`/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) => request<void>(`/books/${id}`, { method: "DELETE" }),
  },
};
