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
export type PostageType = "premium" | "hard_cover" | "soft_cover";

export interface Price {
  total_price: number;
  deposit_amount: number;
  outstanding_amount: number;
}

export interface Book {
  id: number;
  title: string;
  author: string | null;
  status: BookStatus;
  created_at: string;
  updated_at: string | null;
  price: Price | null;
}

export interface Order {
  id: number;
  user_id: number;
  status: OrderStatus;
  postage_type: PostageType | null;
  address: string;
  note: string | null;
  created_at: string;
  updated_at: string | null;
  books: Book[];
  postage_charge: number | null;
  total_outstanding: number;
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
  books_with_outstanding: Book[];
}

// ---- API functions ----

export const api = {
  dashboard: {
    get: () => request<Dashboard>("/dashboard/"),
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
      books: {
        title: string;
        author?: string;
        status: BookStatus;
        price: { total_price: string; deposit_amount: string };
      }[];
    }) =>
      request<Order>("/orders/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { address?: string; note?: string; postage_type?: PostageType }) =>
      request<Order>(`/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    cancel: (id: number) =>
      request<Order>(`/orders/${id}/cancel`, { method: "PATCH" }),
  },

  books: {
    list: (params?: { status?: BookStatus; outstanding_only?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.outstanding_only) qs.set("outstanding_only", "true");
      const q = qs.toString();
      return request<Book[]>(`/books/${q ? `?${q}` : ""}`);
    },
    update: (
      id: number,
      data: {
        title?: string;
        author?: string;
        status?: BookStatus;
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
