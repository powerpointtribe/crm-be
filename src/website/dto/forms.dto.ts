import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidateNested,
  ValidationOptions,
} from 'class-validator';
import { SubscriptionList } from '../schemas/web-form-submission.schema';
import { lagosDate } from '../utils/lagos-date.util';

/*
 * Public website form bodies. Names: trimmed, 1-60. Phones: any common format,
 * whitespace/dashes/brackets removed. Unknown keys are stripped (global pipe).
 */

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === ''
    ? undefined
    : trim({ value });
const phone = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[\s().-]/g, '') : value;

const PHONE = /^\+?[0-9]{7,15}$/;
const PHONE_MSG = { message: 'Enter a valid phone number.' };
const SLUG = /^[a-z0-9-]{1,60}$/;

/** `YYYY-MM-DD`, a real date, from today (Africa/Lagos) up to `maxDays` ahead. */
export function IsUpcomingLagosDate(
  maxDays: number,
  options?: ValidationOptions,
) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isUpcomingLagosDate',
      target: object.constructor,
      propertyName,
      options: {
        message: `Choose a date between today and ${maxDays} days from now.`,
        ...options,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return false;
          }
          const d = new Date(`${value}T00:00:00Z`);
          if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
            return false;
          }
          return value >= lagosDate(0) && value <= lagosDate(maxDays);
        },
      },
    });
}

export class UtmDto {
  @IsOptional() @IsString() @MaxLength(100) source?: string;
  @IsOptional() @IsString() @MaxLength(100) medium?: string;
  @IsOptional() @IsString() @MaxLength(100) campaign?: string;
  @IsOptional() @IsString() @MaxLength(100) term?: string;
  @IsOptional() @IsString() @MaxLength(100) content?: string;
}

export class FormSourceDto {
  @ApiPropertyOptional({ example: '/visit' })
  @IsOptional()
  @IsString()
  @Matches(/^\//, { message: 'page must start with /' })
  @MaxLength(200)
  page?: string;

  @ApiPropertyOptional({ type: UtmDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UtmDto)
  utm?: UtmDto;
}

/** Fields every public form accepts. */
class PublicFormBase {
  @ApiPropertyOptional({ description: 'Honeypot: leave empty' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional({ type: FormSourceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FormSourceDto)
  source?: FormSourceDto;
}

class PersonNameFields extends PublicFormBase {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName: string;
}

export class VisitFormDto extends PersonNameFields {
  @ApiProperty({
    example: '0803 000 0000',
    description: 'Required: the visit becomes a CRM first-timer',
  })
  @Transform(phone)
  @IsString()
  @Matches(PHONE, PHONE_MSG)
  phone: string;

  @ApiPropertyOptional({ description: 'Gets a confirmation email when given' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Transform(lower)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email?: string;

  @ApiProperty({ description: 'Campus (branch) slug', example: 'ppt-anthony' })
  @Matches(SLUG, { message: 'Choose a campus.' })
  branch: string;

  @ApiProperty({
    example: '2026-11-29',
    description: 'Today up to 120 days ahead (Lagos time)',
  })
  @IsUpcomingLagosDate(120)
  visitDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PartnerFormDto extends PersonNameFields {
  @ApiProperty()
  @Transform(phone)
  @IsString()
  @Matches(PHONE, PHONE_MSG)
  phone: string;

  @ApiProperty()
  @Transform(lower)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'ppt-anthony' })
  @Matches(SLUG, { message: 'Choose a campus.' })
  branch: string;

  @ApiProperty({
    description: 'Monthly pledge in Naira (major units)',
    minimum: 100,
    maximum: 10_000_000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10_000_000)
  monthlyAmount: number;

  @ApiProperty({ enum: ['transfer', 'online'] })
  @IsIn(['transfer', 'online'])
  method: 'transfer' | 'online';
}

export const CARE_KINDS = [
  'clothes',
  'shoes',
  'bags',
  'kids',
  'other',
] as const;

export class CareDropoffFormDto extends PublicFormBase {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiProperty()
  @Transform(phone)
  @IsString()
  @Matches(PHONE, PHONE_MSG)
  phone: string;

  @ApiProperty({ enum: CARE_KINDS, isArray: true })
  @IsArray()
  @ArrayMinSize(1, { message: 'Choose what you are bringing.' })
  @ArrayMaxSize(CARE_KINDS.length)
  @ArrayUnique()
  @IsIn(CARE_KINDS, { each: true })
  kinds: (typeof CARE_KINDS)[number][];

  @ApiProperty({ example: 'ppt-anthony' })
  @Matches(SLUG, { message: 'Choose a campus.' })
  branch: string;

  @ApiProperty({ example: '2026-11-29' })
  @IsUpcomingLagosDate(60)
  dropoffDate: string;
}

export class DcInterestFormDto extends PersonNameFields {
  @ApiProperty()
  @Transform(phone)
  @IsString()
  @Matches(PHONE, PHONE_MSG)
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @Transform(lower)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email?: string;

  @ApiProperty({ example: 'ppt-anthony' })
  @Matches(SLUG, { message: 'Choose a campus.' })
  branch: string;

  @ApiPropertyOptional({ description: 'The unit they would like to serve in' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(80)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class EventNotifyFormDto extends PublicFormBase {
  @ApiProperty()
  @Transform(lower)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({
    description: 'Event slug, if they asked about one event',
  })
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,100}$/)
  event?: string;
}

export class SubscribeDto extends PublicFormBase {
  @ApiProperty({ enum: SubscriptionList })
  @IsEnum(SubscriptionList)
  list: SubscriptionList;

  @ApiProperty({ description: 'An email address, or a WhatsApp number' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  contact: string;
}
