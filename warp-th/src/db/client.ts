import { Pool } from 'pg';
import { IDatabase } from '../resolver';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T = any>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<any>(text, params);
  return result.rows as T[];
}

export function createDatabaseClient(): IDatabase {
  return {
    query: async <T = any>(text: string, params?: any[]) => query<T>(text, params)
  };
}

export { pool };
