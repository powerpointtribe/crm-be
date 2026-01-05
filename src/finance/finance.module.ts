import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { FinanceService } from './finance.service';
import { ExpenseCategoryService } from './expense-category.service';
import { FormFieldConfigService } from './form-field-config.service';
import { FinanceController } from './finance.controller';
import { Requisition, RequisitionSchema } from './schemas/requisition.schema';
import {
  ExpenseCategory,
  ExpenseCategorySchema,
} from './schemas/expense-category.schema';
import {
  FormFieldConfig,
  FormFieldConfigSchema,
} from './schemas/form-field-config.schema';
import { RolesModule } from '../roles/roles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Requisition.name, schema: RequisitionSchema },
      { name: ExpenseCategory.name, schema: ExpenseCategorySchema },
      { name: FormFieldConfig.name, schema: FormFieldConfigSchema },
    ]),
    forwardRef(() => RolesModule),
    forwardRef(() => NotificationsModule),
    CommonModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService, ExpenseCategoryService, FormFieldConfigService],
  exports: [FinanceService, ExpenseCategoryService, FormFieldConfigService],
})
export class FinanceModule {}
