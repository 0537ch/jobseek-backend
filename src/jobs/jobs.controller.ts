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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JobType, Role } from '.prisma/client';

@Controller('jobs')
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMPANY)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateJobDto, @CurrentUser() user: { id: string }) {
    return this.jobsService.create(dto, user.id);
  }

  @Get()
  findAll(
    @Query('location') location?: string,
    @Query('jobType') jobType?: JobType,
  ) {
    return this.jobsService.findAll({ location, jobType });
  }

  @Get('my/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMPANY)
  findMyJobs(@CurrentUser() user: { id: string }) {
    return this.jobsService.findMyJobs(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMPANY)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.jobsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COMPANY)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.jobsService.remove(id, user.id);
  }
}
