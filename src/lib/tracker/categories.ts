import { getDb } from "./db";

export interface Category {
  id: string;
  name: string;
  message: string;
}

export async function listCategories(userId: number): Promise<Category[]> {
  const { rows } = await getDb().query<Category>(
    "SELECT id, name, message FROM categories WHERE user_id = $1 ORDER BY created_at",
    [userId],
  );
  return rows;
}

export async function createCategory(userId: number, name: string, message: string) {
  await getDb().query("INSERT INTO categories (user_id, name, message) VALUES ($1, $2, $3)", [userId, name, message]);
}

export async function updateCategory(userId: number, id: string, name: string, message: string) {
  await getDb().query("UPDATE categories SET name = $1, message = $2 WHERE id = $3 AND user_id = $4", [name, message, id, userId]);
}

export async function deleteCategory(userId: number, id: string) {
  await getDb().query("DELETE FROM categories WHERE id = $1 AND user_id = $2", [id, userId]);
}
