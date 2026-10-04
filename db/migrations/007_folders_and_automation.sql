-- Produtos: validade e favorito (a pasta é a categoria).
ALTER TABLE products ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days';
ALTER TABLE products ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT false;

-- Só entram no seletor de automação os grupos em que você é administrador.
ALTER TABLE wa_groups ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT true;

-- Automação: intervalo fixo, vários grupos por automação e reenvio em horas.
ALTER TABLE campaigns ADD COLUMN chat_ids TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN chat_names TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN interval_minutes INTEGER NOT NULL DEFAULT 60;
ALTER TABLE campaigns ADD COLUMN resend_hours INTEGER NOT NULL DEFAULT 24;
ALTER TABLE campaigns ADD COLUMN products_per_send INTEGER NOT NULL DEFAULT 1;

UPDATE campaigns SET
  chat_ids = ARRAY[chat_id],
  chat_names = ARRAY[chat_name],
  resend_hours = cooldown_days * 24,
  interval_minutes = GREATEST(
    30,
    (EXTRACT(EPOCH FROM (window_end - window_start)) / 60 / GREATEST(sends_per_day, 1))::int
  );

ALTER TABLE campaigns DROP COLUMN chat_id;
ALTER TABLE campaigns DROP COLUMN chat_name;
ALTER TABLE campaigns DROP COLUMN cooldown_days;
ALTER TABLE campaigns DROP COLUMN sends_per_day;

-- Com vários grupos, o mesmo produto no mesmo horário vai para cada grupo.
DROP INDEX idx_queue_slot;
CREATE UNIQUE INDEX idx_queue_slot ON send_queue (campaign_id, chat_id, product_id, scheduled_at);
