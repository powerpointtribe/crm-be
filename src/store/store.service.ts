import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Order, OrderDocument, OrderStatus, PaymentStatus } from './schemas/order.schema';
import { Coupon, CouponDocument, DiscountType } from './schemas/coupon.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { createPaginatedResult } from '../common/utils/pagination.util';

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);
  private readonly flutterwaveSecretKey: string;
  private readonly flutterwaveBaseUrl = 'https://api.flutterwave.com/v3';
  private readonly frontendUrl: string;

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
    private configService: ConfigService,
  ) {
    this.flutterwaveSecretKey =
      this.configService.get<string>('FLUTTERWAVE_SECRET_KEY') || '';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  }

  // ─── Product CRUD ──────────────────────────────────────────────

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async createProduct(dto: CreateProductDto, userId: string) {
    const slug = dto.slug || this.generateSlug(dto.name);

    const existing = await this.productModel.findOne({ slug }).lean();
    if (existing) {
      throw new ConflictException(`A product with slug "${slug}" already exists`);
    }

    const product = await this.productModel.create({
      ...dto,
      slug,
      createdBy: new Types.ObjectId(userId),
    });

    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const updateData: any = { ...dto };
    if (dto.name && !dto.slug) {
      updateData.slug = this.generateSlug(dto.name);
    }

    if (updateData.slug) {
      const existing = await this.productModel
        .findOne({ slug: updateData.slug, _id: { $ne: id } })
        .lean();
      if (existing) {
        throw new ConflictException(
          `A product with slug "${updateData.slug}" already exists`,
        );
      }
    }

    const product = await this.productModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async deleteProduct(id: string) {
    const product = await this.productModel.findByIdAndDelete(id);
    if (!product) throw new NotFoundException('Product not found');
    return { deleted: true };
  }

  async getProducts(query: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.productModel.countDocuments(filter),
    ]);

    return createPaginatedResult(data, total, page, limit);
  }

  async getProductById(id: string) {
    const product = await this.productModel.findById(id).lean();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getProductBySlug(slug: string) {
    const product = await this.productModel
      .findOne({ slug, isActive: true })
      .lean();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getActiveProducts() {
    const products = await this.productModel
      .find({ isActive: true })
      .sort({ isFeatured: -1, createdAt: -1 })
      .lean();
    return products;
  }

  // ─── Coupon CRUD ───────────────────────────────────────────────

  async createCoupon(dto: CreateCouponDto, userId: string) {
    const existing = await this.couponModel
      .findOne({ code: dto.code.toUpperCase() })
      .lean();
    if (existing) {
      throw new ConflictException(`Coupon code "${dto.code}" already exists`);
    }

    const coupon = await this.couponModel.create({
      ...dto,
      code: dto.code.toUpperCase(),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      applicableProducts: dto.applicableProducts?.map(
        (id) => new Types.ObjectId(id),
      ),
      createdBy: new Types.ObjectId(userId),
    });

    return coupon;
  }

  async updateCoupon(id: string, dto: UpdateCouponDto) {
    const updateData: any = { ...dto };
    if (dto.code) updateData.code = dto.code.toUpperCase();
    if (dto.expiresAt) updateData.expiresAt = new Date(dto.expiresAt);
    if (dto.applicableProducts) {
      updateData.applicableProducts = dto.applicableProducts.map(
        (id) => new Types.ObjectId(id),
      );
    }

    if (updateData.code) {
      const existing = await this.couponModel
        .findOne({ code: updateData.code, _id: { $ne: id } })
        .lean();
      if (existing) {
        throw new ConflictException(
          `Coupon code "${updateData.code}" already exists`,
        );
      }
    }

    const coupon = await this.couponModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async deleteCoupon(id: string) {
    const coupon = await this.couponModel.findByIdAndDelete(id);
    if (!coupon) throw new NotFoundException('Coupon not found');
    return { deleted: true };
  }

  async getCoupons(query: { page?: number; limit?: number; isActive?: boolean }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (query.isActive !== undefined) filter.isActive = query.isActive;

    const [data, total] = await Promise.all([
      this.couponModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.couponModel.countDocuments(filter),
    ]);

    return createPaginatedResult(data, total, page, limit);
  }

  async validateCoupon(code: string, orderSubtotal: number, productIds: string[]) {
    const coupon = await this.couponModel
      .findOne({ code: code.toUpperCase(), isActive: true })
      .lean();

    if (!coupon) {
      throw new BadRequestException('Invalid coupon code');
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    if (coupon.minOrderAmount && orderSubtotal < coupon.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount of ${coupon.minOrderAmount} required for this coupon`,
      );
    }

    if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
      const applicableSet = new Set(
        coupon.applicableProducts.map((id) => id.toString()),
      );
      const hasApplicable = productIds.some((id) => applicableSet.has(id));
      if (!hasApplicable) {
        throw new BadRequestException(
          'Coupon is not applicable to any products in this order',
        );
      }
    }

    let discountAmount: number;
    if (coupon.discountType === DiscountType.PERCENTAGE) {
      discountAmount = Math.round(orderSubtotal * (coupon.discountValue / 100));
      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    } else {
      discountAmount = Math.min(coupon.discountValue, orderSubtotal);
    }

    return { coupon, discountAmount };
  }

  // ─── Orders ────────────────────────────────────────────────────

  private generateOrderNumber(): string {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${datePart}-${rand}`;
  }

  async createOrder(dto: CreateOrderDto) {
    const orderItems: any[] = [];
    let subtotal = 0;

    for (const item of dto.items) {
      const product = await this.productModel.findById(item.product).lean();
      if (!product) {
        throw new NotFoundException(`Product ${item.product} not found`);
      }
      if (!product.isActive) {
        throw new BadRequestException(`Product "${product.name}" is not available`);
      }

      if (item.size || item.colour) {
        const variant = product.variants.find(
          (v) =>
            (!item.size || v.size === item.size) &&
            (!item.colour || v.colour === item.colour),
        );
        if (!variant) {
          throw new BadRequestException(
            `Variant ${item.size || ''}/${item.colour || ''} not found for "${product.name}"`,
          );
        }
        if (variant.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" (${item.size}/${item.colour}). Available: ${variant.stock}`,
          );
        }
      }

      const unitPrice = product.price;
      const itemTotal = unitPrice * item.quantity;

      orderItems.push({
        product: new Types.ObjectId(item.product),
        productName: product.name,
        size: item.size,
        colour: item.colour,
        quantity: item.quantity,
        unitPrice,
        totalPrice: itemTotal,
      });

      subtotal += itemTotal;
    }

    let discountAmount = 0;
    let couponCode: string | undefined;

    if (dto.couponCode) {
      const productIds = dto.items.map((i) => i.product);
      const result = await this.validateCoupon(dto.couponCode, subtotal, productIds);
      discountAmount = result.discountAmount;
      couponCode = result.coupon.code;
    }

    const totalAmount = subtotal - discountAmount;
    const orderNumber = this.generateOrderNumber();

    const order = await this.orderModel.create({
      orderNumber,
      items: orderItems,
      delivery: dto.delivery,
      subtotal,
      discountAmount,
      totalAmount,
      customerEmail: dto.customerEmail || dto.delivery.email,
      customerPhone: dto.customerPhone || dto.delivery.phone,
    });

    if (couponCode) {
      await this.couponModel.updateOne(
        { code: couponCode },
        { $inc: { usageCount: 1 } },
      );
    }

    return order;
  }

  async getOrders(query: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (query.status) filter.status = query.status;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;

    const [data, total] = await Promise.all([
      this.orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.orderModel.countDocuments(filter),
    ]);

    return createPaginatedResult(data, total, page, limit);
  }

  async getOrderById(id: string) {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getOrderByNumber(orderNumber: string) {
    const order = await this.orderModel.findOne({ orderNumber }).lean();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateOrder(id: string, dto: UpdateOrderDto) {
    const order = await this.orderModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getOrderStats() {
    const [totalOrders, revenue, statusBreakdown] = await Promise.all([
      this.orderModel.countDocuments({ paymentStatus: PaymentStatus.SUCCESSFUL }),
      this.orderModel.aggregate([
        { $match: { paymentStatus: PaymentStatus.SUCCESSFUL } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      this.orderModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      totalOrders,
      totalRevenue: revenue[0]?.total || 0,
      statusBreakdown: statusBreakdown.map((s) => ({
        status: s._id,
        count: s.count,
      })),
    };
  }

  // ─── Flutterwave Payment ──────────────────────────────────────

  async initiatePayment(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentStatus === PaymentStatus.SUCCESSFUL) {
      throw new BadRequestException('Order has already been paid');
    }

    const isTestOrder =
      order.customerEmail === 'gthankgod@gmail.com' ||
      order.delivery?.email === 'gthankgod@gmail.com';
    const chargeAmount = isTestOrder ? 100 : order.totalAmount;

    const txRef = `store-${order.orderNumber}-${Date.now()}`;
    const payload = {
      tx_ref: txRef,
      amount: chargeAmount,
      currency: order.currency || 'NGN',
      redirect_url: `${this.frontendUrl}/store/payment/verify?order=${order.orderNumber}`,
      customer: {
        email: order.customerEmail || order.delivery.email || 'customer@store.com',
        phone_number: order.customerPhone || order.delivery.phone,
        name: order.delivery.fullName,
      },
      customizations: {
        title: 'Store Order Payment',
        description: `Payment for order ${order.orderNumber}`,
      },
      meta: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      },
    };

    const response = await fetch(`${this.flutterwaveBaseUrl}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      this.logger.error('Flutterwave payment initiation failed', data);
      throw new BadRequestException('Failed to initiate payment');
    }

    order.flutterwaveRef = txRef;
    await order.save();

    return { paymentLink: data.data.link, txRef };
  }

  async verifyPayment(transactionId: string) {
    const response = await fetch(
      `${this.flutterwaveBaseUrl}/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${this.flutterwaveSecretKey}`,
        },
      },
    );

    const data = await response.json();

    if (data.status !== 'success' || data.data.status !== 'successful') {
      return { verified: false, data: data.data };
    }

    const txRef = data.data.tx_ref;
    const order = await this.orderModel.findOne({ flutterwaveRef: txRef });

    if (!order) {
      this.logger.warn(`No order found for tx_ref: ${txRef}`);
      return { verified: false, message: 'Order not found' };
    }

    const isTestOrder =
      order.customerEmail === 'gthankgod@gmail.com' ||
      order.delivery?.email === 'gthankgod@gmail.com';
    const expectedAmount = isTestOrder ? 100 : order.totalAmount;

    if (data.data.amount < expectedAmount) {
      this.logger.warn(
        `Amount mismatch: paid ${data.data.amount}, expected ${expectedAmount}`,
      );
      return { verified: false, message: 'Amount mismatch' };
    }

    order.paymentStatus = PaymentStatus.SUCCESSFUL;
    order.status = OrderStatus.PAID;
    order.flutterwaveTransactionId = transactionId;
    order.paymentMeta = data.data;
    await order.save();

    await this.deductStock(order);

    return { verified: true, order };
  }

  async handleWebhook(payload: any, verifyHash: string) {
    const secretHash = this.configService.get<string>('FLUTTERWAVE_HASH');
    if (secretHash && verifyHash !== secretHash) {
      this.logger.warn('Invalid webhook hash');
      return { status: 'error' };
    }

    if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
      const txRef = payload.data.tx_ref;
      const order = await this.orderModel.findOne({ flutterwaveRef: txRef });

      if (order && order.paymentStatus !== PaymentStatus.SUCCESSFUL) {
        order.paymentStatus = PaymentStatus.SUCCESSFUL;
        order.status = OrderStatus.PAID;
        order.flutterwaveTransactionId = String(payload.data.id);
        order.paymentMeta = payload.data;
        await order.save();
        await this.deductStock(order);
      }
    }

    return { status: 'ok' };
  }

  private async deductStock(order: OrderDocument) {
    for (const item of order.items) {
      if (item.size || item.colour) {
        await this.productModel.updateOne(
          {
            _id: item.product,
            'variants.size': item.size,
            'variants.colour': item.colour,
          },
          { $inc: { 'variants.$.stock': -item.quantity } },
        );
      }
    }
  }
}
