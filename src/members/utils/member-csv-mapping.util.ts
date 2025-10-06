import { CSVMappingConfig } from '../../common/interfaces/bulk-operation.interface';
import { BulkOperationUtil } from '../../common/utils/bulk-operation.util';

export class MemberCSVMappingUtil {
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

      Phone: {
        dtoField: 'phone',
        required: true,
        transform: transforms.normalizePhone,
      },
      phone: {
        dtoField: 'phone',
        required: true,
        transform: transforms.normalizePhone,
      },

      'Date of Birth': {
        dtoField: 'dateOfBirth',
        required: true,
        transform: transforms.toDate,
      },
      dateOfBirth: {
        dtoField: 'dateOfBirth',
        required: true,
        transform: transforms.toDate,
      },

      Gender: { dtoField: 'gender', required: true },
      gender: { dtoField: 'gender', required: true },

      'Marital Status': {
        dtoField: 'maritalStatus',
        transform: (value) => value?.toLowerCase(),
      },
      maritalStatus: {
        dtoField: 'maritalStatus',
        transform: (value) => value?.toLowerCase(),
      },

      // Address fields
      Street: { dtoField: 'address.street', required: true },
      street: { dtoField: 'address.street', required: true },
      'address.street': { dtoField: 'address.street', required: true },

      City: { dtoField: 'address.city', required: true },
      city: { dtoField: 'address.city', required: true },
      'address.city': { dtoField: 'address.city', required: true },

      State: { dtoField: 'address.state', required: true },
      state: { dtoField: 'address.state', required: true },
      'address.state': { dtoField: 'address.state', required: true },

      'ZIP Code': { dtoField: 'address.zipCode' },
      zipCode: { dtoField: 'address.zipCode' },
      'address.zipCode': { dtoField: 'address.zipCode' },

      Country: { dtoField: 'address.country' },
      country: { dtoField: 'address.country' },
      'address.country': { dtoField: 'address.country' },

      // Church structure
      District: { dtoField: 'district', required: true },
      district: { dtoField: 'district', required: true },

      Unit: { dtoField: 'unit' },
      unit: { dtoField: 'unit' },

      'Additional Groups': {
        dtoField: 'additionalGroups',
        transform: transforms.toArray,
      },
      additionalGroups: {
        dtoField: 'additionalGroups',
        transform: transforms.toArray,
      },

      // Membership details
      'Membership Status': { dtoField: 'membershipStatus' },
      membershipStatus: { dtoField: 'membershipStatus' },

      'Date Joined': { dtoField: 'dateJoined', transform: transforms.toDate },
      dateJoined: { dtoField: 'dateJoined', transform: transforms.toDate },

      'Baptism Date': { dtoField: 'baptismDate', transform: transforms.toDate },
      baptismDate: { dtoField: 'baptismDate', transform: transforms.toDate },

      'Confirmation Date': {
        dtoField: 'confirmationDate',
        transform: transforms.toDate,
      },
      confirmationDate: {
        dtoField: 'confirmationDate',
        transform: transforms.toDate,
      },

      // Skills and ministries
      Ministries: { dtoField: 'ministries', transform: transforms.toArray },
      ministries: { dtoField: 'ministries', transform: transforms.toArray },

      Skills: { dtoField: 'skills', transform: transforms.toArray },
      skills: { dtoField: 'skills', transform: transforms.toArray },

      Occupation: { dtoField: 'occupation' },
      occupation: { dtoField: 'occupation' },

      'Work Address': { dtoField: 'workAddress' },
      workAddress: { dtoField: 'workAddress' },

      // Family relationships
      Spouse: { dtoField: 'spouse' },
      spouse: { dtoField: 'spouse' },

      Children: { dtoField: 'children', transform: transforms.toArray },
      children: { dtoField: 'children', transform: transforms.toArray },

      Parent: { dtoField: 'parent' },
      parent: { dtoField: 'parent' },

      // Emergency contact
      'Emergency Contact Name': { dtoField: 'emergencyContact.name' },
      'emergencyContact.name': { dtoField: 'emergencyContact.name' },

      'Emergency Contact Relationship': {
        dtoField: 'emergencyContact.relationship',
      },
      'emergencyContact.relationship': {
        dtoField: 'emergencyContact.relationship',
      },

      'Emergency Contact Phone': {
        dtoField: 'emergencyContact.phone',
        transform: transforms.normalizePhone,
      },
      'emergencyContact.phone': {
        dtoField: 'emergencyContact.phone',
        transform: transforms.normalizePhone,
      },

      'Emergency Contact Email': {
        dtoField: 'emergencyContact.email',
        transform: transforms.normalizeEmail,
      },
      'emergencyContact.email': {
        dtoField: 'emergencyContact.email',
        transform: transforms.normalizeEmail,
      },

      // Leadership roles
      'Is District Pastor': {
        dtoField: 'leadershipRoles.isDistrictPastor',
        transform: transforms.toBoolean,
      },
      'leadershipRoles.isDistrictPastor': {
        dtoField: 'leadershipRoles.isDistrictPastor',
        transform: transforms.toBoolean,
      },

      'Is Champ': {
        dtoField: 'leadershipRoles.isChamp',
        transform: transforms.toBoolean,
      },
      'leadershipRoles.isChamp': {
        dtoField: 'leadershipRoles.isChamp',
        transform: transforms.toBoolean,
      },

