import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { MongoClient, Document } from 'mongodb';

@Injectable()
export class DbBackupService {
  private readonly logger = new Logger(DbBackupService.name);
  private running = false;

  constructor(private readonly configService: ConfigService) {}

  @Cron('0 2 */4 * *')
  async handleBackup() {
    const targetUri = this.configService.get<string>('BACKUP_MONGODB_URI');
    if (!targetUri) return;

    if (this.running) {
      this.logger.warn('Backup already in progress, skipping');
      return;
    }

    this.running = true;
    this.logger.log('Starting database backup sync...');

    const sourceUri =
      this.configService.get<string>('PAID_MONGODB_URI') ||
      this.configService.get<string>('MONGODB_URI');
    const dbName = this.configService.get<string>('PAID_DATABASE_NAME') ||
      this.configService.get<string>('DATABASE_NAME');

    const src = new MongoClient(sourceUri as string, {
      serverSelectionTimeoutMS: 15000,
    });
    const dst = new MongoClient(targetUri as string, {
      serverSelectionTimeoutMS: 15000,
    });

    try {
      await src.connect();
      await dst.connect();
      this.logger.log('Connected to source and backup clusters');

      const srcDb = src.db(dbName);
      const dstDb = dst.db(dbName);
      const collections = await srcDb.listCollections().toArray();

      let totalDocs = 0;

      for (const colInfo of collections) {
        const name = colInfo.name;
        const srcCol = srcDb.collection(name);
        const dstCol = dstDb.collection(name);

        const count = await srcCol.countDocuments();
        if (count === 0) {
          try { await dstCol.drop(); } catch {}
          continue;
        }

        try { await dstCol.drop(); } catch {}

        const indexes = await srcCol.indexes();
        const customIndexes = indexes.filter((idx) => idx.name !== '_id_');
        if (customIndexes.length > 0) {
          try {
            await dstCol.createIndexes(
              customIndexes.map(({ key, ...opts }) => {
                const { v, ns, ...cleanOpts } = opts;
                return { key, ...cleanOpts };
              }),
            );
          } catch (e) {
            this.logger.warn(`Index creation failed for ${name}: ${e.message}`);
          }
        }

        let migrated = 0;
        const cursor = srcCol.find().batchSize(500);

        while (true) {
          const batch: Document[] = [];
          for (let i = 0; i < 500; i++) {
            const doc = await cursor.next();
            if (!doc) break;
            batch.push(doc);
          }
          if (batch.length === 0) break;

          await dstCol.insertMany(batch, { ordered: false });
          migrated += batch.length;
        }

        totalDocs += migrated;
      }

      this.logger.log(
        `Backup complete — ${collections.length} collections, ${totalDocs} docs`,
      );
    } catch (err) {
      this.logger.error(`Backup failed: ${err.message}`, err.stack);
    } finally {
      this.running = false;
      await src.close().catch(() => {});
      await dst.close().catch(() => {});
    }
  }
}
