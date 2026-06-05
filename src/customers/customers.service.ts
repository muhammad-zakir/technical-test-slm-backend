import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Customer } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import type { AuthUser } from '../common/types/authenticated-request.interface.js';

export interface PaginatedCustomers {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(
    currentUser: AuthUser,
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedCustomers> {
    const ownershipFilter =
      currentUser.role === UserRole.ADMIN ? {} : { createdById: currentUser.id };

    const searchFilter = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const whereClause = { ...ownershipFilter, ...searchFilter };

    const [customers, total] = await Promise.all([
      this.prismaService.customer.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.customer.count({ where: whereClause }),
    ]);

    return { data: customers, total, page, limit };
  }

  async create(currentUser: AuthUser, createCustomerDto: CreateCustomerDto): Promise<Customer> {
    return this.prismaService.customer.create({
      data: {
        ...createCustomerDto,
        createdById: currentUser.id,
      },
    });
  }

  async update(
    currentUser: AuthUser,
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    const existingCustomer = await this.prismaService.customer.findUnique({ where: { id } });

    if (!existingCustomer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    if (
      currentUser.role !== UserRole.ADMIN &&
      existingCustomer.createdById !== currentUser.id
    ) {
      throw new ForbiddenException('You do not have permission to update this customer');
    }

    return this.prismaService.customer.update({
      where: { id },
      data: updateCustomerDto,
    });
  }

  async remove(currentUser: AuthUser, id: string): Promise<void> {
    const existingCustomer = await this.prismaService.customer.findUnique({ where: { id } });

    if (!existingCustomer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    if (
      currentUser.role !== UserRole.ADMIN &&
      existingCustomer.createdById !== currentUser.id
    ) {
      throw new ForbiddenException('You do not have permission to delete this customer');
    }

    await this.prismaService.customer.delete({ where: { id } });
  }
}
