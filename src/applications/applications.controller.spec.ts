import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;
  let applicationsService: {
    apply: jest.Mock;
    findMyApplications: jest.Mock;
    findJobApplications: jest.Mock;
    updateStatus: jest.Mock;
    getHistory: jest.Mock;
  };

  const mockResult = { id: 'app-1', status: 'APPLIED' };

  beforeEach(async () => {
    applicationsService = {
      apply: jest.fn().mockResolvedValue(mockResult),
      findMyApplications: jest.fn().mockResolvedValue([mockResult]),
      findJobApplications: jest.fn().mockResolvedValue([mockResult]),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ ...mockResult, status: 'REVIEWING' }),
      getHistory: jest.fn().mockResolvedValue([mockResult]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        { provide: ApplicationsService, useValue: applicationsService },
      ],
    }).compile();

    controller = module.get(ApplicationsController);
  });

  describe('apply', () => {
    it('should call service.apply with jobId and userId', async () => {
      const user = { id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012' };

      const result = await controller.apply(
        'c3d4e5f6-a7b8-9012-cdef-345678901234',
        user,
      );

      expect(applicationsService.apply).toHaveBeenCalledWith(
        'c3d4e5f6-a7b8-9012-cdef-345678901234',
        'b2c3d4e5-f6a7-8901-bcde-f23456789012',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('findMyApplications', () => {
    it('should call service.findMyApplications with userId', async () => {
      const user = { id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012' };

      const result = await controller.findMyApplications(user);

      expect(applicationsService.findMyApplications).toHaveBeenCalledWith(
        'b2c3d4e5-f6a7-8901-bcde-f23456789012',
      );
      expect(result).toEqual([mockResult]);
    });
  });

  describe('findJobApplications', () => {
    it('should call service.findJobApplications with jobId and companyId', async () => {
      const user = { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' };

      const result = await controller.findJobApplications(
        'c3d4e5f6-a7b8-9012-cdef-345678901234',
        user,
      );

      expect(applicationsService.findJobApplications).toHaveBeenCalledWith(
        'c3d4e5f6-a7b8-9012-cdef-345678901234',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );
      expect(result).toEqual([mockResult]);
    });
  });

  describe('updateStatus', () => {
    it('should call service.updateStatus with id, status, and companyId', async () => {
      const user = { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' };
      const dto = { status: 'REVIEWING' as const };

      const result = await controller.updateStatus('app-1', dto, user);

      expect(applicationsService.updateStatus).toHaveBeenCalledWith(
        'app-1',
        'REVIEWING',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );
      expect(result.status).toBe('REVIEWING');
    });
  });

  describe('getHistory', () => {
    it('should call service.getHistory with id and userId', async () => {
      const user = { id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012' };

      const result = await controller.getHistory('app-1', user);

      expect(applicationsService.getHistory).toHaveBeenCalledWith(
        'app-1',
        'b2c3d4e5-f6a7-8901-bcde-f23456789012',
      );
      expect(result).toEqual([mockResult]);
    });
  });
});
