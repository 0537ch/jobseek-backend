import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: jest.Mock } };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashed-password',
    role: 'JOB_SEEKER',
    fullName: 'Test User',
    companyName: null,
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } };
    mockConfig.get.mockReturnValue('test-secret');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  describe('validate', () => {
    const payload = {
      sub: 'user-1',
      email: 'test@example.com',
      role: 'JOB_SEEKER',
    };

    it('should return user without password when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: payload.sub },
      });
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        fullName: mockUser.fullName,
        companyName: mockUser.companyName,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should never return password field', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).not.toHaveProperty('password');
      expect(Object.keys(result)).not.toContain('password');
    });
  });
});
