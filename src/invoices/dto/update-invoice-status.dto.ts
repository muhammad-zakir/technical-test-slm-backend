import { IsEnum } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateInvoiceStatusDto {
  @ApiProperty({ enum: InvoiceStatus, example: InvoiceStatus.PAID })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;
}
