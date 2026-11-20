import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from './schemas/branch.schema';
import {
  WebPastor,
  WebPastorSchema,
} from '../website/schemas/web-content.schema';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { RolesModule } from '../roles/roles.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      // Read-only here: campus pastor shown on the website campus list.
      { name: WebPastor.name, schema: WebPastorSchema },
    ]),
    forwardRef(() => RolesModule),
    forwardRef(() => CommonModule),
  ],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService, MongooseModule],
})
export class BranchesModule {}
