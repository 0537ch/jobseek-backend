import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { JobType } from '.prisma/client';

@ValidatorConstraint({ name: 'SalaryRangeUpdate', async: false })
export class SalaryRangeUpdateConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, validationArguments?: ValidationArguments) {
    const obj = validationArguments?.object as Record<string, unknown>;
    if (!obj) return true;
    const salaryMin = obj.salaryMin as number | undefined;
    const salaryMax = obj.salaryMax as number | undefined;
    if (salaryMin !== undefined && salaryMax !== undefined) {
      return salaryMin <= salaryMax;
    }
    return true;
  }

  defaultMessage() {
    return 'salaryMin must be less than or equal to salaryMax';
  }
}

export class UpdateJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  location?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  salaryMin?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  salaryMax?: number;

  @Validate(SalaryRangeUpdateConstraint)
  salaryRange?: unknown;

  @IsEnum(JobType)
  @IsOptional()
  jobType?: JobType;
}
