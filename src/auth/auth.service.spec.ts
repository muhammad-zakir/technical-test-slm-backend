import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('signed.jwt.token'),
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('returns id, email, and role without exposing the password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'test@example.com',
        password: 'hashed-secret',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.register({
        email: 'test@example.com',
        password: 'plaintext-password',
      });

      expect(result).toEqual({
        id: 'user-uuid-1',
        email: 'test@example.com',
        role: UserRole.USER,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('throws ConflictException when the email is already registered', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-uuid',
        email: 'duplicate@example.com',
        password: 'hashed',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        authService.register({
          email: 'duplicate@example.com',
          password: 'any-password',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('always assigns the USER role regardless of any input', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-uuid-2',
        email: 'new@example.com',
        password: 'hashed',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await authService.register({
        email: 'new@example.com',
        password: 'password123',
      });

      const createCallArgument = mockPrismaService.user.create.mock.calls[0][0];
      expect(createCallArgument.data.role).toBe(UserRole.USER);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'ghost@example.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-uuid-3',
        email: 'user@example.com',
        password: hashedPassword,
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        authService.login({ email: 'user@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns an accessToken and user object (without password) on valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-uuid-4',
        email: 'user@example.com',
        password: hashedPassword,
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.login({
        email: 'user@example.com',
        password: 'correct-password',
      });

      expect(result).toHaveProperty('accessToken', 'signed.jwt.token');
      expect(result.user).toEqual({
        id: 'user-uuid-4',
        email: 'user@example.com',
        role: UserRole.USER,
      });
      expect(result.user).not.toHaveProperty('password');
    });
  });
});
