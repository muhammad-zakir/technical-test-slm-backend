import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { InvoiceStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto.js';
import type { AuthUser } from '../common/types/authenticated-request.interface.js';

type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: { items: true; customer: true } }>;
type InvoiceWithFull = Prisma.InvoiceGetPayload<{ include: { items: true; customer: true; createdBy: { select: { id: true; email: true; role: true; createdAt: true; updatedAt: true } } } }>;

export interface PaginatedInvoices {
  data: InvoiceWithItems[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createInvoiceDto: CreateInvoiceDto, userId: string): Promise<InvoiceWithItems> {
    const invoice = await this.prismaService.$transaction(async (transactionClient) => {
      const issueDate = new Date();
      const dayStart = new Date(issueDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(issueDate);
      dayEnd.setHours(23, 59, 59, 999);

      const invoiceCountToday = await transactionClient.invoice.count({
        where: {
          issueDate: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });

      const sequentialNumber = String(invoiceCountToday + 1).padStart(4, '0');
      const year = issueDate.getFullYear();
      const month = String(issueDate.getMonth() + 1).padStart(2, '0');
      const day = String(issueDate.getDate()).padStart(2, '0');
      const invoiceNumber = `INV-${year}${month}${day}-${sequentialNumber}`;

      return transactionClient.invoice.create({
        data: {
          invoiceNumber,
          dueDate: new Date(createInvoiceDto.dueDate),
          customerId: createInvoiceDto.customerId,
          createdById: userId,
          items: {
            create: createInvoiceDto.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });
    });

    return invoice;
  }

  async findAll(
    currentUser: AuthUser,
    status: InvoiceStatus | undefined,
    customerId: string | undefined,
    page: number,
    limit: number,
  ): Promise<{ data: InvoiceWithItems[]; total: number; page: number; limit: number }> {
    const ownershipFilter =
      currentUser.role === UserRole.ADMIN ? {} : { createdById: currentUser.id };

    const whereClause: Prisma.InvoiceWhereInput = { ...ownershipFilter };

    if (status) {
      whereClause.status = status;
    }

    if (customerId) {
      whereClause.customerId = customerId;
    }

    const [invoices, total] = await Promise.all([
      this.prismaService.invoice.findMany({
        where: whereClause,
        include: {
          items: true,
          customer: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.invoice.count({ where: whereClause }),
    ]);

    return { data: invoices, total, page, limit };
  }

  async findOne(currentUser: AuthUser, id: string): Promise<InvoiceWithFull> {
    const invoice = await this.prismaService.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        customer: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with id ${id} not found`);
    }

    if (currentUser.role !== UserRole.ADMIN && invoice.createdById !== currentUser.id) {
      throw new ForbiddenException('You do not have permission to view this invoice');
    }

    return invoice;
  }

  async updateStatus(
    currentUser: AuthUser,
    id: string,
    updateInvoiceStatusDto: UpdateInvoiceStatusDto,
  ): Promise<InvoiceWithItems> {
    const existingInvoice = await this.prismaService.invoice.findUnique({ where: { id } });

    if (!existingInvoice) {
      throw new NotFoundException(`Invoice with id ${id} not found`);
    }

    if (currentUser.role !== UserRole.ADMIN && existingInvoice.createdById !== currentUser.id) {
      throw new ForbiddenException('You do not have permission to update this invoice');
    }

    return this.prismaService.invoice.update({
      where: { id },
      data: { status: updateInvoiceStatusDto.status },
      include: {
        items: true,
        customer: true,
      },
    });
  }
}
