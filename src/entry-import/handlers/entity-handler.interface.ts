import { EntryImportEntityType } from '../schemas/entry-import.schema';

export interface MappedEntityData {
  mappedData: Record<string, any>;
  uniqueKey?: string;
  errors?: string[];
}

export interface EntityCreationResult {
  success: boolean;
  entityId?: string;
  errors?: string[];
}

export interface EntityHandler {
  /**
   * The entity type this handler supports
   */
  entityType: EntryImportEntityType;

  /**
   * Map raw CSV data to entity-specific format
   */
  mapCsvRow(rawData: Record<string, any>): MappedEntityData;

  /**
   * Create the entity from mapped data
   */
  createEntity(
    mappedData: Record<string, any>,
    options?: Record<string, any>,
  ): Promise<EntityCreationResult>;

  /**
   * Get sample CSV headers for this entity type
   */
  getSampleCsvHeaders(): string[];

  /**
   * Get sample CSV row for this entity type
   */
  getSampleCsvRow(): string[];

  /**
   * Get display name for the entity type
   */
  getDisplayName(): string;

  /**
   * Get description for the entity type import
   */
  getDescription(): string;
}
