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
import { EmailProvider } from '../notifications/providers/email.provider';

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
    private emailProvider: EmailProvider,
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

      let itemImages: string[] = [];
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
        const colourGroup = product.variants.find(
          (v) => v.colour === item.colour && v.images?.length,
        );
        itemImages = colourGroup?.images || product.images || [];
      } else {
        itemImages = product.images || [];
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
        images: itemImages,
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
    search?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (query.status) filter.status = query.status;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.search) {
      const q = query.search.trim();
      filter.$or = [
        { orderNumber: { $regex: q, $options: 'i' } },
        { 'delivery.fullName': { $regex: q, $options: 'i' } },
        { 'delivery.email': { $regex: q, $options: 'i' } },
        { 'delivery.phone': { $regex: q, $options: 'i' } },
        { customerEmail: { $regex: q, $options: 'i' } },
      ];
    }

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
    if ((dto as any).status === OrderStatus.PAID) {
      throw new BadRequestException(
        'Order status "paid" can only be set through payment verification',
      );
    }
    const order = await this.orderModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getOrderStats() {
    const [totalOrders, revenue, statusBreakdown, itemsSold] =
      await Promise.all([
        this.orderModel.countDocuments({
          paymentStatus: PaymentStatus.SUCCESSFUL,
        }),
        this.orderModel.aggregate([
          { $match: { paymentStatus: PaymentStatus.SUCCESSFUL } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        this.orderModel.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        this.orderModel.aggregate([
          { $match: { paymentStatus: PaymentStatus.SUCCESSFUL } },
          { $unwind: '$items' },
          { $group: { _id: null, total: { $sum: '$items.quantity' } } },
        ]),
      ]);

    return {
      totalOrders,
      totalRevenue: revenue[0]?.total || 0,
      totalItemsSold: itemsSold[0]?.total || 0,
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

    const firstProduct = order.items?.[0]?.product;
    const product = firstProduct
      ? await this.productModel.findById(firstProduct).select('slug').lean()
      : null;

    const txRef = `store-${order.orderNumber}-${Date.now()}`;
    const payload = {
      tx_ref: txRef,
      amount: order.totalAmount,
      currency: order.currency || 'NGN',
      redirect_url: `${this.frontendUrl}/store/payment/verify?order=${order.orderNumber}${product?.slug ? `&product=${product.slug}` : ''}`,
      customer: {
        email: order.customerEmail || order.delivery.email || 'customer@store.com',
        phone_number: order.customerPhone || order.delivery.phone,
        name: order.delivery.fullName,
      },
      customizations: {
        title: 'Store Order Payment',
        description: `Payment for order ${order.orderNumber}`,
      },
      payment_options: 'banktransfer,card,ussd',
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

    if (data.data.amount < order.totalAmount) {
      this.logger.warn(
        `Amount mismatch: paid ${data.data.amount}, expected ${order.totalAmount}`,
      );
      return { verified: false, message: 'Amount mismatch' };
    }

    order.paymentStatus = PaymentStatus.SUCCESSFUL;
    order.status = OrderStatus.PAID;
    order.flutterwaveTransactionId = transactionId;
    order.paymentMeta = data.data;
    await order.save();

    await this.deductStock(order);
    this.sendOrderConfirmationEmail(order).catch(() => {});

    return { verified: true, order };
  }

  async verifyOrderPayment(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentStatus === PaymentStatus.SUCCESSFUL) {
      return { verified: true, message: 'Already verified', order };
    }
    if (!order.flutterwaveRef) {
      throw new BadRequestException('No payment initiated for this order');
    }

    const response = await fetch(
      `${this.flutterwaveBaseUrl}/transactions/verify_by_reference?tx_ref=${order.flutterwaveRef}`,
      { headers: { Authorization: `Bearer ${this.flutterwaveSecretKey}` } },
    );
    const data = await response.json();

    if (data.status !== 'success' || data.data?.status !== 'successful') {
      return { verified: false, message: 'Payment not found or not successful', data: data.data };
    }

    if (data.data.amount < order.totalAmount) {
      return {
        verified: false,
        message: `Amount mismatch: paid ${data.data.amount}, expected ${order.totalAmount}`,
      };
    }

    order.paymentStatus = PaymentStatus.SUCCESSFUL;
    order.status = OrderStatus.PAID;
    order.flutterwaveTransactionId = String(data.data.id);
    order.paymentMeta = data.data;
    await order.save();
    await this.deductStock(order);
    this.sendOrderConfirmationEmail(order).catch(() => {});

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
        this.sendOrderConfirmationEmail(order).catch(() => {});
      }
    }

    return { status: 'ok' };
  }

  private async sendOrderConfirmationEmail(order: OrderDocument) {
    const email =
      order.customerEmail || order.delivery?.email;
    if (!email) {
      this.logger.warn(
        `No email for order ${order.orderNumber}, skipping confirmation`,
      );
      return;
    }

    const formatPrice = (amount: number) =>
      new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: order.currency || 'NGN',
        minimumFractionDigits: 0,
      }).format(amount);

    const orderDate = new Date(
      order['createdAt'] || Date.now(),
    ).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const itemCards = order.items
      .map((item) => {
        const img = item.images?.[0];
        const colourMatch = item.colour?.match(/^(.+?)\s*\(([^)]+)\)$/);
        const design = colourMatch ? colourMatch[1].trim() : item.colour || '';
        const color = colourMatch ? colourMatch[2].trim() : '';
        const meta = [design, color, item.size].filter(Boolean).join(' · ');
        return `
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px" cellpadding="0" cellspacing="0">
          <tr>
            ${
              img
                ? `<td style="width:56px;padding:0 12px 0 0;vertical-align:top">
                <img src="${img}" alt="" width="52" height="52" style="border-radius:10px;object-fit:cover;display:block" />
              </td>`
                : ''
            }
            <td style="vertical-align:top;padding:2px 0">
              <p style="margin:0;font-size:13px;font-weight:600;color:#111827;line-height:1.3">${item.productName}</p>
              ${meta ? `<p style="margin:2px 0 0;font-size:11px;color:#9ca3af;letter-spacing:0.2px">${meta}</p>` : ''}
            </td>
            <td style="vertical-align:top;text-align:right;white-space:nowrap;padding:2px 0">
              <p style="margin:0;font-size:13px;font-weight:600;color:#111827">${formatPrice(item.totalPrice)}</p>
              <p style="margin:2px 0 0;font-size:11px;color:#9ca3af">Qty ${item.quantity}</p>
            </td>
          </tr>
        </table>`;
      })
      .join('');

    const discountRow =
      order.discountAmount > 0
        ? `<tr>
        <td style="padding:3px 0;font-size:12px;color:#059669">Discount</td>
        <td style="padding:3px 0;text-align:right;font-size:12px;color:#059669">-${formatPrice(order.discountAmount)}</td>
      </tr>`
        : '';

    const deliveryParts = [
      order.delivery.address,
      order.delivery.city,
      order.delivery.state,
    ]
      .filter(Boolean)
      .join(', ');

    const html = `
    <div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;background:#ffffff">
      <!-- Accent bar -->
      <div style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa);border-radius:4px 4px 0 0"></div>

      <div style="padding:28px 24px 20px">
        <!-- Confirmation badge -->
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px"><tr>
          <td style="background:#f0fdf4;border-radius:20px;padding:6px 16px">
            <span style="font-size:13px;font-weight:600;color:#15803d;letter-spacing:0.3px">&#10003; Payment Confirmed</span>
          </td>
        </tr></table>

        <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#111827;text-align:center">Thanks, ${order.delivery.fullName}!</p>
        <p style="margin:0 0 24px;font-size:13px;color:#9ca3af;text-align:center">Your order has been received and is being processed.</p>

        <!-- Order meta -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:10px 12px;background:#f9fafb;border-radius:8px 0 0 8px;width:50%">
              <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.6px;color:#9ca3af;font-weight:600">Order</p>
              <p style="margin:3px 0 0;font-size:13px;font-weight:600;color:#111827;font-family:'SF Mono',Monaco,monospace,sans-serif">${order.orderNumber}</p>
            </td>
            <td style="padding:10px 12px;background:#f9fafb;border-radius:0 8px 8px 0;width:50%;text-align:right">
              <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.6px;color:#9ca3af;font-weight:600">Date</p>
              <p style="margin:3px 0 0;font-size:13px;font-weight:600;color:#111827">${orderDate}</p>
            </td>
          </tr>
        </table>

        <!-- Items -->
        <p style="margin:0 0 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#9ca3af;font-weight:700">Items</p>
        ${itemCards}

        <!-- Divider + totals -->
        <div style="border-top:1px solid #f3f4f6;margin:14px 0 10px"></div>
        <table style="width:100%;border-collapse:collapse" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:3px 0;font-size:12px;color:#6b7280">Subtotal</td>
            <td style="padding:3px 0;text-align:right;font-size:12px;color:#374151">${formatPrice(order.subtotal)}</td>
          </tr>
          ${discountRow}
        </table>
        <div style="border-top:1px solid #f3f4f6;margin:6px 0"></div>
        <table style="width:100%;border-collapse:collapse" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;font-size:15px;font-weight:700;color:#111827">Total</td>
            <td style="padding:6px 0;text-align:right;font-size:15px;font-weight:700;color:#111827">${formatPrice(order.totalAmount)}</td>
          </tr>
        </table>

        <!-- Delivery -->
        <div style="margin-top:20px;border:1px solid #f3f4f6;border-radius:8px;padding:14px 14px 12px">
          <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#9ca3af;font-weight:700">Delivery</p>
          <p style="margin:0;font-size:13px;color:#374151;line-height:1.6">
            ${order.delivery.fullName}<br/>
            ${order.delivery.phone}<br/>
            ${deliveryParts}
          </p>
          ${order.delivery.notes ? `<p style="margin:6px 0 0;font-size:11px;color:#9ca3af;font-style:italic">${order.delivery.notes}</p>` : ''}
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:14px 24px 20px;text-align:center;border-top:1px solid #f9fafb">
        <p style="margin:0;font-size:11px;color:#d1d5db">Questions? Reply to this email.</p>
        <p style="margin:6px 0 0;font-size:10px;color:#e5e7eb">A vision of Dami Oguntunde Teaching Ministries</p>
      </div>
    </div>`;

    try {
      await this.emailProvider.sendEmail({
        to: email,
        subject: `Order Confirmed - ${order.orderNumber}`,
        html,
        from: this.configService.get<string>('STORE_EMAIL_FROM') || undefined,
      });
      this.logger.log(`Order confirmation email sent for ${order.orderNumber}`);
    } catch (err) {
      this.logger.error(
        `Failed to send confirmation email for ${order.orderNumber}`,
        err,
      );
    }
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
