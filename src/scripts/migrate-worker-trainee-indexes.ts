import 'dotenv/config';
import type { IndexDescriptionInfo } from 'mongodb';
import { createConnection } from 'mongoose';
import { mongoTlsOptions } from '../common/utils/mongo-tls.util';
import {
  WorkerTrainee,
  WorkerTraineeSchema,
} from '../workers-training/schemas/worker-trainee.schema';

/**
 * One-off: public workers-training enrolments have no member, so the unique
 * `{ member, cohort }` index must be partial (member set). Mongoose never
 * replaces an existing index whose options changed, so this drops the old
 * non-partial one and creates the schema's indexes. Idempotent.
 *
 * Uses the same database settings as the app (PAID_MONGODB_URI or
 * MONGODB_URI, DATABASE_NAME, MONGODB_TLS) without booting the whole app.
 *
 * Run with: npm run migrate:worker-trainee-indexes
 */
async function main() {
  const env = process.env;
  const uri = env.PAID_MONGODB_URI || env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  const connection = await createConnection(uri, {
    dbName: env.PAID_DATABASE_NAME || env.DATABASE_NAME,
    ...mongoTlsOptions({
      MONGODB_TLS: env.MONGODB_TLS,
      NODE_ENV: env.NODE_ENV,
    }),
    serverSelectionTimeoutMS: 8_000,
    autoIndex: false,
  }).asPromise();
  try {
    const model = connection.model(WorkerTrainee.name, WorkerTraineeSchema);
    console.log(`Database: ${connection.name}`);

    // A fresh database has no collection yet (MongoDB: NamespaceNotFound).
    const indexes = await model.collection
      .indexes()
      .catch((err: { codeName?: string }) => {
        if (err?.codeName === 'NamespaceNotFound')
          return [] as IndexDescriptionInfo[];
        throw err;
      });
    const old = indexes.find(
      (i) => i.name === 'member_1_cohort_1' && !i.partialFilterExpression,
    );
    if (old) {
      await model.collection.dropIndex('member_1_cohort_1');
      console.log('Dropped non-partial member_1_cohort_1');
    } else {
      console.log('member_1_cohort_1 already partial or absent');
    }
    await model.createIndexes();
    console.log('Worker trainee indexes are up to date');
  } finally {
    await connection.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
