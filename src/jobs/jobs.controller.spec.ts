import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

describe('JobsController', () => {
  let controller: JobsController;
  let jobsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    findMyJobs: jest.Mock;
    remove: jest.Mock;
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
    company: {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      email: 'company@test.com',
      companyName: 'Test Corp',
    },
  };

  beforeEach(async () => {
    jobsService = {
      create: jest.fn().mockResolvedValue(mockJob),
      findAll: jest.fn().mockResolvedValue([mockJob]),
      findOne: jest.fn().mockResolvedValue(mockJob),
      findMyJobs: jest.fn().mockResolvedValue([mockJob]),
      remove: jest.fn().mockResolvedValue(mockJob),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [{ provide: JobsService, useValue: jobsService }],
    }).compile();

    controller = module.get(JobsController);
  });

  describe('create', () => {
    it('should call service.create with dto and companyId', async () => {
      const dto = {
        title: 'Software Engineer',
        description: 'Build great software',
        location: 'Jakarta',
        salaryMin: 5000000,
        salaryMax: 10000000,
        jobType: 'FULL_TIME' as const,
      };
      const user = { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' };

      const result = await controller.create(dto, user);

      expect(jobsService.create).toHaveBeenCalledWith(
        dto,
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );
      expect(result).toEqual(mockJob);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with filters', async () => {
      const result = await controller.findAll('Jakarta', 'FULL_TIME');

      expect(jobsService.findAll).toHaveBeenCalledWith({
        location: 'Jakarta',
        jobType: 'FULL_TIME',
      });
      expect(result).toEqual([mockJob]);
    });

    it('should call service.findAll without filters', async () => {
      const result = await controller.findAll();

      expect(jobsService.findAll).toHaveBeenCalledWith({
        location: undefined,
        jobType: undefined,
      });
      expect(result).toEqual([mockJob]);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id', async () => {
      const result = await controller.findOne(
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      );

      expect(jobsService.findOne).toHaveBeenCalledWith(
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      );
      expect(result).toEqual(mockJob);
    });
  });

  describe('findMyJobs', () => {
    it('should call service.findMyJobs with companyId', async () => {
      const user = { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' };

      const result = await controller.findMyJobs(user);

      expect(jobsService.findMyJobs).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );
      expect(result).toEqual([mockJob]);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id and companyId', async () => {
      const user = { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' };

      const result = await controller.remove(
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        user,
      );

      expect(jobsService.remove).toHaveBeenCalledWith(
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );
      expect(result).toEqual(mockJob);
    });
  });
});
