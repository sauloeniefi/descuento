-- Token para a extensão do Chrome falar com o site (guardado só o hash).
CREATE TABLE api_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Envio em janela de horário, com sorteio, no lugar de horários fixos.
ALTER TABLE campaigns ADD COLUMN window_start TIME NOT NULL DEFAULT '09:00';
ALTER TABLE campaigns ADD COLUMN window_end TIME NOT NULL DEFAULT '21:00';
ALTER TABLE campaigns ADD COLUMN sends_per_day INTEGER NOT NULL DEFAULT 3;
ALTER TABLE campaigns ADD COLUMN cooldown_days INTEGER NOT NULL DEFAULT 7;

-- Campanhas criadas antes disso viram janela do primeiro ao último horário.
UPDATE campaigns SET
  window_start = (SELECT min(t)::time FROM unnest(send_times) AS t),
  window_end = GREATEST((SELECT max(t)::time FROM unnest(send_times) AS t), (SELECT min(t)::time FROM unnest(send_times) AS t) + INTERVAL '1 hour'),
  sends_per_day = GREATEST(array_length(send_times, 1) * products_per_send, 1)
 WHERE array_length(send_times, 1) > 0;

ALTER TABLE campaigns DROP COLUMN send_times;
ALTER TABLE campaigns DROP COLUMN products_per_send;
