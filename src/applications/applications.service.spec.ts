import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prisma: {
    job: { findUnique: jest.Mock };
    application: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    applicationHistory: { create: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const companyId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const jobSeekerId = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';
  const jobId = 'c3d4e5f6-a7b8-9012-cdef-345678901234';
  const applicationId = 'd4e5f6a7-b8c9-0123-defa-456789012345';

  const mockJob = {
    id: jobId,
    title: 'Software Engineer',
    companyId,
  };

  const mockApplication = {
    id: applicationId,
    jobId,
    jobSeekerId,
    status: 'APPLIED',
    appliedAt: new Date(),
    updatedAt: new Date(),
    job: {
      id: jobId,
      title: 'Software Engineer',
      location: 'Jakarta',
      companyId,
      company: { id: companyId, companyName: 'Test Corp' },
    },
    jobSeeker: {
      id: jobSeekerId,
      email: 'seeker@test.com',
      fullName: 'Test Seeker',
    },
  };

  const mockHistory = {
    id: 'history-1',
    applicationId,
    status: 'APPLIED',
    changedBy: jobSeekerId,
    changedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      job: { findUnique: jest.fn() },
      application: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      applicationHistory: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ApplicationsService);
  });

  describe('apply', () => {
    it('should create application and history record', async () => {
      prisma.job.findUnique.mockResolvedValue(mockJob);
      prisma.application.create.mockResolvedValue(mockApplication);
      prisma.applicationHistory.create.mockResolvedValue(mockHistory);

      const result = await service.apply(jobId, jobSeekerId);

      expect(prisma.application.create).toHaveBeenCalled();
      expect(prisma.applicationHistory.create).toHaveBeenCalledWith({
        data: {
          applicationId: mockApplication.id,
          status: 'APPLIED',
          changedBy: jobSeekerId,
        },
      });
      expect(result).toEqual(mockApplication);
    });

    it('should throw NotFoundException if job not found', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(service.apply('nonexistent', jobSeekerId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if applying to own job', async () => {
      prisma.job.findUnique.mockResolvedValue(mockJob);

      await expect(service.apply(jobId, companyId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException on duplicate apply (P2002)', async () => {
      prisma.job.findUnique.mockResolvedValue(mockJob);
      const p2002Error = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      prisma.application.create.mockRejectedValue(p2002Error);

      await expect(service.apply(jobId, jobSeekerId)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.applicationHistory.create).not.toHaveBeenCalled();
    });

    it('should re-throw non-P2002 errors', async () => {
      prisma.job.findUnique.mockResolvedValue(mockJob);
      prisma.application.create.mockRejectedValue(new Error('DB error'));

      await expect(service.apply(jobId, jobSeekerId)).rejects.toThrow(
        'DB error',
      );
    });
  });

  describe('findMyApplications', () => {
    it('should return applications for job seeker', async () => {
      prisma.application.findMany.mockResolvedValue([mockApplication]);

      const result = await service.findMyApplications(jobSeekerId);

      expect(prisma.application.findMany).toHaveBeenCalledWith({
        where: { jobSeekerId },
        include: expect.objectContaining({
          job: expect.any(Object),
        }),
        orderBy: { appliedAt: 'desc' },
      });
      expect(result).toEqual([mockApplication]);
    });

    it('should return empty array if no applications', async () => {
      prisma.application.findMany.mockResolvedValue([]);

      const result = await service.findMyApplications(jobSeekerId);

      expect(result).toEqual([]);
    });
  });

  describe('findJobApplications', () => {
    it('should return applications for a company job', async () => {
      prisma.job.findUnique.mockResolvedValue(mockJob);
      prisma.application.findMany.mockResolvedValue([mockApplication]);

      const result = await service.findJobApplications(jobId, companyId);

      expect(prisma.application.findMany).toHaveBeenCalledWith({
        where: { jobId },
        include: expect.objectContaining({
          jobSeeker: expect.any(Object),
        }),
        orderBy: { appliedAt: 'desc' },
      });
      expect(result).toEqual([mockApplication]);
    });

    it('should throw NotFoundException if job not found', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(
        service.findJobApplications('nonexistent', companyId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if job belongs to another company', async () => {
      prisma.job.findUnique.mockResolvedValue(mockJob);

      await expect(
        service.findJobApplications(jobId, 'other-company-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus', () => {
    const mockTx = {
      application: { update: jest.fn() },
      applicationHistory: { create: jest.fn() },
    };

    beforeEach(() => {
      prisma.$transaction.mockImplementation((fn: unknown) => {
        if (typeof fn === 'function') {
          return fn(mockTx);
        }
        return fn;
      });
      mockTx.application.update.mockResolvedValue({
        ...mockApplication,
        status: 'REVIEWING',
      });
      mockTx.applicationHistory.create.mockResolvedValue(mockHistory);
    });

    it('should update status and create history in transaction', async () => {
      prisma.application.findUnique.mockResolvedValue(mockApplication);

      const result = await service.updateStatus(
        applicationId,
        'REVIEWING',
        companyId,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.application.update).toHaveBeenCalledWith({
        where: { id: applicationId },
        data: { status: 'REVIEWING' },
        include: expect.any(Object),
      });
      expect(mockTx.applicationHistory.create).toHaveBeenCalledWith({
        data: {
          applicationId,
          status: 'REVIEWING',
          changedBy: companyId,
        },
      });
      expect(result.status).toBe('REVIEWING');
    });

    it('should throw NotFoundException if application not found', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(applicationId, 'REVIEWING', companyId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not job owner', async () => {
      prisma.application.findUnique.mockResolvedValue(mockApplication);

      await expect(
        service.updateStatus(applicationId, 'REVIEWING', 'other-company'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getHistory', () => {
    it('should return history for job seeker who owns application', async () => {
      prisma.application.findUnique.mockResolvedValue(mockApplication);
      prisma.applicationHistory.findMany.mockResolvedValue([mockHistory]);

      const result = await service.getHistory(applicationId, jobSeekerId);

      expect(prisma.applicationHistory.findMany).toHaveBeenCalledWith({
        where: { applicationId },
        orderBy: { changedAt: 'desc' },
      });
      expect(result).toEqual([mockHistory]);
    });

    it('should return history for company who owns the job', async () => {
      prisma.application.findUnique.mockResolvedValue(mockApplication);
      prisma.applicationHistory.findMany.mockResolvedValue([mockHistory]);

      const result = await service.getHistory(applicationId, companyId);

      expect(result).toEqual([mockHistory]);
    });

    it('should throw NotFoundException if application not found', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(
        service.getHistory('nonexistent', jobSeekerId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      prisma.application.findUnique.mockResolvedValue(mockApplication);

      await expect(
        service.getHistory(applicationId, 'unauthorized-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
