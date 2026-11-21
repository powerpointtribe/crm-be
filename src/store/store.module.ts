import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { Product, ProductSchema } from './schemas/product.schema';
import { Order, OrderSchema } from './schemas/order.schema';
import { Coupon, CouponSchema } from './schemas/coupon.schema';
import { RolesModule } from '../roles/roles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { GivingModule } from '../giving/giving.module';

@Module({
  imports: [
    RolesModule,
    NotificationsModule,
    GivingModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
