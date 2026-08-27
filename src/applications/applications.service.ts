import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationStatus } from '.prisma/client';

@Injectable()
export class ApplicationsService {
  constructor(private prisma: PrismaService) {}

  async apply(jobId: string, jobSeekerId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.companyId === jobSeekerId) {
      throw new ForbiddenException('You cannot apply to your own job');
    }

    try {
      const application = await this.prisma.application.create({
        data: {
          jobId,
          jobSeekerId,
          status: 'APPLIED',
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              location: true,
              company: { select: { id: true, companyName: true } },
            },
          },
        },
      });

      await this.prisma.applicationHistory.create({
        data: {
          applicationId: application.id,
          status: 'APPLIED',
          changedBy: jobSeekerId,
        },
      });

      return application;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Anda sudah melamar pekerjaan ini');
      }
      throw error;
    }
  }

  async findMyApplications(jobSeekerId: string) {
    return this.prisma.application.findMany({
      where: { jobSeekerId },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            jobType: true,
            salaryMin: true,
            salaryMax: true,
            company: { select: { id: true, companyName: true } },
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async findJobApplications(jobId: string, companyId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.companyId !== companyId) {
      throw new ForbiddenException(
        'You can only view applications for your own jobs',
      );
    }

    return this.prisma.application.findMany({
      where: { jobId },
      include: {
        jobSeeker: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async updateStatus(
    applicationId: string,
    status: ApplicationStatus,
    companyId: string,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: { select: { companyId: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.job.companyId !== companyId) {
      throw new ForbiddenException(
        'You can only update applications for your own jobs',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id: applicationId },
        data: { status },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              company: { select: { id: true, companyName: true } },
            },
          },
          jobSeeker: {
            select: { id: true, email: true, fullName: true },
          },
        },
      });

      await tx.applicationHistory.create({
        data: {
          applicationId,
          status,
          changedBy: companyId,
        },
      });

      return updated;
    });
  }

  async getHistory(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: { select: { companyId: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (
      application.jobSeekerId !== userId &&
      application.job.companyId !== userId
    ) {
      throw new ForbiddenException('You do not have access to this history');
    }

    return this.prisma.applicationHistory.findMany({
      where: { applicationId },
      orderBy: { changedAt: 'desc' },
    });
  }
}
