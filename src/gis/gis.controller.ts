import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GisService } from './gis.service';
import { GisPermission } from './permissions';
import { QueryGisDashboardDto, QueryGisTrendsDto } from './dto/query-gis.dto';

@ApiTags('Growth Intelligence System')
@ApiBearerAuth()
@Controller('gis')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class GisController {
  constructor(private readonly gisService: GisService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Pastor-level GIS dashboard — 15 metrics + funnel' })
  @RequirePermission(GisPermission.VIEW_DASHBOARD)
  async getDashboard(
    @CurrentUser() user: any,
    @Query() query: QueryGisDashboardDto,
  ) {
    const branch = query.branch || user.branch;
    const date = query.date ? new Date(query.date) : undefined;
    const data = await this.gisService.getDashboard(branch, date);
    return { data };
  }

  @Get('trends')
  @ApiOperation({ summary: 'Trend data from snapshots' })
  @RequirePermission(GisPermission.VIEW_TRENDS)
  async getTrends(
    @CurrentUser() user: any,
    @Query() query: QueryGisTrendsDto,
  ) {
    const branch = query.branch || user.branch;
    const data = await this.gisService.getTrends(
      branch,
      query.months ? parseInt(query.months, 10) : 6,
      query.period || 'weekly',
    );
    return { data };
  }

  @Get('district/:id')
  @ApiOperation({ summary: 'District-level metrics' })
  @RequirePermission(GisPermission.VIEW_DISTRICT)
  async getDistrictView(@Param('id') id: string) {
    const data = await this.gisService.getDistrictView(id);
    return { data };
  }

  @Get('directorate/:id')
  @ApiOperation({ summary: 'Directorate-level metrics (aggregated districts)' })
  @RequirePermission(GisPermission.VIEW_DIRECTORATE)
  async getDirectorateView(@Param('id') id: string) {
    const data = await this.gisService.getDirectorateView(id);
    return { data };
  }

  @Get('unit/:id')
  @ApiOperation({ summary: 'Unit-level metrics' })
  @RequirePermission(GisPermission.VIEW_UNIT)
  async getUnitView(@Param('id') id: string) {
    const data = await this.gisService.getUnitView(id);
    return { data };
  }

  @Get('member/:id/journey')
  @ApiOperation({ summary: 'Individual member funnel position and journey' })
  @RequirePermission(GisPermission.VIEW_MEMBER_JOURNEY)
  async getMemberJourney(@Param('id') id: string) {
    const data = await this.gisService.getMemberJourney(id);
    return { data };
  }

  @Post('snapshot')
  @ApiOperation({ summary: 'Manually trigger a GIS snapshot (admin)' })
  @RequirePermission(GisPermission.VIEW_DASHBOARD)
  async triggerSnapshot(@CurrentUser() user: any) {
    const data = await this.gisService.takeSnapshot(user.branch, 'weekly');
    return { data, message: 'Snapshot created' };
  }
}
