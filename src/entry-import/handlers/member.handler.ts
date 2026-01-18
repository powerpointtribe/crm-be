import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import {
  EntityHandler,
  MappedEntityData,
  EntityCreationResult,
} from './entity-handler.interface';
import { EntryImportEntityType } from '../schemas/entry-import.schema';
import { Member, MemberDocument } from '../../members/schemas/member.schema';
import { MembershipStatus } from '../../common/enums/member-status.enum';
import { UserRole } from '../../common/enums/user-roles.enums';

@Injectable()
export class MemberHandler implements EntityHandler {
  private readonly logger = new Logger(MemberHandler.name);

  entityType = EntryImportEntityType.MEMBER;

  constructor(
    @InjectModel(Member.name)
    private memberModel: Model<MemberDocument>,
  ) {}

  getDisplayName(): string {
    return 'Members';
  }

  getDescription(): string {
    return 'Import church members from CSV files';
  }

  mapCsvRow(rawData: Record<string, any>): MappedEntityData {
    const mappedData: Record<string, any> = {};

    // First Name (required)
    if (rawData['First Name'] || rawData['firstName']) {
      mappedData.firstName = rawData['First Name'] || rawData['firstName'];
    }

    // Last Name (required)
    if (rawData['Last Name'] || rawData['lastName']) {
      mappedData.lastName = rawData['Last Name'] || rawData['lastName'];
    }

    // Email (required)
    if (rawData['Email'] || rawData['email'] || rawData['Email Address']) {
      mappedData.email = (rawData['Email'] || rawData['email'] || rawData['Email Address']).toLowerCase().trim();
    }

    // Phone (required)
    if (rawData['Phone'] || rawData['phone'] || rawData['Phone Number']) {
      mappedData.phone = rawData['Phone'] || rawData['phone'] || rawData['Phone Number'];
    }

    // Date of Birth (required)
    if (rawData['Date of Birth'] || rawData['dateOfBirth'] || rawData['Birthday'] || rawData['DOB']) {
      mappedData.dateOfBirth = rawData['Date of Birth'] || rawData['dateOfBirth'] || rawData['Birthday'] || rawData['DOB'];
    }

    // Gender (required)
    if (rawData['Gender'] || rawData['gender']) {
      const gender = (rawData['Gender'] || rawData['gender'] || '').toLowerCase().trim();
      if (gender === 'male' || gender === 'm') {
        mappedData.gender = 'male';
      } else if (gender === 'female' || gender === 'f') {
        mappedData.gender = 'female';
      }
    }

    // Marital Status
    if (rawData['Marital Status'] || rawData['maritalStatus']) {
      const status = (rawData['Marital Status'] || rawData['maritalStatus'] || '').toLowerCase().trim();
      if (['single', 'married', 'divorced', 'widowed'].includes(status)) {
        mappedData.maritalStatus = status;
      }
    }

    // Membership Status
    if (rawData['Membership Status'] || rawData['membershipStatus'] || rawData['Status']) {
      const status = (rawData['Membership Status'] || rawData['membershipStatus'] || rawData['Status'] || '').toLowerCase().trim();
      mappedData.membershipStatus = this.mapMembershipStatus(status);
    }

    // Date Joined
    if (rawData['Date Joined'] || rawData['dateJoined'] || rawData['Join Date']) {
      mappedData.dateJoined = rawData['Date Joined'] || rawData['dateJoined'] || rawData['Join Date'];
    }

    // Baptism Date
    if (rawData['Baptism Date'] || rawData['baptismDate']) {
      mappedData.baptismDate = rawData['Baptism Date'] || rawData['baptismDate'];
    }

    // Address
    const address: any = {};
    if (rawData['Street'] || rawData['street'] || rawData['Address'] || rawData['Home Address']) {
      address.street = rawData['Street'] || rawData['street'] || rawData['Address'] || rawData['Home Address'];
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

    // Occupation
    if (rawData['Occupation'] || rawData['occupation'] || rawData['Job']) {
      mappedData.occupation = rawData['Occupation'] || rawData['occupation'] || rawData['Job'];
    }

    // Unique key for duplicate checking (email is unique)
    const uniqueKey = mappedData.email;

    // Validate required fields
    const errors: string[] = [];
    if (!mappedData.firstName) {
      errors.push('First name is required');
    }
    if (!mappedData.lastName) {
      errors.push('Last name is required');
    }
    if (!mappedData.email) {
      errors.push('Email is required');
    }
    if (!mappedData.phone) {
      errors.push('Phone is required');
    }
    if (!mappedData.dateOfBirth) {
      errors.push('Date of birth is required');
    }
    if (!mappedData.gender) {
      errors.push('Gender is required');
    }

    return {
      mappedData,
      uniqueKey,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private mapMembershipStatus(value: string): MembershipStatus {
    const mapping: Record<string, MembershipStatus> = {
      'member': MembershipStatus.MEMBER,
      'dc': MembershipStatus.DC,
      'davids company': MembershipStatus.DC,
      "david's company": MembershipStatus.DC,
      'worker': MembershipStatus.DC,
      'lxl': MembershipStatus.LXL,
      'leader': MembershipStatus.LXL,
      'director': MembershipStatus.DIRECTOR,
      'pastor': MembershipStatus.PASTOR,
      'senior pastor': MembershipStatus.SENIOR_PASTOR,
    };
    return mapping[value] || MembershipStatus.MEMBER;
  }

  async createEntity(
    mappedData: Record<string, any>,
    options?: Record<string, any>,
  ): Promise<EntityCreationResult> {
    try {
      // Apply branch if provided
      if (options?.branchId) {
        mappedData.branch = new Types.ObjectId(options.branchId);
      }

      if (!mappedData.branch) {
        return {
          success: false,
          errors: ['Branch is required for member creation'],
        };
      }

      // Check for duplicate by email
      const existingByEmail = await this.memberModel.findOne({
        email: mappedData.email,
      });

      if (existingByEmail) {
        return {
          success: false,
          errors: [`Member with email "${mappedData.email}" already exists`],
        };
      }

      // Parse dates
      if (mappedData.dateOfBirth) {
        const dob = new Date(mappedData.dateOfBirth);
        if (isNaN(dob.getTime())) {
          return {
            success: false,
            errors: ['Invalid date format for date of birth'],
          };
        }
        mappedData.dateOfBirth = dob;
      }

      if (mappedData.dateJoined) {
        const joined = new Date(mappedData.dateJoined);
        if (!isNaN(joined.getTime())) {
          mappedData.dateJoined = joined;
        } else {
          delete mappedData.dateJoined;
        }
      }

      if (mappedData.baptismDate) {
        const baptism = new Date(mappedData.baptismDate);
        if (!isNaN(baptism.getTime())) {
          mappedData.baptismDate = baptism;
        } else {
          delete mappedData.baptismDate;
        }
      }

      // Generate a temporary password (user will need to reset)
      const tempPassword = this.generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Set defaults
      if (!mappedData.membershipStatus) {
        mappedData.membershipStatus = MembershipStatus.MEMBER;
      }

      if (!mappedData.address) {
        mappedData.address = {
          street: '',
          city: '',
          state: 'Lagos',
          country: 'Nigeria',
        };
      }

      // Create the member
      const member = new this.memberModel({
        ...mappedData,
        password: hashedPassword,
        systemRoles: [UserRole.MEMBER],
        isActive: true,
      });

      await member.save();

      this.logger.debug(`Created member ${member._id}: ${member.firstName} ${member.lastName}`);

      return {
        success: true,
        entityId: (member._id as Types.ObjectId).toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to create member: ${error.message}`);
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  getSampleCsvHeaders(): string[] {
    return [
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Date of Birth',
      'Gender',
      'Marital Status',
      'Membership Status',
      'Date Joined',
      'Baptism Date',
      'Street',
      'City',
      'State',
      'Country',
      'Occupation',
    ];
  }

  getSampleCsvRow(): string[] {
    return [
      'John',
      'Doe',
      'john.doe@email.com',
      '+2348012345678',
      '1990-05-15',
      'Male',
      'Single',
      'Member',
      '2023-01-15',
      '2023-06-20',
      '123 Main Street',
      'Lagos',
      'Lagos',
      'Nigeria',
      'Software Developer',
    ];
  }
}
