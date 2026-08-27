import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobType } from '.prisma/client';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateJobDto, companyId: string) {
    return this.prisma.job.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        jobType: dto.jobType,
        companyId,
      },
      include: {
        company: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
      },
    });
  }

  async findAll(filters?: { location?: string; jobType?: JobType }) {
    const where: Record<string, unknown> = {};

    if (filters?.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }
    if (filters?.jobType) {
      const validJobTypes = Object.values(JobType);
      if (!validJobTypes.includes(filters.jobType)) {
        return [];
      }
      where.jobType = filters.jobType;
    }

    return this.prisma.job.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    if (!this.isValidUuid(id)) {
      throw new BadRequestException('Invalid job ID format');
    }

    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  async findMyJobs(companyId: string) {
    return this.prisma.job.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateJobDto, companyId: string) {
    if (!this.isValidUuid(id)) {
      throw new BadRequestException('Invalid job ID format');
    }

    const job = await this.prisma.job.findUnique({ where: { id } });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.companyId !== companyId) {
      throw new ForbiddenException('You can only update your own jobs');
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.salaryMin !== undefined) data.salaryMin = dto.salaryMin;
    if (dto.salaryMax !== undefined) data.salaryMax = dto.salaryMax;
    if (dto.jobType !== undefined) data.jobType = dto.jobType;

    return this.prisma.job.update({
      where: { id },
      data,
      include: {
        company: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
      },
    });
  }

  async remove(id: string, companyId: string) {
    if (!this.isValidUuid(id)) {
      throw new BadRequestException('Invalid job ID format');
    }

    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { _count: { select: { applications: true } } },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.companyId !== companyId) {
      throw new ForbiddenException('You can only delete your own jobs');
    }

    if (job._count.applications > 0) {
      throw new BadRequestException(
        'Cannot delete job with existing applications',
      );
    }

    return this.prisma.job.delete({ where: { id } });
  }

  private isValidUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    );
  }
}
