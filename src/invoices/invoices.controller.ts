import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InvoicesService, PaginatedInvoices } from './invoices.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto.js';
import { InvoiceQueryDto } from './dto/invoice-query.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/authenticated-request.interface.js';
import type { Prisma } from '@prisma/client';

type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: { items: true; customer: true } }>;
type InvoiceWithFull = Prisma.InvoiceGetPayload<{ include: { items: true; customer: true; createdBy: { select: { id: true; email: true; role: true; createdAt: true; updatedAt: true } } } }>;

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  async create(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentUser() currentUser: AuthUser,
  ): Promise<InvoiceWithItems> {
    return this.invoicesService.create(createInvoiceDto, currentUser.id);
  }

  @Get()
  async findAll(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: InvoiceQueryDto,
  ): Promise<PaginatedInvoices> {
    return this.invoicesService.findAll(currentUser, query.status, query.customerId, query.page, query.limit);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
  ): Promise<InvoiceWithFull> {
    return this.invoicesService.findOne(currentUser, id);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
    @Body() updateInvoiceStatusDto: UpdateInvoiceStatusDto,
  ): Promise<InvoiceWithItems> {
    return this.invoicesService.updateStatus(currentUser, id, updateInvoiceStatusDto);
  }
}
