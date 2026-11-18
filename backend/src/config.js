import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  origins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(value => value.trim()),
  sessionHours: Number(process.env.SESSION_HOURS || 24),
};
if (!Number.isInteger(config.sessionHours) || config.sessionHours < 1 || config.sessionHours > 720) {
  throw new Error('SESSION_HOURS harus berupa bilangan bulat antara 1 dan 720.');
}
