import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GisService } from './gis.service';

@Injectable()
export class GisCronService {
  private readonly logger = new Logger(GisCronService.name);

  constructor(
    private readonly gisService: GisService,
    @InjectModel('Branch') private readonly branchModel: Model<any>,
  ) {}

  @Cron(CronExpression.EVERY_WEEK, { name: 'gis-weekly-snapshot' })
  async weeklySnapshot() {
    this.logger.log('Running weekly GIS snapshot...');

    const branches = await this.branchModel.find({ isActive: true }).select('_id name');

    for (const branch of branches) {
      try {
        await this.gisService.takeSnapshot(branch._id.toString(), 'weekly');
        this.logger.log(`Weekly snapshot completed for branch: ${branch.name}`);
      } catch (error) {
        this.logger.error(
          `Failed weekly snapshot for branch ${branch.name}: ${error.message}`,
        );
      }
    }
  }

  @Cron('0 2 1 * *', { name: 'gis-monthly-snapshot' })
  async monthlySnapshot() {
    this.logger.log('Running monthly GIS snapshot...');

    const branches = await this.branchModel.find({ isActive: true }).select('_id name');

    for (const branch of branches) {
      try {
        await this.gisService.takeSnapshot(branch._id.toString(), 'monthly');
        this.logger.log(`Monthly snapshot completed for branch: ${branch.name}`);
      } catch (error) {
        this.logger.error(
          `Failed monthly snapshot for branch ${branch.name}: ${error.message}`,
        );
      }
    }
  }
}
