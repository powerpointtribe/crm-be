import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { BulkEmailPermission } from './permissions';
import { MailingListService } from './mailing-list.service';

@ApiTags('Mailing Lists')
@ApiBearerAuth()
@Controller('bulk-email/mailing-lists')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MailingListController {
  constructor(private readonly mailingListService: MailingListService) {}

  @Post()
  @RequirePermission(BulkEmailPermission.CREATE_CAMPAIGN)
  @ApiOperation({ summary: 'Create an empty mailing list' })
  async create(@Body() body: { name: string; description?: string }, @Request() req) {
    const branchId = (req.user?.branch?._id || req.user?.branch)?.toString();
    const list = await this.mailingListService.create({
      name: body.name,
      description: body.description,
      branchId,
      userId: req.user?._id?.toString(),
    });
    return { success: true, message: 'Mailing list created', data: list };
  }

  @Post('import-csv')
  @RequirePermission(BulkEmailPermission.CREATE_CAMPAIGN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create mailing list from CSV upload' })
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name: string; description?: string },
    @Request() req,
  ) {
    if (!file) throw new BadRequestException('No CSV file provided');

    const csvText = file.buffer.toString('utf-8');
    const lines = csvText.split('\n').filter((l) => l.trim());

    if (lines.length < 2) {
      throw new BadRequestException('CSV must have a header row and at least one data row');
    }

    // Parse header
    const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''));
    const emailIdx = header.findIndex((h) => h === 'email' || h === 'e-mail' || h === 'email address');
    const firstNameIdx = header.findIndex((h) => h === 'firstname' || h === 'first name' || h === 'first_name' || h === 'full name' || h === 'name');
    const lastNameIdx = header.findIndex((h) => h === 'lastname' || h === 'last name' || h === 'last_name' || h === 'surname');

    if (emailIdx === -1) {
      throw new BadRequestException('CSV must have an "email" column');
    }

    // Parse rows
    const rows: Array<{ email: string; firstName?: string; lastName?: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));
      const email = cols[emailIdx]?.trim();
      if (email && email.includes('@')) {
        let firstName = firstNameIdx >= 0 ? cols[firstNameIdx]?.trim() : '';
        let lastName = lastNameIdx >= 0 ? cols[lastNameIdx]?.trim() : '';

        // If firstName column was "full name", split it
        if (firstName && !lastName && firstName.includes(' ')) {
          const parts = firstName.split(/\s+/);
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }

        rows.push({ email, firstName, lastName });
      }
    }

    const branchId = (req.user?.branch?._id || req.user?.branch)?.toString();
    const list = await this.mailingListService.createFromCsv({
      name: body.name || `CSV Import ${new Date().toLocaleDateString()}`,
      description: body.description,
      branchId,
      rows,
      userId: req.user?._id?.toString(),
    });

    return {
      success: true,
      message: `Mailing list created with ${list.contactCount} contacts`,
      data: list,
    };
  }

  @Post('from-event')
  @RequirePermission(BulkEmailPermission.CREATE_CAMPAIGN)
  @ApiOperation({ summary: 'Create mailing list from event registrations' })
  async createFromEvent(
    @Body() body: { name: string; description?: string; eventId: string },
    @Request() req,
  ) {
    if (!body.eventId) throw new BadRequestException('eventId is required');

    const branchId = (req.user?.branch?._id || req.user?.branch)?.toString();
    const list = await this.mailingListService.createFromEvent({
      name: body.name,
      description: body.description,
      eventId: body.eventId,
      branchId,
      userId: req.user?._id?.toString(),
    });

    return {
      success: true,
      message: `Mailing list created with ${list.contactCount} contacts from event`,
      data: list,
    };
  }

  @Get()
  @RequirePermission(BulkEmailPermission.VIEW_CAMPAIGNS)
  @ApiOperation({ summary: 'Get all mailing lists' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Request() req?: any,
  ) {
    const branchId = (req?.user?.branch?._id || req?.user?.branch)?.toString();
    const result = await this.mailingListService.findAll(branchId, { page, limit, search });
    return { success: true, data: result };
  }

  @Get(':id')
  @RequirePermission(BulkEmailPermission.VIEW_CAMPAIGNS)
  @ApiOperation({ summary: 'Get mailing list with contacts' })
  async findById(@Param('id') id: string) {
    const list = await this.mailingListService.findById(id);
    return { success: true, data: list };
  }

  @Post(':id/contacts')
  @RequirePermission(BulkEmailPermission.CREATE_CAMPAIGN)
  @ApiOperation({ summary: 'Add contacts to a mailing list' })
  async addContacts(
    @Param('id') id: string,
    @Body() body: { contacts: Array<{ email: string; firstName?: string; lastName?: string }> },
    @Request() req,
  ) {
    const list = await this.mailingListService.addContacts(
      id,
      body.contacts,
      req.user?._id?.toString(),
    );
    return { success: true, message: 'Contacts added', data: list };
  }

  @Delete(':id/contacts')
  @RequirePermission(BulkEmailPermission.UPDATE_CAMPAIGN)
  @ApiOperation({ summary: 'Remove contacts from a mailing list' })
  async removeContacts(
    @Param('id') id: string,
    @Body() body: { emails: string[] },
  ) {
    const list = await this.mailingListService.removeContacts(id, body.emails);
    return { success: true, message: 'Contacts removed', data: list };
  }

  @Delete(':id')
  @RequirePermission(BulkEmailPermission.DELETE_CAMPAIGN)
  @ApiOperation({ summary: 'Delete a mailing list' })
  async delete(@Param('id') id: string) {
    await this.mailingListService.delete(id);
    return { success: true, message: 'Mailing list deleted' };
  }
}
