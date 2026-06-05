import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './public.decorator.js';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/authenticated-request.interface.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<{ id: string; email: string; role: UserRole }> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<{ accessToken: string; user: { id: string; email: string; role: UserRole } }> {
    return this.authService.login(loginDto);
  }

  @Get('me')
  async getMe(@CurrentUser() currentUser: AuthUser): Promise<{ id: string; email: string; role: UserRole; createdAt: Date; updatedAt: Date }> {
    return this.authService.getMe(currentUser.id);
  }
}
