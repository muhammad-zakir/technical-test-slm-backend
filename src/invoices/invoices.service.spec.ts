import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Captures the transaction callback so we can control the transactionClient mock
let capturedTransactionCallback: ((transactionClient: unknown) => Promise<unknown>) | null = null;

const mockTransactionClient = {
  invoice: {
    count: jest.fn(),
    create: jest.fn(),
  },
};

const mockPrismaService = {
  $transaction: jest.fn((callback: (client: unknown) => Promise<unknown>) => {
    capturedTransactionCallback = callback;
    return callback(mockTransactionClient);
  }),
  invoice: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
};

describe('InvoicesService', () => {
  let invoicesService: InvoicesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedTransactionCallback = null;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    invoicesService = moduleRef.get<InvoicesService>(InvoicesService);
  });

  describe('create — invoice number generation', () => {
    const baseCreateDto = {
      customerId: 'customer-uuid',
      dueDate: '2025-12-31',
      items: [{ description: 'Widget', quantity: 2, unitPrice: 49.99 }],
    };

    const mockCreatedInvoice = {
      id: 'invoice-uuid-1',
      invoiceNumber: 'INV-20250101-0001',
      status: InvoiceStatus.DRAFT,
      customerId: 'customer-uuid',
      customer: { id: 'customer-uuid', name: 'Acme Corp' },
      createdById: 'user-uuid',
      items: [{ id: 'item-uuid', description: 'Widget', quantity: 2, unitPrice: 49.99 }],
      issueDate: new Date(),
      dueDate: new Date('2025-12-31'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('generates INV-YYYYMMDD-0001 when no invoices exist today', async () => {
      mockTransactionClient.invoice.count.mockResolvedValue(0);
      mockTransactionClient.invoice.create.mockResolvedValue(mockCreatedInvoice);

      await invoicesService.create(baseCreateDto, 'user-uuid');

      const createCallArgument = mockTransactionClient.invoice.create.mock.calls[0][0];
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      expect(createCallArgument.data.invoiceNumber).toBe(`INV-${year}${month}${day}-0001`);
    });

    it('generates the correct sequential number when 2 invoices already exist today', async () => {
      mockTransactionClient.invoice.count.mockResolvedValue(2);
      mockTransactionClient.invoice.create.mockResolvedValue({
        ...mockCreatedInvoice,
        invoiceNumber: 'INV-20250101-0003',
      });

      await invoicesService.create(baseCreateDto, 'user-uuid');

      const createCallArgument = mockTransactionClient.invoice.create.mock.calls[0][0];
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      expect(createCallArgument.data.invoiceNumber).toBe(`INV-${year}${month}${day}-0003`);
    });

    it('passes all items to the transaction create call', async () => {
      const dtoWithMultipleItems = {
        customerId: 'customer-uuid',
        dueDate: '2025-12-31',
        items: [
          { description: 'Widget', quantity: 2, unitPrice: 49.99 },
          { description: 'Gadget', quantity: 1, unitPrice: 99.00 },
        ],
      };

      mockTransactionClient.invoice.count.mockResolvedValue(0);
      mockTransactionClient.invoice.create.mockResolvedValue(mockCreatedInvoice);

      await invoicesService.create(dtoWithMultipleItems, 'user-uuid');

      const createCallArgument = mockTransactionClient.invoice.create.mock.calls[0][0];
      expect(createCallArgument.data.items.create).toHaveLength(2);
      expect(createCallArgument.data.items.create[0].description).toBe('Widget');
      expect(createCallArgument.data.items.create[1].description).toBe('Gadget');
    });
  });

  describe('findOne', () => {
    const adminUser = { id: 'admin-uuid', email: 'admin@example.com', role: 'ADMIN' as const };
    const ownerUser = { id: 'user-uuid', email: 'user@example.com', role: 'USER' as const };
    const otherUser = { id: 'other-uuid', email: 'other@example.com', role: 'USER' as const };

    it('throws NotFoundException when the invoice does not exist', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(
        invoicesService.findOne(adminUser, 'nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the invoice when found and user is the owner', async () => {
      const mockInvoice = {
        id: 'invoice-uuid-1',
        invoiceNumber: 'INV-20250101-0001',
        status: InvoiceStatus.DRAFT,
        createdById: ownerUser.id,
        items: [],
        customer: { id: 'customer-uuid', name: 'Acme Corp' },
        createdBy: { id: ownerUser.id, email: ownerUser.email },
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await invoicesService.findOne(ownerUser, 'invoice-uuid-1');
      expect(result).toEqual(mockInvoice);
    });

    it('returns the invoice when found and user is ADMIN', async () => {
      const mockInvoice = {
        id: 'invoice-uuid-1',
        invoiceNumber: 'INV-20250101-0001',
        status: InvoiceStatus.DRAFT,
        createdById: ownerUser.id,
        items: [],
        customer: { id: 'customer-uuid', name: 'Acme Corp' },
        createdBy: { id: ownerUser.id, email: ownerUser.email },
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await invoicesService.findOne(adminUser, 'invoice-uuid-1');
      expect(result).toEqual(mockInvoice);
    });

    it('throws ForbiddenException when USER tries to access another user invoice', async () => {
      const mockInvoice = {
        id: 'invoice-uuid-1',
        invoiceNumber: 'INV-20250101-0001',
        status: InvoiceStatus.DRAFT,
        createdById: ownerUser.id,
        items: [],
        customer: { id: 'customer-uuid', name: 'Acme Corp' },
        createdBy: { id: ownerUser.id, email: ownerUser.email },
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(
        invoicesService.findOne(otherUser, 'invoice-uuid-1'),
      ).rejects.toThrow('You do not have permission to view this invoice');
    });
  });
});
