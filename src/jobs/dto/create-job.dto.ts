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

@ValidatorConstraint({ name: 'SalaryRange', async: false })
export class SalaryRangeConstraint implements ValidatorConstraintInterface {
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

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  salaryMin?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  salaryMax?: number;

  @Validate(SalaryRangeConstraint)
  salaryRange?: unknown;

  @IsEnum(JobType)
  jobType!: JobType;
}
