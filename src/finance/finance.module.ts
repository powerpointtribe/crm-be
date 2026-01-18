import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { FinanceService } from './finance.service';
import { ExpenseCategoryService } from './expense-category.service';
import { FormFieldConfigService } from './form-field-config.service';
import { ActionTokenService } from './action-token.service';
import { FinanceController } from './finance.controller';
import { PublicFinanceController } from './public-finance.controller';
import { Requisition, RequisitionSchema } from './schemas/requisition.schema';
import {
  ExpenseCategory,
  ExpenseCategorySchema,
} from './schemas/expense-category.schema';
import {
  FormFieldConfig,
  FormFieldConfigSchema,
} from './schemas/form-field-config.schema';
import { ActionToken, ActionTokenSchema } from './schemas/action-token.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { RolesModule } from '../roles/roles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Requisition.name, schema: RequisitionSchema },
      { name: ExpenseCategory.name, schema: ExpenseCategorySchema },
      { name: FormFieldConfig.name, schema: FormFieldConfigSchema },
      { name: ActionToken.name, schema: ActionTokenSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    forwardRef(() => RolesModule),
    forwardRef(() => NotificationsModule),
    CommonModule,
  ],
  controllers: [FinanceController, PublicFinanceController],
  providers: [
    FinanceService,
    ExpenseCategoryService,
    FormFieldConfigService,
    ActionTokenService,
  ],
  exports: [
    FinanceService,
    ExpenseCategoryService,
    FormFieldConfigService,
    ActionTokenService,
  ],
})
export class FinanceModule {}
