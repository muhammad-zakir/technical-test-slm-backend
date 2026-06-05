import { Injectable } from '@nestjs/common';
import { Prisma, InvoiceStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/types/authenticated-request.interface.js';

type InvoiceWithItemsAndCustomer = Prisma.InvoiceGetPayload<{ include: { items: true; customer: { select: { id: true; name: true } } } }>;

export interface DashboardSummary {
  totalRevenue: number;
  pendingAmount: number;
  unpaidInvoiceCount: number;
  totalCustomers: number;
  totalInvoices: number;
  recentInvoices: InvoiceWithItemsAndCustomer[];
}

@Injectable()
export class DashboardService {
  constructor(private readonly prismaService: PrismaService) {}

  async getSummary(currentUser: AuthUser): Promise<DashboardSummary> {
    const isAdmin = currentUser.role === UserRole.ADMIN;

    // Prisma.empty is a no-op fragment — used to conditionally add a WHERE clause to raw SQL
    const ownershipCondition = isAdmin
      ? Prisma.empty
      : Prisma.sql`AND i."createdById" = ${currentUser.id}`;

    const invoiceOwnershipWhere = isAdmin ? {} : { createdById: currentUser.id };
    const customerOwnershipWhere = isAdmin ? {} : { createdById: currentUser.id };

    const [
      revenueAggregation,
      unpaidInvoiceCount,
      totalCustomers,
      totalInvoices,
      recentInvoices,
    ] = await Promise.all([
      this.prismaService.$queryRaw<Array<{ status: string; total: number }>>`
        SELECT
          i.status,
          COALESCE(SUM(ii.quantity * ii."unitPrice"), 0) AS total
        FROM "Invoice" i
        LEFT JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
        WHERE i.status IN ('PAID', 'SENT', 'OVERDUE')
        ${ownershipCondition}
        GROUP BY i.status
      `,
      this.prismaService.invoice.count({
        where: {
          ...invoiceOwnershipWhere,
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
        },
      }),
      this.prismaService.customer.count({ where: customerOwnershipWhere }),
      this.prismaService.invoice.count({ where: invoiceOwnershipWhere }),
      this.prismaService.invoice.findMany({
        where: invoiceOwnershipWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          customer: {
            select: { name: true, id: true },
          },
        },
      }),
    ]);

    const totalRevenue = revenueAggregation
      .filter((row) => row.status === 'PAID')
      .reduce((accumulator, row) => accumulator + Number(row.total), 0);

    const pendingAmount = revenueAggregation
      .filter((row) => row.status === 'SENT' || row.status === 'OVERDUE')
      .reduce((accumulator, row) => accumulator + Number(row.total), 0);

    return {
      totalRevenue,
      pendingAmount,
      unpaidInvoiceCount,
      totalCustomers,
      totalInvoices,
      recentInvoices,
    };
  }
}
