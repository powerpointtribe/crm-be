import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  FormFieldConfig,
  FormFieldConfigDocument,
  FormFieldType,
} from './schemas/form-field-config.schema';
import {
  CreateFormFieldConfigDto,
  UpdateFormFieldConfigDto,
  BulkUpdateSortOrderDto,
} from './dto/form-field-config.dto';

@Injectable()
export class FormFieldConfigService {
  constructor(
    @InjectModel(FormFieldConfig.name)
    private formFieldConfigModel: Model<FormFieldConfigDocument>,
  ) {}

  /**
   * Helper to validate ObjectId string
   */
  private isValidObjectId(id: string): boolean {
    return /^[a-fA-F0-9]{24}$/.test(id);
  }

  /**
   * Get all field configs for a form type
   */
  async findByFormType(
    branchId: string,
    formType: string,
    includeInactive = false,
  ): Promise<FormFieldConfigDocument[]> {
    // Return empty array if branchId is invalid
    if (!branchId || !this.isValidObjectId(branchId)) {
      console.log('findByFormType: Invalid branchId, returning empty', { branchId });
      return [];
    }

    const query: any = {
      branch: new Types.ObjectId(branchId),
      formType,
    };

    if (!includeInactive) {
      query.isActive = true;
    }

    console.log('findByFormType query:', { branchId, formType, includeInactive });

    // Debug: Check what branches exist in the collection
    const allFields = await this.formFieldConfigModel.find({ formType }).limit(5).exec();
    console.log('Sample existing fields:', allFields.map(f => ({
      id: f._id,
      branch: f.branch?.toString(),
      fieldKey: f.fieldKey
    })));

    const results = await this.formFieldConfigModel
      .find(query)
      .sort({ step: 1, sortOrder: 1 })
      .exec();

    console.log('findByFormType results count:', results.length);
    return results;
  }

  /**
   * Get a single field config by ID
   */
  async findById(id: string): Promise<FormFieldConfigDocument> {
    const config = await this.formFieldConfigModel.findById(id).exec();
    if (!config) {
      throw new NotFoundException('Form field configuration not found');
    }
    return config;
  }

