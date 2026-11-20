import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { RolesModule } from '../roles/roles.module';
import { WebsiteAccessService } from '../website/services/website-access.service';
import { LostFoundPublicController } from './lost-found-public.controller';
import { LostFoundController } from './lost-found.controller';
import { LostFoundService } from './lost-found.service';
import {
  LostItemClaim,
  LostItemClaimSchema,
} from './schemas/lost-item-claim.schema';
import { LostItem, LostItemSchema } from './schemas/lost-item.schema';

/** Care Closet lost-and-found (public website + care desk). */
@Module({
  imports: [
    RolesModule,
    MongooseModule.forFeature([
      { name: LostItem.name, schema: LostItemSchema },
      { name: LostItemClaim.name, schema: LostItemClaimSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [LostFoundPublicController, LostFoundController],
  providers: [LostFoundService, WebsiteAccessService],
  exports: [LostFoundService],
})
export class LostFoundModule {}
