-- Bookstore Inventory Management System
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TYPE book_status AS ENUM (
  'deposit', 'paid', 'bought', 'under_delivery', 'delivered', 'cancelled'
);

CREATE TYPE order_status AS ENUM ('active', 'cancelled');

CREATE TYPE postage_type AS ENUM ('semenanjung', 'sabah_sarawak');

CREATE TYPE ps_charge_type AS ENUM ('premium', 'hard_cover', 'soft_cover');

CREATE TABLE users (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR NOT NULL,
  phone_number VARCHAR NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE publishers (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE books (
  id             SERIAL PRIMARY KEY,
  title          VARCHAR NOT NULL,
  publisher_id   INTEGER NOT NULL REFERENCES publishers(id),
  ps_charge      ps_charge_type NOT NULL,
  total_price    NUMERIC(10, 2) NOT NULL,
  deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ
);

CREATE TABLE orders (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  status         order_status NOT NULL DEFAULT 'active',
  postage_type   postage_type,
  postage_amount NUMERIC(10, 2),
  address        VARCHAR NOT NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ
);

CREATE TABLE order_books (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id),
  book_id        INTEGER NOT NULL REFERENCES books(id),
  status         book_status NOT NULL DEFAULT 'deposit',
  deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ
);