      'Is Unit Head': {
        dtoField: 'leadershipRoles.isUnitHead',
        transform: transforms.toBoolean,
      },
      'leadershipRoles.isUnitHead': {
        dtoField: 'leadershipRoles.isUnitHead',
        transform: transforms.toBoolean,
      },

      'Champ For District': { dtoField: 'leadershipRoles.champForDistrict' },
      'leadershipRoles.champForDistrict': {
        dtoField: 'leadershipRoles.champForDistrict',
      },

      'Leads Unit': { dtoField: 'leadershipRoles.leadsUnit' },
      'leadershipRoles.leadsUnit': { dtoField: 'leadershipRoles.leadsUnit' },

      'Pastors District': { dtoField: 'leadershipRoles.pastorsDistrict' },
      'leadershipRoles.pastorsDistrict': {
        dtoField: 'leadershipRoles.pastorsDistrict',
      },

      Notes: { dtoField: 'notes' },
      notes: { dtoField: 'notes' },
    };
  }

  static getUpdateMappingConfig(): CSVMappingConfig {
    const createConfig = this.getCreateMappingConfig();

    // For updates, make most fields optional except identifier
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

    return updateConfig;
  }

  static generateSampleCSV(operationType: 'create' | 'update'): string {
    const sampleData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+234801234567',
      dateOfBirth: '1990-01-15',
      gender: 'male',
      maritalStatus: 'married',
      'address.street': '123 Main Street',
      'address.city': 'Lagos',
      'address.state': 'Lagos State',
      'address.zipCode': '100001',
      'address.country': 'Nigeria',
      district: '507f1f77bcf86cd799439011',
      unit: '507f1f77bcf86cd799439021',
      additionalGroups: 'fellowship1,ministry2',
      membershipStatus: 'ACTIVE_MEMBER',
      dateJoined: '2024-01-01',
      baptismDate: '2024-03-01',
      confirmationDate: '2024-06-01',
      ministries: 'worship,media',
      skills: 'singing,photography',
      occupation: 'Software Engineer',
      workAddress: '456 Corporate Avenue, Victoria Island',
      spouse: '507f1f77bcf86cd799439031',
      children: 'child1,child2',
      parent: '507f1f77bcf86cd799439041',
      'emergencyContact.name': 'Jane Doe',
      'emergencyContact.relationship': 'spouse',
      'emergencyContact.phone': '+234801234568',
      'emergencyContact.email': 'jane.doe@example.com',
      'leadershipRoles.isDistrictPastor': 'false',
      'leadershipRoles.isChamp': 'true',
      'leadershipRoles.isUnitHead': 'false',
      'leadershipRoles.champForDistrict': '507f1f77bcf86cd799439011',
      'leadershipRoles.leadsUnit': '',
      'leadershipRoles.pastorsDistrict': '',
      notes: 'Active member, excellent leader',
    };

    const mappingConfig =
      operationType === 'create'
        ? this.getCreateMappingConfig()
        : this.getUpdateMappingConfig();

    return BulkOperationUtil.generateCSVTemplate(mappingConfig, sampleData);
  }

  static processAddress(mappedData: any): any {
    // Combine address fields into address object
    const addressFields = ['street', 'city', 'state', 'zipCode', 'country'];
    const address: any = {};
    let hasAddressData = false;

    for (const field of addressFields) {
      const addressField = `address.${field}`;
      if (mappedData[addressField] !== undefined) {
        address[field] = mappedData[addressField];
        delete mappedData[addressField];
        hasAddressData = true;
      }
    }

    if (hasAddressData) {
      mappedData.address = address;
    }

    return mappedData;
  }

  static processEmergencyContact(mappedData: any): any {
    // Combine emergency contact fields into emergencyContact object
    const emergencyFields = ['name', 'relationship', 'phone', 'email'];
    const emergencyContact: any = {};
    let hasEmergencyData = false;

    for (const field of emergencyFields) {
      const emergencyField = `emergencyContact.${field}`;
      if (mappedData[emergencyField] !== undefined) {
        emergencyContact[field] = mappedData[emergencyField];
        delete mappedData[emergencyField];
        hasEmergencyData = true;
      }
    }

    if (hasEmergencyData) {
      mappedData.emergencyContact = emergencyContact;
    }

    return mappedData;
  }

  static processLeadershipRoles(mappedData: any): any {
    // Combine leadership role fields into leadershipRoles object
    const leadershipFields = [
      'isDistrictPastor',
      'isChamp',
      'isUnitHead',
      'champForDistrict',
      'leadsUnit',
      'pastorsDistrict',
    ];
    const leadershipRoles: any = {};
    let hasLeadershipData = false;

    for (const field of leadershipFields) {
      const leadershipField = `leadershipRoles.${field}`;
      if (mappedData[leadershipField] !== undefined) {
        leadershipRoles[field] = mappedData[leadershipField];
        delete mappedData[leadershipField];
        hasLeadershipData = true;
      }
    }

    if (hasLeadershipData) {
      mappedData.leadershipRoles = leadershipRoles;
    }

    return mappedData;
  }

  static postProcessMappedData(mappedData: any): any {
    // Process nested objects
    mappedData = this.processAddress(mappedData);
    mappedData = this.processEmergencyContact(mappedData);
    mappedData = this.processLeadershipRoles(mappedData);

    return mappedData;
  }
}
