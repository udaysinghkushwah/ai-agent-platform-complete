import { Controller, Get, MessageEvent, Param, Query, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { MinRole } from '../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { TraceQueryDto } from './dto/trace-query.dto';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Sse('traces/stream')
  @MinRole('VIEWER')
  streamTraces(@Param('projectId') projectId: string): Observable<MessageEvent> {
    return this.analytics.streamTraces(projectId);
  }

  @Get('analytics/summary')
  @MinRole('VIEWER')
  async summary(@Param('projectId') projectId: string, @Query() query: SummaryQueryDto) {
    return this.analytics.getSummary(projectId, query);
  }

  @Get('traces')
  @MinRole('VIEWER')
  async listTraces(@Param('projectId') projectId: string, @Query() query: TraceQueryDto) {
    return this.analytics.listTraces(projectId, query);
  }

  @Get('traces/search/query')
  @MinRole('VIEWER')
  async searchTraces(
    @Param('projectId') projectId: string,
    @Query('q') query: string,
  ) {
    return this.analytics.semanticSearchTraces(projectId, query || '');
  }

  @Get('traces/:traceId')
  @MinRole('VIEWER')
  async traceDetail(
    @Param('projectId') projectId: string,
    @Param('traceId') traceId: string,
  ) {
    return this.analytics.getTraceDetail(projectId, traceId);
  }
}
