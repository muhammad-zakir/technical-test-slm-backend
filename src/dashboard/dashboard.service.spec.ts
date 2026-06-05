import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const mockPrismaService = {
  $queryRaw: jest.fn(),
  invoice: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  customer: {
    count: jest.fn(),
  },
};

const adminUser = { id: 'admin-uuid', email: 'admin@example.com', role: 'ADMIN' as const };

describe('DashboardService', () => {
  let dashboardService: DashboardService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    dashboardService = moduleRef.get<DashboardService>(DashboardService);
  });

  function setupMocks({
    revenueRows,
    unpaidCount,
    customerCount,
    invoiceCount,
  }: {
    revenueRows: Array<{ status: string; total: number }>;
    unpaidCount: number;
    customerCount: number;
    invoiceCount: number;
  }): void {
    mockPrismaService.$queryRaw.mockResolvedValue(revenueRows);
    mockPrismaService.invoice.count.mockResolvedValue(unpaidCount);
    mockPrismaService.customer.count.mockResolvedValue(customerCount);
    mockPrismaService.invoice.findMany.mockResolvedValue([]);
    // invoice.count is called twice via Promise.all — once for unpaid, once for total
    // We override for the total call separately below
  }

  describe('getSummary — revenue aggregation', () => {
    it('computes totalRevenue only from PAID invoices', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([
        { status: 'PAID', total: 500.00 },
        { status: 'SENT', total: 200.00 },
        { status: 'OVERDUE', total: 100.00 },
      ]);
      mockPrismaService.invoice.count.mockResolvedValue(3);
      mockPrismaService.customer.count.mockResolvedValue(2);
      mockPrismaService.invoice.findMany.mockResolvedValue([]);

      const result = await dashboardService.getSummary(adminUser);

      expect(result.totalRevenue).toBe(500.00);
    });

    it('computes pendingAmount from SENT and OVERDUE invoices, excluding PAID', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([
        { status: 'PAID', total: 1000.00 },
        { status: 'SENT', total: 300.00 },
        { status: 'OVERDUE', total: 150.00 },
      ]);
      mockPrismaService.invoice.count.mockResolvedValue(2);
      mockPrismaService.customer.count.mockResolvedValue(5);
      mockPrismaService.invoice.findMany.mockResolvedValue([]);

      const result = await dashboardService.getSummary(adminUser);

      expect(result.pendingAmount).toBe(450.00);
      // PAID must not be included in pendingAmount
      expect(result.pendingAmount).not.toBe(1450.00);
    });

    it('returns zero for totalRevenue and pendingAmount when no invoices exist', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.customer.count.mockResolvedValue(0);
      mockPrismaService.invoice.findMany.mockResolvedValue([]);

      const result = await dashboardService.getSummary(adminUser);

      expect(result.totalRevenue).toBe(0);
      expect(result.pendingAmount).toBe(0);
      expect(result.unpaidInvoiceCount).toBe(0);
    });

    it('returns totals correctly when only PAID invoices exist', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([
        { status: 'PAID', total: 750.00 },
      ]);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.customer.count.mockResolvedValue(3);
      mockPrismaService.invoice.findMany.mockResolvedValue([]);

      const result = await dashboardService.getSummary(adminUser);

      expect(result.totalRevenue).toBe(750.00);
      expect(result.pendingAmount).toBe(0);
    });
  });
});
