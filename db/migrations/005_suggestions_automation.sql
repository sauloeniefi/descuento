-- Varredura: produtos parecidos encontrados automaticamente, aguardando aprovação.
CREATE TABLE suggestions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ml_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  original_price NUMERIC(12, 2),
  discount_percent INTEGER,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  source_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  found_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_suggestions_user_ml ON suggestions (user_id, ml_id);

-- Grupos de WhatsApp lidos pelo worker (scripts/whatsapp-worker.mjs).
CREATE TABLE wa_groups (
  chat_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chat_id)
);

-- Uma campanha = um grupo + uma categoria + quando enviar.
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  chat_name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  weekdays INTEGER[] NOT NULL,
  send_times TEXT[] NOT NULL,
  products_per_send INTEGER NOT NULL DEFAULT 1,
  min_discount INTEGER NOT NULL DEFAULT 10,
  starts_on DATE NOT NULL DEFAULT current_date,
  ends_on DATE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fila de envio: o site enfileira, o worker envia.
CREATE TABLE send_queue (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  caption TEXT NOT NULL,
  image_url TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error TEXT
);
CREATE UNIQUE INDEX idx_queue_slot ON send_queue (campaign_id, product_id, scheduled_at);
CREATE INDEX idx_queue_pending ON send_queue (status, scheduled_at);
