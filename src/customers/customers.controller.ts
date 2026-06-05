import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Customer } from '@prisma/client';
import { CustomersService, PaginatedCustomers } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { CustomerQueryDto } from './dto/customer-query.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/authenticated-request.interface.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async findAll(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: CustomerQueryDto,
  ): Promise<PaginatedCustomers> {
    return this.customersService.findAll(currentUser, query.search, query.page, query.limit);
  }

  @Post()
  async create(
    @CurrentUser() currentUser: AuthUser,
    @Body() createCustomerDto: CreateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.create(currentUser, createCustomerDto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.update(currentUser, id, updateCustomerDto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.customersService.remove(currentUser, id);
  }
}
