import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: {
    job: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
  };

  const mockCompany = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: 'company@test.com',
    companyName: 'Test Corp',
  };

  const mockJob = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    title: 'Software Engineer',
    description: 'Build great software',
    location: 'Jakarta',
    salaryMin: 5000000,
    salaryMax: 10000000,
    jobType: 'FULL_TIME',
    companyId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    createdAt: new Date(),
    company: mockCompany,
  };

  beforeEach(async () => {
    prisma = {
      job: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [JobsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(JobsService);
  });

  describe('create', () => {
    const dto = {
      title: 'Software Engineer',
      description: 'Build great software',
      location: 'Jakarta',
      salaryMin: 5000000,
      salaryMax: 10000000,
      jobType: 'FULL_TIME' as const,
    };

    it('should create a job and return it with company info', async () => {
      prisma.job.create.mockResolvedValue(mockJob);

      const result = await service.create(
        dto,
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );

      expect(prisma.job.create).toHaveBeenCalledWith({
        data: {
          title: dto.title,
          description: dto.description,
          location: dto.location,
          salaryMin: dto.salaryMin,
          salaryMax: dto.salaryMax,
          jobType: dto.jobType,
          companyId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
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
      expect(result).toEqual(mockJob);
    });

    it('should handle optional salary fields', async () => {
      const dtoNoSalary = {
        ...dto,
        salaryMin: undefined,
        salaryMax: undefined,
      };
      const jobNoSalary = { ...mockJob, salaryMin: null, salaryMax: null };
      prisma.job.create.mockResolvedValue(jobNoSalary);

      const result = await service.create(
        dtoNoSalary,
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );

      expect(result.salaryMin).toBeNull();
      expect(result.salaryMax).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all jobs without filters', async () => {
      prisma.job.findMany.mockResolvedValue([mockJob]);

      const result = await service.findAll();

      expect(prisma.job.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([mockJob]);
    });

    it('should filter by location (case-insensitive)', async () => {
      prisma.job.findMany.mockResolvedValue([mockJob]);

      await service.findAll({ location: 'jakarta' });

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location: { contains: 'jakarta', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by jobType', async () => {
      prisma.job.findMany.mockResolvedValue([mockJob]);

      await service.findAll({ jobType: 'FULL_TIME' });

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            jobType: 'FULL_TIME',
          }),
        }),
      );
    });

    it('should combine location and jobType filters', async () => {
      prisma.job.findMany.mockResolvedValue([mockJob]);

      await service.findAll({ location: 'Jakarta', jobType: 'FULL_TIME' });

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location: { contains: 'Jakarta', mode: 'insensitive' },
            jobType: 'FULL_TIME',
          }),
        }),
      );
    });

    it('should return empty array when no jobs match', async () => {
      prisma.job.findMany.mockResolvedValue([]);

      const result = await service.findAll({ location: 'Nonexistent' });

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return job with company info and application count', async () => {
      const jobWithCount = { ...mockJob, _count: { applications: 5 } };
      prisma.job.findUnique.mockResolvedValue(jobWithCount);

      const result = await service.findOne(
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      );

      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
        include: expect.objectContaining({
          company: { select: { id: true, email: true, companyName: true } },
          _count: { select: { applications: true } },
        }),
      });
      expect(result).toEqual(jobWithCount);
    });

    it('should throw NotFoundException if job not found', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid UUID format', async () => {
      await expect(service.findOne('not-a-uuid')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.job.findUnique).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty string', async () => {
      await expect(service.findOne('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findMyJobs', () => {
    it('should return jobs belonging to the company', async () => {
      const jobs = [{ ...mockJob, _count: { applications: 3 } }];
      prisma.job.findMany.mockResolvedValue(jobs);

      const result = await service.findMyJobs(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );

      expect(prisma.job.findMany).toHaveBeenCalledWith({
        where: { companyId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
        include: { _count: { select: { applications: true } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(jobs);
    });

    it('should return empty array if company has no jobs', async () => {
      prisma.job.findMany.mockResolvedValue([]);

      const result = await service.findMyJobs('company-no-jobs');

      expect(result).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should delete job if company owns it and no applications', async () => {
      const jobNoApps = { ...mockJob, _count: { applications: 0 } };
      prisma.job.findUnique.mockResolvedValue(jobNoApps);
      prisma.job.delete.mockResolvedValue(mockJob);

      const result = await service.remove(
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );

      expect(prisma.job.delete).toHaveBeenCalledWith({
        where: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
      });
      expect(result).toEqual(mockJob);
    });

    it('should throw NotFoundException if job not found', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(
        service.remove(
          '00000000-0000-0000-0000-000000000000',
          'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(
        service.remove('not-a-uuid', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if company does not own the job', async () => {
      const jobNoApps = { ...mockJob, _count: { applications: 0 } };
      prisma.job.findUnique.mockResolvedValue(jobNoApps);

      await expect(
        service.remove(
          'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          'b2c3d4e5-f6a7-8901-bcde-f23456789012',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if job has applications', async () => {
      const jobWithApps = { ...mockJob, _count: { applications: 5 } };
      prisma.job.findUnique.mockResolvedValue(jobWithApps);

      await expect(
        service.remove(
          'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.job.delete).not.toHaveBeenCalled();
    });
  });
});
