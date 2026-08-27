import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '.prisma/client';

export class UpdateStatusDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}
