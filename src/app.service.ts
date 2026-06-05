import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prismaService: PrismaService) {}

  async checkDatabaseHealth(): Promise<{ status: string; database: string; timestamp?: string; error?: string }> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'error', database: 'disconnected', error: errorMessage };
    }
  }
}