  /**
   * Create a new field config
   */
  async create(
    branchId: string,
    memberId: string,
    dto: CreateFormFieldConfigDto,
  ): Promise<FormFieldConfigDocument> {
    // Validate IDs
    if (!branchId || !this.isValidObjectId(branchId)) {
      throw new BadRequestException('Invalid campus ID');
    }
    if (!memberId || !this.isValidObjectId(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    // Check for existing field key
    const existing = await this.formFieldConfigModel.findOne({
      branch: new Types.ObjectId(branchId),
      formType: dto.formType,
      fieldKey: dto.fieldKey,
    });

    if (existing) {
      throw new ConflictException(
        `Field with key "${dto.fieldKey}" already exists for this form`,
      );
    }

    // Get max sort order if not provided
    if (dto.sortOrder === undefined) {
      const maxSortField = await this.formFieldConfigModel
        .findOne({
          branch: new Types.ObjectId(branchId),
          formType: dto.formType,
          step: dto.step,
        })
        .sort({ sortOrder: -1 });
      dto.sortOrder = maxSortField ? maxSortField.sortOrder + 1 : 0;
    }

    const config = new this.formFieldConfigModel({
      ...dto,
      branch: new Types.ObjectId(branchId),
      createdBy: new Types.ObjectId(memberId),
    });

    return config.save();
  }

  /**
   * Update a field config
   */
  async update(
    id: string,
    memberId: string,
    dto: UpdateFormFieldConfigDto,
  ): Promise<FormFieldConfigDocument> {
    if (!memberId || !this.isValidObjectId(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    const config = await this.findById(id);

    // Cannot change fieldKey for system fields
    if (config.isSystemField && dto.fieldKey && dto.fieldKey !== config.fieldKey) {
      throw new BadRequestException('Cannot change field key for system fields');
    }

    // Check for duplicate fieldKey if changing
    if (dto.fieldKey && dto.fieldKey !== config.fieldKey) {
      const existing = await this.formFieldConfigModel.findOne({
        branch: config.branch,
        formType: dto.formType || config.formType,
        fieldKey: dto.fieldKey,
        _id: { $ne: config._id },
      });

      if (existing) {
        throw new ConflictException(
          `Field with key "${dto.fieldKey}" already exists for this form`,
        );
      }
    }

    Object.assign(config, dto);
    config.updatedBy = new Types.ObjectId(memberId);
    config.updatedAt = new Date();

    return config.save();
  }

  /**
   * Delete a field config
   */
  async delete(id: string): Promise<void> {
    const config = await this.findById(id);

    if (config.isSystemField) {
      throw new BadRequestException('Cannot delete system fields');
    }

    await this.formFieldConfigModel.findByIdAndDelete(id);
  }

  /**
   * Bulk update sort orders
   */
  async bulkUpdateSortOrder(
    branchId: string,
    memberId: string,
    dto: BulkUpdateSortOrderDto,
  ): Promise<void> {
    if (!branchId || !this.isValidObjectId(branchId)) {
      throw new BadRequestException('Invalid campus ID');
    }
    if (!memberId || !this.isValidObjectId(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    const bulkOps = dto.items
      .filter((item) => this.isValidObjectId(item.id))
      .map((item) => ({
        updateOne: {
          filter: {
            _id: new Types.ObjectId(item.id),
            branch: new Types.ObjectId(branchId),
          },
          update: {
            $set: {
              sortOrder: item.sortOrder,
              updatedBy: new Types.ObjectId(memberId),
              updatedAt: new Date(),
            },
          },
        },
      }));

    if (bulkOps.length > 0) {
      await this.formFieldConfigModel.bulkWrite(bulkOps);
    }
  }

  /**
   * Initialize default requisition form fields for a branch
   * @returns Object indicating if fields were created or already existed
   */
  async initializeDefaultFields(
    branchId: string,
    memberId: string,
  ): Promise<{ created: boolean; count: number }> {
    if (!branchId || !this.isValidObjectId(branchId)) {
      throw new BadRequestException('Invalid campus ID');
    }
    if (!memberId || !this.isValidObjectId(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    const existingFields = await this.formFieldConfigModel.countDocuments({
      branch: new Types.ObjectId(branchId),
      formType: 'requisition',
    });

    if (existingFields > 0) {
      return { created: false, count: existingFields }; // Already initialized
    }

    const defaultFields: Partial<FormFieldConfig>[] = [
      // Step 1: Request Details
      {
        formType: 'requisition',
        fieldKey: 'expenseCategory',
        label: 'Expense Category',
        placeholder: 'Select category',
        fieldType: FormFieldType.SELECT,
        validation: { required: true },
        isSystemField: true,
        sortOrder: 0,
        step: 1,
        gridSpan: 6,
      },
      {
        formType: 'requisition',
        fieldKey: 'unit',
        label: 'Unit',
        placeholder: 'Select unit (optional)',
        fieldType: FormFieldType.SELECT,
        validation: { required: false },
        isSystemField: true,
        sortOrder: 1,
        step: 1,
        gridSpan: 6,
      },
      {
        formType: 'requisition',
        fieldKey: 'eventDescription',
        label: 'Event/Purpose Description',
        placeholder: 'Describe the event or purpose for this requisition...',
        fieldType: FormFieldType.TEXTAREA,
        validation: { required: true, maxLength: 500 },
        isSystemField: true,
        sortOrder: 2,
        step: 1,
        gridSpan: 12,
      },
      {
        formType: 'requisition',
        fieldKey: 'dateNeeded',
        label: 'Date Needed',
        fieldType: FormFieldType.DATE,
        validation: { required: true },
        isSystemField: true,
        sortOrder: 3,
        step: 1,
        gridSpan: 6,
      },
      {
        formType: 'requisition',
        fieldKey: 'lastRequest',
        label: 'Last Request of This Nature',
        helpText: 'Optional - e.g., About 3 months ago',
        fieldType: FormFieldType.TEXT,
        validation: { required: false },
        isSystemField: false,
        sortOrder: 4,
        step: 1,
        gridSpan: 6,
      },
      {
        formType: 'requisition',
        fieldKey: 'discussedWithPDams',
        label: 'Has this been discussed with P.Dams?',
        fieldType: FormFieldType.CHECKBOX,
        validation: { required: false },
        isSystemField: false,
        sortOrder: 5,
        step: 1,
        gridSpan: 6,
      },
      {
        formType: 'requisition',
        fieldKey: 'discussedDate',
        label: 'Date Discussed',
        fieldType: FormFieldType.DATE,
        validation: { required: false },
        isSystemField: false,
        sortOrder: 6,
        step: 1,
        gridSpan: 6,
      },
      // Step 2: Cost & Payment Details (system fields - cost breakdown and bank details are handled specially)
      {
        formType: 'requisition',
        fieldKey: 'costBreakdown',
        label: 'Cost Breakdown',
        helpText: 'Add items with quantity and unit cost',
        fieldType: FormFieldType.TEXT, // Special handling in frontend
        validation: { required: true },
        isSystemField: true,
        sortOrder: 0,
        step: 2,
        gridSpan: 12,
      },
      {
        formType: 'requisition',
        fieldKey: 'creditAccount.bankName',
        label: 'Bank Name',
        placeholder: 'e.g., GTBank, First Bank',
        fieldType: FormFieldType.TEXT,
        validation: { required: true },
        isSystemField: true,
        sortOrder: 1,
        step: 2,
        gridSpan: 4,
      },
      {
        formType: 'requisition',
        fieldKey: 'creditAccount.accountName',
        label: 'Account Name',
        placeholder: 'Account holder name',
        fieldType: FormFieldType.TEXT,
        validation: { required: true },
        isSystemField: true,
        sortOrder: 2,
        step: 2,
        gridSpan: 4,
      },
      {
        formType: 'requisition',
        fieldKey: 'creditAccount.accountNumber',
        label: 'Account Number',
        placeholder: '10-digit account number',
        fieldType: FormFieldType.TEXT,
        validation: { required: true, minLength: 10, maxLength: 10 },
        isSystemField: true,
        sortOrder: 3,
        step: 2,
        gridSpan: 4,
      },
    ];

    const branchObjId = new Types.ObjectId(branchId);
    const memberObjId = new Types.ObjectId(memberId);

    const fieldsToInsert = defaultFields.map((field) => ({
      ...field,
      branch: branchObjId,
      createdBy: memberObjId,
      isActive: true,
    }));

    await this.formFieldConfigModel.insertMany(fieldsToInsert);
    return { created: true, count: fieldsToInsert.length };
  }

  /**
   * Reset and reinitialize form fields - deletes ALL fields for a form type and creates fresh defaults
   */
  async resetAndInitialize(
    branchId: string,
    memberId: string,
    formType: string,
  ): Promise<{ count: number }> {
    if (!branchId || !this.isValidObjectId(branchId)) {
      throw new BadRequestException('Invalid campus ID');
    }

    // Delete ALL fields for this form type (regardless of branch - to clean up bad data)
    const deleteResult = await this.formFieldConfigModel.deleteMany({ formType });
    console.log(`Deleted ${deleteResult.deletedCount} existing form fields`);

    // Now initialize with correct branchId
    const result = await this.initializeDefaultFields(branchId, memberId);
    return { count: result.count };
  }

  /**
   * Toggle field active status
   */
  async toggleActive(
    id: string,
    memberId: string,
  ): Promise<FormFieldConfigDocument> {
    if (!memberId || !this.isValidObjectId(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    const config = await this.findById(id);

    if (config.isSystemField) {
      throw new BadRequestException(
        'Cannot deactivate system fields',
      );
    }

    config.isActive = !config.isActive;
    config.updatedBy = new Types.ObjectId(memberId);
    config.updatedAt = new Date();

    return config.save();
  }
}
