import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { EventsService } from './events.service';
import {
  UpdatePartnerStatusDto,
  QueryPartnersDto,
  ContactPartnerDto,
  BulkPartnerEmailDto,
} from './dto/partner.dto';
import {
  UpdateRegistrationStatusDto,
  RegistrationSearchDto,
} from './dto/create-registration.dto';
import { BranchFilterContext } from '../common/services/branch-access.service';
import { Readable } from 'stream';
// Note: Install exceljs package: npm install exceljs
// import { Workbook } from 'exceljs';

@ApiTags('Events Admin')
@ApiBearerAuth()
@Controller('events/:eventId/admin')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EventsAdminController {
  constructor(private readonly eventsService: EventsService) {}

  // ========== REGISTRATIONS MANAGEMENT ==========

  @Get('registrations')
  @RequirePermission('events:view-registrations')
  @ApiOperation({ summary: 'Get all registrations for an event (admin)' })
  @ApiResponse({ status: 200, description: 'Registrations retrieved successfully' })
  async getRegistrations(
    @Param('eventId') eventId: string,
    @Query() query: RegistrationSearchDto,
    @Req() req: any,
  ) {
    return this.eventsService.getRegistrations(eventId, query);
  }

  @Get('registrations/export')
  @RequirePermission('events:export')
  @ApiOperation({ summary: 'Export registrations (CSV, Excel, or PDF)' })
  @ApiResponse({ status: 200, description: 'Export file generated successfully' })
  async exportRegistrations(
    @Param('eventId') eventId: string,
    @Query() query: RegistrationSearchDto,
    @Query('format') format: 'csv' | 'xlsx' | 'pdf' = 'xlsx',
    @Req() req: any,
  ): Promise<StreamableFile> {
    return this.eventsService.exportRegistrations(eventId, query, format);
  }

  @Patch('registrations/:registrationId/status')
  @RequirePermission('events:manage-registrations')
  @ApiOperation({ summary: 'Update registration status' })
  @ApiResponse({ status: 200, description: 'Registration status updated' })
  async updateRegistrationStatus(
    @Param('eventId') eventId: string,
    @Param('registrationId') registrationId: string,
    @Body() updateDto: UpdateRegistrationStatusDto,
    @Req() req: any,
  ) {

    return this.eventsService.updateRegistrationStatus(
      eventId,
      registrationId,
      updateDto,
    );
  }

  @Post('registrations/email/bulk')
  @RequirePermission('events:send-emails')
  @ApiOperation({ summary: 'Send bulk email to registrants' })
  @ApiResponse({ status: 200, description: 'Bulk email queued successfully' })
  async sendBulkEmailToRegistrants(
    @Param('eventId') eventId: string,
    @Body() bulkEmailDto: any, // Would need to create proper DTO
    @Req() req: any,
  ) {

return this.eventsService.sendBulkEmailToRegistrants(eventId, bulkEmailDto);
  }

  // ========== PARTNERS MANAGEMENT ==========

  @Get('partners')
  @RequirePermission('events:manage-partners')
  @ApiOperation({ summary: 'Get all partners for an event (admin)' })
  @ApiResponse({ status: 200, description: 'Partners retrieved successfully' })
  async getPartners(
    @Param('eventId') eventId: string,
    @Query() query: QueryPartnersDto,
    @Req() req: any,
  ) {

return this.eventsService.getPartners(eventId, query);
  }

  @Patch('partners/:partnerId/status')
  @RequirePermission('events:manage-partners')
  @ApiOperation({ summary: 'Update partner status' })
  @ApiResponse({ status: 200, description: 'Partner status updated' })
  async updatePartnerStatus(
    @Param('eventId') eventId: string,
    @Param('partnerId') partnerId: string,
    @Body() updateDto: UpdatePartnerStatusDto,
    @Req() req: any,
  ) {

return this.eventsService.updatePartnerStatus(eventId, partnerId, updateDto);
  }

  @Post('partners/:partnerId/contact')
  @RequirePermission('events:manage-partners')
  @ApiOperation({ summary: 'Send email to a partner' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  async contactPartner(
    @Param('eventId') eventId: string,
    @Param('partnerId') partnerId: string,
    @Body() contactDto: ContactPartnerDto,
    @Req() req: any,
  ) {

await this.eventsService.contactPartner(eventId, partnerId, contactDto);

    return {
      success: true,
      message: 'Email sent successfully',
    };
  }

  @Post('partners/email/bulk')
  @RequirePermission('events:send-emails')
  @ApiOperation({ summary: 'Send bulk email to partners' })
  @ApiResponse({ status: 200, description: 'Bulk email queued successfully' })
  async sendBulkEmailToPartners(
    @Param('eventId') eventId: string,
    @Body() bulkEmailDto: BulkPartnerEmailDto,
    @Req() req: any,
  ) {

return this.eventsService.sendBulkEmailToPartners(eventId, bulkEmailDto);
  }

  @Get('partners/export')
  @RequirePermission('events:export')
  @ApiOperation({ summary: 'Export partners (CSV, Excel, or PDF)' })
  @ApiResponse({ status: 200, description: 'Export file generated successfully' })
  async exportPartners(
    @Param('eventId') eventId: string,
    @Query() query: QueryPartnersDto,
    @Query('format') format: 'csv' | 'xlsx' | 'pdf' = 'xlsx',
    @Req() req: any,
  ): Promise<StreamableFile> {
    return this.eventsService.exportPartners(eventId, query, format);
  }

  // ========== ANALYTICS ==========

  @Get('analytics/registrations')
  @RequirePermission('events:view-registrations')
  @ApiOperation({ summary: 'Get registration analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getRegistrationAnalytics(
    @Param('eventId') eventId: string,
    @Query() query: any, // Would use existing EventAnalyticsQueryDto
    @Req() req: any,
  ) {

// Use existing analytics methods from EventsService
    return this.eventsService.getEventAnalytics(eventId);
  }

  @Get('analytics/partners')
  @RequirePermission('events:manage-partners')
  @ApiOperation({ summary: 'Get partner analytics' })
  @ApiResponse({ status: 200, description: 'Partner analytics retrieved successfully' })
  async getPartnerAnalytics(
    @Param('eventId') eventId: string,
    @Req() req: any,
  ) {

return this.eventsService.getPartnerAnalytics(eventId);
  }

  @Get('analytics/overview')
  @RequirePermission('events:view-registrations')
  @ApiOperation({ summary: 'Get comprehensive event overview' })
  @ApiResponse({ status: 200, description: 'Overview retrieved successfully' })
  async getEventOverview(
    @Param('eventId') eventId: string,
    @Req() req: any,
  ) {

    // Fetch both registration and partner analytics
    const [eventAnalytics, partnerStats] = await Promise.all([
      this.eventsService.getEventAnalytics(eventId),
      this.eventsService.getPartnerAnalytics(eventId),
    ]);

    return {
      stats: eventAnalytics,
      registrations: eventAnalytics.registrations,
      partners: partnerStats,
    };
  }

  // ── Accountability Tracking ──

  @Post('accountability')
  @RequirePermission('events:manage-registrations')
  @ApiOperation({ summary: 'Record weekly accountability metrics for a participant' })
  async recordAccountability(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    const submittedBy = req.user?._id?.toString();
    const entry = await this.eventsService.recordAccountability(eventId, dto, submittedBy);
    return { success: true, message: 'Accountability recorded', data: entry };
  }

  @Get('accountability')
  @RequirePermission('events:view-registrations')
  @ApiOperation({ summary: 'Get accountability overview for all participants' })
  async getAccountabilityOverview(
    @Param('eventId') eventId: string,
    @Query('week') week?: number,
  ) {
    const result = await this.eventsService.getAccountabilityOverview(eventId, { week });
    return { success: true, data: result };
  }

  @Get('accountability/:registrationId')
  @RequirePermission('events:view-registrations')
  @ApiOperation({ summary: 'Get accountability history for one participant' })
  async getAccountabilityForRegistration(
    @Param('eventId') eventId: string,
    @Param('registrationId') registrationId: string,
  ) {
    const entries = await this.eventsService.getAccountabilityForRegistration(eventId, registrationId);
    return { success: true, data: entries };
  }
}
