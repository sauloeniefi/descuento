import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Cria um token novo e apaga os anteriores do usuário. O valor só aparece aqui. */
export async function createApiToken(userId: number): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const db = getDb();
  await db.query("DELETE FROM api_tokens WHERE user_id = $1", [userId]);
  await db.query("INSERT INTO api_tokens (token_hash, user_id) VALUES ($1, $2)", [hash(token), userId]);
  return token;
}

export async function hasApiToken(userId: number): Promise<boolean> {
  const { rows } = await getDb().query("SELECT 1 FROM api_tokens WHERE user_id = $1", [userId]);
  return rows.length > 0;
}

export async function userIdFromToken(token: string | null): Promise<number | null> {
  if (!token) return null;
  const { rows } = await getDb().query<{ user_id: number }>(
    "UPDATE api_tokens SET last_used_at = now() WHERE token_hash = $1 RETURNING user_id",
    [hash(token)],
  );
  return rows[0]?.user_id ?? null;
}
