import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';
import { StoreService } from './store.service';
import { StorePermission } from './permissions';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@ApiTags('Store')
@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  // ─── Public Endpoints ──────────────────────────────────────────

  @Get('public/products')
  @Public()
  @ApiOperation({ summary: 'List active store products (public)' })
  async getActiveProducts() {
    const products = await this.storeService.getActiveProducts();
    return ResponseUtil.success(products, 'Active products retrieved');
  }

  @Get('public/products/:slug')
  @Public()
  @ApiOperation({ summary: 'Get product by slug (public)' })
  @ApiParam({ name: 'slug', example: '7th-anniversary' })
  async getProductBySlug(@Param('slug') slug: string) {
    const product = await this.storeService.getProductBySlug(slug);
    return ResponseUtil.success(product, 'Product retrieved');
  }

  @Post('public/orders')
  @Public()
  @ApiOperation({ summary: 'Create an order (public)' })
  async createOrder(@Body() dto: CreateOrderDto) {
    const order = await this.storeService.createOrder(dto);
    return ResponseUtil.success(order, 'Order created');
  }

  @Post('public/orders/:id/pay')
  @Public()
  @ApiOperation({ summary: 'Initiate payment for an order (public)' })
  async initiatePayment(@Param('id') id: string) {
    const result = await this.storeService.initiatePayment(id);
    return ResponseUtil.success(result, 'Payment initiated');
  }

  @Get('public/orders/:orderNumber/status')
  @Public()
  @ApiOperation({ summary: 'Get order status by order number (public)' })
  async getOrderStatus(@Param('orderNumber') orderNumber: string) {
    const order = await this.storeService.getOrderByNumber(orderNumber);
    return ResponseUtil.success(
      {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        items: order.items,
      },
      'Order status retrieved',
    );
  }

  @Get('public/payment/verify')
  @Public()
  @ApiOperation({ summary: 'Verify Flutterwave payment (redirect callback)' })
  @ApiQuery({ name: 'transaction_id', required: true })
  async verifyPayment(@Query('transaction_id') transactionId: string) {
    const result = await this.storeService.verifyPayment(transactionId);
    return ResponseUtil.success(result, 'Payment verification complete');
  }

  @Post('public/validate-coupon')
  @Public()
  @ApiOperation({ summary: 'Validate a coupon code (public)' })
  async validateCoupon(
    @Body() body: { code: string; subtotal: number; productIds: string[] },
  ) {
    const result = await this.storeService.validateCoupon(
      body.code,
      body.subtotal,
      body.productIds,
    );
    return ResponseUtil.success(
      {
        code: result.coupon.code,
        discountType: result.coupon.discountType,
        discountValue: result.coupon.discountValue,
        discountAmount: result.discountAmount,
      },
      'Coupon is valid',
    );
  }

  @Post('webhook/flutterwave')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Flutterwave webhook handler' })
  async flutterwaveWebhook(
    @Body() payload: any,
    @Headers('verif-hash') verifyHash: string,
  ) {
    return this.storeService.handleWebhook(payload, verifyHash);
  }

  // ─── Admin: Products ───────────────────────────────────────────

  @Get('products')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.VIEW_PRODUCTS)
  @ApiOperation({ summary: 'List all products (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  async getProducts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const result = await this.storeService.getProducts({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
    return ResponseUtil.success(result, 'Products retrieved');
  }

  @Get('products/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.VIEW_PRODUCTS)
  @ApiOperation({ summary: 'Get product by ID (admin)' })
  async getProductById(@Param('id') id: string) {
    const product = await this.storeService.getProductById(id);
    return ResponseUtil.success(product, 'Product retrieved');
  }

  @Post('products')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.CREATE_PRODUCT)
  @ApiOperation({ summary: 'Create a product' })
  async createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: any,
  ) {
    const product = await this.storeService.createProduct(dto, user.sub);
    return ResponseUtil.success(product, 'Product created');
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.UPDATE_PRODUCT)
  @ApiOperation({ summary: 'Update a product' })
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.storeService.updateProduct(id, dto);
    return ResponseUtil.success(product, 'Product updated');
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.DELETE_PRODUCT)
  @ApiOperation({ summary: 'Delete a product' })
  async deleteProduct(@Param('id') id: string) {
    await this.storeService.deleteProduct(id);
    return ResponseUtil.success(null, 'Product deleted');
  }

  // ─── Admin: Orders ─────────────────────────────────────────────

  @Get('orders')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.VIEW_ORDERS)
  @ApiOperation({ summary: 'List all orders (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'paymentStatus', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getOrders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.storeService.getOrders({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      paymentStatus,
      search,
    });
    return ResponseUtil.success(result, 'Orders retrieved');
  }

  @Get('orders/stats')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.VIEW_ORDERS)
  @ApiOperation({ summary: 'Get order statistics' })
  async getOrderStats() {
    const stats = await this.storeService.getOrderStats();
    return ResponseUtil.success(stats, 'Order stats retrieved');
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.VIEW_ORDERS)
  @ApiOperation({ summary: 'Get order by ID (admin)' })
  async getOrderById(@Param('id') id: string) {
    const order = await this.storeService.getOrderById(id);
    return ResponseUtil.success(order, 'Order retrieved');
  }

  @Post('orders/:id/verify-payment')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.UPDATE_ORDER)
  @ApiOperation({ summary: 'Verify pending payment for an order' })
  async verifyOrderPayment(@Param('id') id: string) {
    const result = await this.storeService.verifyOrderPayment(id);
    return ResponseUtil.success(result, 'Payment verification complete');
  }

  @Patch('orders/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.UPDATE_ORDER)
  @ApiOperation({ summary: 'Update order status' })
  async updateOrder(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    const order = await this.storeService.updateOrder(id, dto);
    return ResponseUtil.success(order, 'Order updated');
  }

  // ─── Admin: Coupons ────────────────────────────────────────────

  @Get('coupons')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.MANAGE_COUPONS)
  @ApiOperation({ summary: 'List all coupons' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  async getCoupons(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('isActive') isActive?: string,
  ) {
    const result = await this.storeService.getCoupons({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
    return ResponseUtil.success(result, 'Coupons retrieved');
  }

  @Post('coupons')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.MANAGE_COUPONS)
  @ApiOperation({ summary: 'Create a coupon' })
  async createCoupon(
    @Body() dto: CreateCouponDto,
    @CurrentUser() user: any,
  ) {
    const coupon = await this.storeService.createCoupon(dto, user.sub);
    return ResponseUtil.success(coupon, 'Coupon created');
  }

  @Patch('coupons/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.MANAGE_COUPONS)
  @ApiOperation({ summary: 'Update a coupon' })
  async updateCoupon(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const coupon = await this.storeService.updateCoupon(id, dto);
    return ResponseUtil.success(coupon, 'Coupon updated');
  }

  @Delete('coupons/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @RequirePermission(StorePermission.MANAGE_COUPONS)
  @ApiOperation({ summary: 'Delete a coupon' })
  async deleteCoupon(@Param('id') id: string) {
    await this.storeService.deleteCoupon(id);
    return ResponseUtil.success(null, 'Coupon deleted');
  }
}
