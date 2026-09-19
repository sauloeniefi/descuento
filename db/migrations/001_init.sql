CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  ml_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail TEXT,
  affiliate_url TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  target_price NUMERIC(12, 2),
  interval_days INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC(12, 2) NOT NULL,
  original_price NUMERIC(12, 2),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_history_product ON price_history(product_id, checked_at);
