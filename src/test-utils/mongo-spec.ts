// Test-only helper. The "-spec.ts" suffix keeps it out of the production build
// (tsconfig.build.json excludes **/*spec.ts) without being picked up as a test.
import { Connection, createConnection } from 'mongoose';

/**
 * Integration specs (`*.int-spec.ts`, run with `npm run test:int`) talk to a
 * real MongoDB. To make it impossible to point them at a shared database, the
 * URI must be on localhost and the database name must end in `_test`.
 *
 * Default: the local replica set used for development.
 */
const DEFAULT_URI =
  'mongodb://127.0.0.1:27017/crm_be_test?replicaSet=rs0&directConnection=true';

export function testMongoUri(): string {
  const uri = process.env.TEST_MONGODB_URI || DEFAULT_URI;
  const url = new URL(uri);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error(
      `Refusing to run integration tests against non-local MongoDB (${url.hostname}).`,
    );
  }
  const db = url.pathname.replace(/^\//, '');
  if (!db.endsWith('_test')) {
    throw new Error(
      `Integration test database name must end in "_test" (got "${db}").`,
    );
  }
  return uri;
}

/**
 * A fresh connection to a per-suite database (`<db>_<suffix>`), emptied on
 * open and dropped on close.
 *
 * Mongoose builds each model's collection and indexes asynchronously after
 * `connection.model()`. Specs must `await db.ready()` after registering their
 * models and before inserting fixtures, so unique indexes exist and no
 * collection/index creation is still in flight while tests run. `close()`
 * waits for the same work before dropping, so nothing recreates the database.
 */
export async function openTestDb(suffix: string): Promise<{
  connection: Connection;
  ready: () => Promise<void>;
  close: () => Promise<void>;
}> {
  const url = new URL(testMongoUri());
  const base = url.pathname.replace(/^\//, '').replace(/_test$/, '');
  url.pathname = `/${base}_${suffix.replace(/\W/g, '_')}_test`;
  const connection = await createConnection(url.toString()).asPromise();
  // Start clean: an interrupted earlier run can leave documents behind.
  await connection.dropDatabase();
  // Wait for index/collection creation to finish, not for it to succeed:
  // several existing schemas declare the same index twice (unique and not),
  // so Mongoose's index sync fails on them, as it does at app start.
  const ready = async () => {
    await Promise.allSettled(
      Object.values(connection.models).map((m) => m.init()),
    );
  };
  return {
    connection,
    ready,
    close: async () => {
      await ready();
      await connection.dropDatabase();
      await connection.close();
    },
  };
}
