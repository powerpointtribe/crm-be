import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EntityHandler,
  MappedEntityData,
  EntityCreationResult,
} from './entity-handler.interface';
import { EntryImportEntityType } from '../schemas/entry-import.schema';
import { Branch, BranchDocument } from '../../branches/schemas/branch.schema';

@Injectable()
export class BranchHandler implements EntityHandler {
  private readonly logger = new Logger(BranchHandler.name);

  entityType = EntryImportEntityType.BRANCH;

  constructor(
    @InjectModel(Branch.name)
    private branchModel: Model<BranchDocument>,
  ) {}

  getDisplayName(): string {
    return 'Campuses';
  }

  getDescription(): string {
    return 'Import church campuses/branches from CSV files';
  }

  mapCsvRow(rawData: Record<string, any>): MappedEntityData {
    const mappedData: Record<string, any> = {};

    // Name (required)
    if (rawData['Name'] || rawData['name'] || rawData['Campus Name'] || rawData['Branch Name']) {
      mappedData.name = rawData['Name'] || rawData['name'] || rawData['Campus Name'] || rawData['Branch Name'];
    }

    // Slug (auto-generate if not provided)
    if (rawData['Slug'] || rawData['slug']) {
      mappedData.slug = (rawData['Slug'] || rawData['slug']).toLowerCase().trim();
    } else if (mappedData.name) {
      // Auto-generate slug from name
      mappedData.slug = mappedData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }

    // Description
    if (rawData['Description'] || rawData['description']) {
      mappedData.description = rawData['Description'] || rawData['description'];
    }

    // Address
    const address: any = {};
    if (rawData['Street'] || rawData['street'] || rawData['Address']) {
      address.street = rawData['Street'] || rawData['street'] || rawData['Address'];
    }
    if (rawData['City'] || rawData['city']) {
      address.city = rawData['City'] || rawData['city'];
    }
    if (rawData['State'] || rawData['state']) {
      address.state = rawData['State'] || rawData['state'];
    }
    if (rawData['Country'] || rawData['country']) {
      address.country = rawData['Country'] || rawData['country'];
    }
    if (rawData['Zip Code'] || rawData['zipCode'] || rawData['Postal Code']) {
      address.zipCode = rawData['Zip Code'] || rawData['zipCode'] || rawData['Postal Code'];
    }
    if (Object.keys(address).length > 0) {
      mappedData.address = address;
    }

    // Contact Info
    if (rawData['Phone'] || rawData['phone'] || rawData['Contact Phone']) {
      mappedData.phone = rawData['Phone'] || rawData['phone'] || rawData['Contact Phone'];
    }
    if (rawData['Email'] || rawData['email'] || rawData['Contact Email']) {
      mappedData.email = rawData['Email'] || rawData['email'] || rawData['Contact Email'];
    }

    // Timezone
    if (rawData['Timezone'] || rawData['timezone']) {
      mappedData.timezone = rawData['Timezone'] || rawData['timezone'];
    }

    // Is Main Branch
    if (rawData['Is Main Branch'] || rawData['isMainBranch'] || rawData['Main Campus']) {
      const value = (rawData['Is Main Branch'] || rawData['isMainBranch'] || rawData['Main Campus'] || '').toLowerCase().trim();
      mappedData.isMainBranch = value === 'yes' || value === 'true' || value === '1';
    }

    // Service Types
    if (rawData['Service Types'] || rawData['serviceTypes'] || rawData['Services']) {
      const services = rawData['Service Types'] || rawData['serviceTypes'] || rawData['Services'];
      if (services) {
        mappedData.serviceTypes = services.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      }
    }

    // Unique key for duplicate checking
    const uniqueKey = mappedData.slug || mappedData.name;

    // Validate required fields
    const errors: string[] = [];
    if (!mappedData.name) {
      errors.push('Campus name is required');
    }

    return {
      mappedData,
      uniqueKey,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async createEntity(
    mappedData: Record<string, any>,
    options?: Record<string, any>,
  ): Promise<EntityCreationResult> {
    try {
      // Check for duplicate by slug
      const existingBySlug = await this.branchModel.findOne({
        slug: mappedData.slug,
      });

      if (existingBySlug) {
        return {
          success: false,
          errors: [`Campus with slug "${mappedData.slug}" already exists`],
        };
      }

      // Check for duplicate by name
      const existingByName = await this.branchModel.findOne({
        name: mappedData.name,
      });

      if (existingByName) {
        return {
          success: false,
          errors: [`Campus with name "${mappedData.name}" already exists`],
        };
      }

      // Create the branch
      const branch = new this.branchModel({
        ...mappedData,
        isActive: true,
        settings: {},
        metadata: {},
      });

      await branch.save();

      this.logger.debug(`Created campus ${branch._id}: ${branch.name}`);

      return {
        success: true,
        entityId: (branch._id as Types.ObjectId).toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to create campus: ${error.message}`);
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  getSampleCsvHeaders(): string[] {
    return [
      'Name',
      'Slug',
      'Description',
      'Street',
      'City',
      'State',
      'Country',
      'Zip Code',
      'Phone',
      'Email',
      'Timezone',
      'Is Main Branch',
      'Service Types',
    ];
  }

  getSampleCsvRow(): string[] {
    return [
      'Lagos Mainland Campus',
      'lagos-mainland',
      'Our main campus in Lagos Mainland',
      '123 Herbert Macaulay Way',
      'Yaba',
      'Lagos',
      'Nigeria',
      '100001',
      '+2348012345678',
      'mainland@church.com',
      'Africa/Lagos',
      'No',
      'Sunday Service,Wednesday Bible Study,Friday Prayer Meeting',
    ];
  }
}
