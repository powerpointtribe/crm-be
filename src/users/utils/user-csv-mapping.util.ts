import { CSVMappingConfig } from '../../common/interfaces/bulk-operation.interface';
import { BulkOperationUtil } from '../../common/utils/bulk-operation.util';

export class UserCSVMappingUtil {
  static getCreateMappingConfig(): CSVMappingConfig {
    const transforms = BulkOperationUtil.createCommonTransforms();

    return {
      'First Name': { dtoField: 'firstName', required: true },
      firstName: { dtoField: 'firstName', required: true },

      'Last Name': { dtoField: 'lastName', required: true },
      lastName: { dtoField: 'lastName', required: true },

      Email: {
        dtoField: 'email',
        required: true,
        transform: transforms.normalizeEmail,
      },
      email: {
        dtoField: 'email',
        required: true,
        transform: transforms.normalizeEmail,
      },

      Password: { dtoField: 'password', required: true },
      password: { dtoField: 'password', required: true },

      Phone: { dtoField: 'phone', transform: transforms.normalizePhone },
      phone: { dtoField: 'phone', transform: transforms.normalizePhone },

      Role: { dtoField: 'role' },
      role: { dtoField: 'role' },

      'Is Active': { dtoField: 'isActive', transform: transforms.toBoolean },
      isActive: { dtoField: 'isActive', transform: transforms.toBoolean },
    };
  }

  static getUpdateMappingConfig(): CSVMappingConfig {
    const createConfig = this.getCreateMappingConfig();
    const updateConfig: CSVMappingConfig = {};

    for (const [csvField, config] of Object.entries(createConfig)) {
      updateConfig[csvField] = {
        ...config,
        required: false, // Most fields are optional for updates
      };
    }

    // Email remains required as default identifier
    if (updateConfig['Email']) updateConfig['Email'].required = true;
    if (updateConfig['email']) updateConfig['email'].required = true;

    // Password is not required for updates
    if (updateConfig['Password']) delete updateConfig['Password'];
    if (updateConfig['password']) delete updateConfig['password'];

    return updateConfig;
  }

  static generateSampleCSV(operationType: 'create' | 'update'): string {
    const sampleData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: operationType === 'create' ? 'password123' : undefined,
      phone: '+234801234567',
      role: 'MEMBER',
      isActive: 'true',
    };

    const mappingConfig =
      operationType === 'create'
        ? this.getCreateMappingConfig()
        : this.getUpdateMappingConfig();

    return BulkOperationUtil.generateCSVTemplate(mappingConfig, sampleData);
  }
}
