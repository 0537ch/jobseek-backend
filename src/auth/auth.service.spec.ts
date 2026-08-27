import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwt: { sign: jest.Mock };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashed-password',
    role: 'JOB_SEEKER' as const,
    fullName: 'Test User',
    companyName: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwt = { sign: jest.fn().mockReturnValue('mock-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    const dto = {
      email: 'test@example.com',
      password: 'password123',
      role: 'JOB_SEEKER' as const,
      fullName: 'Test User',
    };

    it('should register a new user and return user + token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register(dto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: dto.email,
          password: 'hashed-password',
          role: dto.role,
          fullName: dto.fullName,
          companyName: undefined,
        },
      });
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          fullName: mockUser.fullName,
          companyName: mockUser.companyName,
        },
        token: 'mock-token',
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should NOT include password in response', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register(dto);

      expect(result.user).not.toHaveProperty('password');
    });

    it('should propagate error when bcrypt.hash fails', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('hash error'));

      await expect(service.register(dto)).rejects.toThrow('hash error');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should propagate error when prisma.user.create fails', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(new Error('db error'));

      await expect(service.register(dto)).rejects.toThrow('db error');
    });

    it('should include companyName when provided', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const companyUser = {
        ...mockUser,
        role: 'COMPANY' as const,
        companyName: 'Acme Corp',
      };
      prisma.user.create.mockResolvedValue(companyUser);

      const companyDto = {
        ...dto,
        role: 'COMPANY' as const,
        companyName: 'Acme Corp',
      };
      const result = await service.register(companyDto);

      const createCall = prisma.user.create.mock.calls[0] as [
        { data: { companyName: string } },
      ];
      expect(createCall[0].data.companyName).toBe('Acme Corp');
      expect(result.user.companyName).toBe('Acme Corp');
    });
  });

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'password123' };

    it('should return user + token on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        dto.password,
        mockUser.password,
      );
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          fullName: mockUser.fullName,
          companyName: mockUser.companyName,
        },
        token: 'mock-token',
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should NOT include password in response', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result.user).not.toHaveProperty('password');
    });

    it('should propagate error when bcrypt.compare fails', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockRejectedValue(
        new Error('compare error'),
      );

      await expect(service.login(dto)).rejects.toThrow('compare error');
    });

    it('should not reveal whether user exists or password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      try {
        await service.login(dto);
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
      }

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      try {
        await service.login({ ...dto, password: 'wrong' });
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
      }
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const profile = {
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        fullName: mockUser.fullName,
        companyName: mockUser.companyName,
        createdAt: mockUser.createdAt,
      };
      prisma.user.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          email: true,
          role: true,
          fullName: true,
          companyName: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(profile);
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getProfile('nonexistent');

      expect(result).toBeNull();
    });

    it('should NOT include password in profile', async () => {
      const profileWithoutPassword = {
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        fullName: mockUser.fullName,
        companyName: mockUser.companyName,
        createdAt: mockUser.createdAt,
      };
      prisma.user.findUnique.mockResolvedValue(profileWithoutPassword);

      const result = await service.getProfile('user-1');

      expect(result).not.toHaveProperty('password');
    });
  });
});
