// PostgreSQL URL for the E2E test database.
// Best practice: create a dedicated Neon branch named "test" and set
// TEST_DATABASE_URL (+ TEST_DATABASE_URL_UNPOOLED) in your local .env.
// Falls back to the main DATABASE_URL when TEST_DATABASE_URL is absent
// (fine for solo-dev setups where you don't mind test data in the dev DB).
export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

export const TEST_DB_URL_UNPOOLED =
  process.env.TEST_DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL_UNPOOLED ??
  TEST_DB_URL;
