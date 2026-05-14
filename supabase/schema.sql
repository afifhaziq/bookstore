-- Bookstore Inventory Management System
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TYPE book_status AS ENUM (
  'deposit', 'paid', 'bought', 'under_delivery', 'delivered', 'cancelled'
);

CREATE TYPE order_status AS ENUM ('active', 'cancelled');

CREATE TYPE postage_type AS ENUM ('premium', 'hard_cover', 'soft_cover');

CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR NOT NULL,
  phone_number VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  status       order_status NOT NULL DEFAULT 'active',
  postage_type postage_type,
  address      VARCHAR NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ
);

CREATE TABLE books (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR NOT NULL,
  author     VARCHAR,
  status     book_status NOT NULL DEFAULT 'deposit',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE prices (
  id             SERIAL PRIMARY KEY,
  book_id        INTEGER UNIQUE NOT NULL REFERENCES books(id),
  total_price    NUMERIC(10, 2) NOT NULL,
  deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE order_books (
  order_id INTEGER NOT NULL REFERENCES orders(id),
  book_id  INTEGER NOT NULL REFERENCES books(id),
  PRIMARY KEY (order_id, book_id)
);
