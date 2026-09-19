import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./tracker/db";

const COOKIE = "session";
const SESSION_DAYS = 30;
const ADMIN_USERNAME = "admin";

export interface User {
  id: number;
  username: string;
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))));
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await derive(password, salt)).toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await derive(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function startSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDb().query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
    hashToken(token),
    userId,
    expiresAt,
  ]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function register(username: string, password: string): Promise<User> {
  const db = getDb();
  const passwordHash = await hashPassword(password);
  const client = await db.connect();
  let user: User;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<User>(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username, passwordHash],
    );
    user = rows[0];
    if (username.toLowerCase() === ADMIN_USERNAME) {
      await client.query("UPDATE categories SET user_id = $1 WHERE user_id IS NULL", [user.id]);
      await client.query("UPDATE products SET user_id = $1 WHERE user_id IS NULL", [user.id]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505") throw new Error("Esse nome de usuário já está em uso.");
    throw e;
  } finally {
    client.release();
  }
  await startSession(user.id);
  return user;
}

export async function login(username: string, password: string): Promise<User | null> {
  const { rows } = await getDb().query<User & { password_hash: string }>(
    "SELECT id, username, password_hash FROM users WHERE lower(username) = lower($1)",
    [username],
  );
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) return null;
  await startSession(rows[0].id);
  return { id: rows[0].id, username: rows[0].username };
}

export async function logout() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await getDb().query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  store.delete(COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { rows } = await getDb().query<User>(
    `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
