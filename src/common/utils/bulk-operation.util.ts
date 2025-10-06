import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  BulkOperationResult,
  BulkOperationOptions,
  BulkOperationType,
  CSVMappingConfig,
  BulkValidationResult,
} from '../interfaces/bulk-operation.interface';
import { CSVParserUtil } from './csv-parser.util';

export class BulkOperationUtil {
  static async processBulkOperation<TDto, TEntity>(
    csvContent: string,
    dtoClass: new () => TDto,
    csvMappingConfig: CSVMappingConfig,
    createFn: (dto: TDto) => Promise<TEntity>,
    updateFn: (identifier: any, dto: Partial<TDto>) => Promise<TEntity>,
    findFn: (identifier: any) => Promise<TEntity | null>,
    options: BulkOperationOptions,
  ): Promise<BulkOperationResult<TEntity>> {
    const {
      skipErrors = false,
      operationType,
      identifierField = 'email',
      defaultValues = {},
      dryRun = false,
    } = options;

    // Parse CSV content
    let csvData: any[];
    try {
      csvData = CSVParserUtil.parseCSV(csvContent, {
        headerRow: true,
        skipEmptyLines: true,
      });
    } catch (error) {
      throw new BadRequestException(`CSV parsing failed: ${error.message}`);
    }

    if (csvData.length === 0) {
      throw new BadRequestException('No valid data found in CSV file');
    }

    const result: BulkOperationResult<TEntity> = {
      successCount: 0,
      errorCount: 0,
      totalCount: csvData.length,
      successfulRecords: [],
      failedRecords: [],
      message: '',
      operationType,
    };

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNumber = i + 2; // +2 because array is 0-indexed and first row is header

      try {
        // Map CSV data to DTO format
        const mappedData = this.mapCSVToDto(row, csvMappingConfig);

        // Apply default values
        Object.assign(mappedData, defaultValues, mappedData);

        // Validate the mapped data
        const validationResult = await this.validateDto(mappedData, dtoClass);
        if (!validationResult.isValid) {
          throw new Error(
            `Validation failed: ${validationResult.errors.join('; ')}`,
          );
        }

        let entity: TEntity;

        if (dryRun) {
          // For dry run, just validate and continue
          result.successfulRecords.push(mappedData);
          result.successCount++;
          continue;
        }

        // Perform operation based on type
        if (operationType === BulkOperationType.CREATE) {
          entity = await createFn(validationResult.validatedData);
        } else if (operationType === BulkOperationType.UPDATE) {
          const identifier = mappedData[identifierField];
          if (!identifier) {
            throw new Error(
              `Missing identifier field '${identifierField}' for update operation`,
            );
          }

          // Check if entity exists
          const existingEntity = await findFn(identifier);
          if (!existingEntity) {
            throw new Error(
              `Entity with ${identifierField} '${identifier}' not found`,
            );
          }

          entity = await updateFn(identifier, validationResult.validatedData);
        } else {
          throw new Error(`Unsupported operation type: ${operationType}`);
        }

        result.successfulRecords.push(entity);
        result.successCount++;
      } catch (error) {
        result.errorCount++;
        result.failedRecords.push({
          row: rowNumber,
          data: row,
          errors: [error.message],
          operation: operationType,
        });

        // If not skipping errors, stop processing
        if (!skipErrors) {
          result.message = `Processing stopped at row ${rowNumber} due to error: ${error.message}`;
          break;
        }
      }
    }

    // Generate summary message
    if (dryRun) {
      result.message = `Dry run completed: ${result.successCount} records would be ${operationType}d, ${result.errorCount} errors found`;
    } else if (result.errorCount === 0) {
      result.message = `Successfully ${operationType}d all ${result.successCount} records`;
    } else if (result.successCount === 0) {
      result.message = `Failed to ${operationType} any records. ${result.errorCount} errors encountered`;
    } else {
      result.message = `${operationType}d ${result.successCount} records successfully, ${result.errorCount} failed`;
    }

    return result;
  }

  static mapCSVToDto(csvRow: any, mappingConfig: CSVMappingConfig): any {
    const mappedData: any = {};

    for (const [csvColumn, config] of Object.entries(mappingConfig)) {
      // Try both exact match and case-insensitive match
      let value = csvRow[csvColumn];
      if (value === undefined) {
        // Try to find case-insensitive match
        const foundKey = Object.keys(csvRow).find(
          (key) => key.toLowerCase() === csvColumn.toLowerCase(),
        );
        if (foundKey) {
          value = csvRow[foundKey];
        }
      }

      if (value !== undefined && value !== '') {
        // Apply transformation if provided
        if (config.transform) {
          try {
            value = config.transform(value);
          } catch (error) {
            throw new Error(
              `Transformation failed for field '${config.dtoField}': ${error.message}`,
            );
          }
        }
        mappedData[config.dtoField] = value;
      } else if (config.required) {
        throw new Error(`Required field '${csvColumn}' is missing or empty`);
      }
    }

    return mappedData;
  }

  private static async validateDto<T>(
    data: any,
    dtoClass: new () => T,
  ): Promise<BulkValidationResult> {
    try {
      const dto = plainToClass(dtoClass, data);
      const validationErrors = await validate(dto as any);

      if (validationErrors.length > 0) {
        const errorMessages = validationErrors.map((error) =>
          Object.values(error.constraints || {}).join(', '),
        );
        return {
          isValid: false,
          errors: errorMessages,
          validatedData: null,
        };
      }

      return {
        isValid: true,
        errors: [],
        validatedData: dto,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message],
        validatedData: null,
      };
    }
  }

  static generateCSVTemplate(
    mappingConfig: CSVMappingConfig,
    sampleData?: any,
  ): string {
    const headers = Object.keys(mappingConfig);

    if (!sampleData) {
      return headers.join(',');
    }

    const sampleRow = headers.map((header) => {
      const config = mappingConfig[header];
      return sampleData[config.dtoField] || '';
    });

    return headers.join(',') + '\n' + sampleRow.join(',');
  }

  static createCommonTransforms() {
    return {
      // Date transformations
      toDate: (value: string) => {
        if (!value) return undefined;
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date format: ${value}`);
        }
        return date;
      },

      // Number transformations
      toNumber: (value: string) => {
        if (!value) return undefined;
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number format: ${value}`);
        }
        return num;
      },

      // Boolean transformations
      toBoolean: (value: string) => {
        if (!value) return undefined;
        const lowerValue = value.toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(lowerValue)) return true;
        if (['false', '0', 'no', 'off'].includes(lowerValue)) return false;
        throw new Error(`Invalid boolean format: ${value}`);
      },

      // Array transformations
      toArray: (value: string, delimiter: string = ',') => {
        if (!value) return [];
        return value
          .split(delimiter)
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      },

      // Email transformation
      normalizeEmail: (value: string) => {
        if (!value) return undefined;
        return value.toLowerCase().trim();
      },

      // Phone transformation
      normalizePhone: (value: string) => {
        if (!value) return undefined;
        // Remove all non-numeric characters except + at the beginning
        return value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
      },

      // Object transformations
      toAddress: (
        street: string,
        city: string,
        state: string,
        country: string = 'Nigeria',
      ) => {
        if (!street && !city && !state) return undefined;
        return {
          street: street || '',
          city: city || '',
          state: state || '',
          country: country || 'Nigeria',
        };
      },
    };
  }
}
