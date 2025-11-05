export enum BulkOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXPORT = 'export',
}

export interface BulkOperationResult<T = any> {
  successCount: number;
  errorCount: number;
  totalCount: number;
  successfulRecords: T[];
  failedRecords: Array<{
    row: number;
    data: any;
    errors: string[];
    operation?: BulkOperationType;
  }>;
  message: string;
  operationType: BulkOperationType;
}

export interface BulkOperationOptions {
  skipErrors?: boolean;
  operationType: BulkOperationType;
  identifierField?: string; // Field to use for updates (e.g., 'email', 'phone', '_id')
  defaultValues?: Record<string, any>;
  dryRun?: boolean; // Preview changes without applying them
}

export interface CSVMappingConfig {
  [csvColumn: string]: {
    dtoField: string;
    transform?: (value: any) => any;
    required?: boolean;
  };
}

export interface BulkValidationResult {
  isValid: boolean;
  errors: string[];
  validatedData: any;
}
