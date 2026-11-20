import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { RolesModule } from '../roles/roles.module';
import { GivingPublicController } from './controllers/giving-public.controller';
import {
  DonationsController,
  GivingAccountsController,
} from './controllers/giving-staff.controller';
import {
  Donation,
  DonationSchema,
  GivingAccount,
  GivingAccountSchema,
  GivingCounter,
  GivingCounterSchema,
} from './schemas/giving.schemas';
import { DonationsService } from './services/donations.service';
import { FlutterwaveClient } from './services/flutterwave.client';
import { GivingAccountsService } from './services/giving-accounts.service';

export const GIVING_MODELS = [
  { name: GivingAccount.name, schema: GivingAccountSchema },
  { name: Donation.name, schema: DonationSchema },
  { name: GivingCounter.name, schema: GivingCounterSchema },
];

/**
 * Giving accounts (maker/checker) and online donations via Flutterwave.
 * Has no dependency on the store; StoreModule imports this module so the
 * shared Flutterwave webhook can hand PPTG- references to DonationsService.
 */
@Module({
  imports: [
    RolesModule,
    MongooseModule.forFeature([
      ...GIVING_MODELS,
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [
    GivingPublicController,
    GivingAccountsController,
    DonationsController,
  ],
  providers: [GivingAccountsService, DonationsService, FlutterwaveClient],
  exports: [DonationsService],
})
export class GivingModule {}
