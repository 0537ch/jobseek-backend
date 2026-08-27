import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller()
export class ApplicationsController {
  constructor(private applicationsService: ApplicationsService) {}

  @Post('jobs/:jobId/apply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.JOB_SEEKER)
  @HttpCode(HttpStatus.CREATED)
  apply(@Param('jobId') jobId: string, @CurrentUser() user: { id: string }) {
    return this.applicationsService.apply(jobId, user.id);
  }

  @Get('applications/my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.JOB_SEEKER)
  findMyApplications(@CurrentUser() user: { id: string }) {
    return this.applicationsService.findMyApplications(user.id);
  }

  @Get('jobs/:jobId/applications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMPANY)
  findJobApplications(
    @Param('jobId') jobId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.applicationsService.findJobApplications(jobId, user.id);
  }

  @Patch('applications/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMPANY)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.applicationsService.updateStatus(id, dto.status, user.id);
  }

  @Get('applications/:id/history')
  @UseGuards(JwtAuthGuard)
  getHistory(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.applicationsService.getHistory(id, user.id);
  }
}
