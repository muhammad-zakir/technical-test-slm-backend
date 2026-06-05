import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { InvoicesService, PaginatedInvoices } from './invoices.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto.js';
import { InvoiceQueryDto } from './dto/invoice-query.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/authenticated-request.interface.js';
import type { Prisma } from '@prisma/client';

type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: { items: true; customer: true } }>;
type InvoiceWithFull = Prisma.InvoiceGetPayload<{ include: { items: true; customer: true; createdBy: { select: { id: true; email: true; role: true; createdAt: true; updatedAt: true } } } }>;

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentUser() currentUser: AuthUser,
  ): Promise<InvoiceWithItems> {
    return this.invoicesService.create(createInvoiceDto, currentUser.id);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of invoices' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: InvoiceQueryDto,
  ): Promise<PaginatedInvoices> {
    return this.invoicesService.findAll(currentUser, query.status, query.customerId, query.page, query.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single invoice by ID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'Invoice details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findOne(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
  ): Promise<InvoiceWithFull> {
    return this.invoicesService.findOne(currentUser, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update the status of an invoice' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'Invoice status updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async updateStatus(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
    @Body() updateInvoiceStatusDto: UpdateInvoiceStatusDto,
  ): Promise<InvoiceWithItems> {
    return this.invoicesService.updateStatus(currentUser, id, updateInvoiceStatusDto);
  }
}
