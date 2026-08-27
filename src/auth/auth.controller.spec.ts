import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    getProfile: jest.Mock;
  };

  const mockResponse = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      role: 'JOB_SEEKER',
      fullName: 'Test User',
      companyName: null,
    },
    token: 'mock-token',
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn().mockResolvedValue(mockResponse),
      login: jest.fn().mockResolvedValue(mockResponse),
      getProfile: jest.fn().mockResolvedValue(mockResponse.user),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('register', () => {
    it('should call authService.register with dto', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'password123',
        role: 'JOB_SEEKER' as const,
        fullName: 'Test User',
      };

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('login', () => {
    it('should call authService.login with dto', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getProfile', () => {
    it('should call authService.getProfile with user id', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'JOB_SEEKER',
      };

      const result = await controller.getProfile(user);

      expect(authService.getProfile).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockResponse.user);
    });
  });
});
