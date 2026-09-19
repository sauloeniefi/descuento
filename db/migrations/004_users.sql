CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_users_username ON users (lower(username));

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dados existentes ficam com user_id NULL até o usuário "admin" se cadastrar e assumi-los.
ALTER TABLE products ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE products DROP CONSTRAINT products_ml_id_key;
CREATE UNIQUE INDEX idx_products_user_ml ON products (user_id, ml_id);
