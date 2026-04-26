import path from "path";

const TEST_DB_PATH = path.resolve(__dirname, "..", "prisma", "test.db").replace(/\\/g, "/");
export const TEST_DB_URL = `file:${TEST_DB_PATH}`;
// Unused in SQLite mode; kept for PostgreSQL fallback if TEST_DATABASE_URL is set.
export const TEST_DB_URL_UNPOOLED = TEST_DB_URL;
