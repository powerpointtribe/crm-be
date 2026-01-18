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
import { Group, GroupDocument } from '../../groups/schemas/group.schema';
import { Branch, BranchDocument } from '../../branches/schemas/branch.schema';
import { MembershipStatus } from '../../common/enums/member-status.enum';
import { UserRole } from '../../common/enums/user-roles.enums';
import { GroupType } from '../../common/enums/group-types.enum';

@Injectable()
export class MasterMemberHandler implements EntityHandler {
  private readonly logger = new Logger(MasterMemberHandler.name);

  entityType = EntryImportEntityType.MASTER_MEMBER;

  constructor(
    @InjectModel(Member.name)
    private memberModel: Model<MemberDocument>,
    @InjectModel(Group.name)
    private groupModel: Model<GroupDocument>,
    @InjectModel(Branch.name)
    private branchModel: Model<BranchDocument>,
  ) {}

  getDisplayName(): string {
    return 'Master Member Sheet';
  }

  getDescription(): string {
    return 'Import members with auto-creation of ministries, districts, and units. Supports leadership role assignments.';
  }

  mapCsvRow(rawData: Record<string, any>): MappedEntityData {
    const mappedData: Record<string, any> = {};

    // First Name (required)
    if (rawData['First Name'] || rawData['firstName']) {
      mappedData.firstName = (rawData['First Name'] || rawData['firstName']).trim();
    }

    // Last Name (required)
    if (rawData['Last Name'] || rawData['lastName']) {
      mappedData.lastName = (rawData['Last Name'] || rawData['lastName']).trim();
    }

    // Email (required)
    if (rawData['Email'] || rawData['email'] || rawData['Email Address']) {
      mappedData.email = (rawData['Email'] || rawData['email'] || rawData['Email Address']).toLowerCase().trim();
    }

    // Phone (required)
    if (rawData['Phone'] || rawData['phone'] || rawData['Phone Number']) {
      mappedData.phone = (rawData['Phone'] || rawData['phone'] || rawData['Phone Number']).trim();
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

    // Date of Birth (required)
    if (rawData['Date Of Birth'] || rawData['Date of Birth'] || rawData['dateOfBirth'] || rawData['DOB']) {
      mappedData.dateOfBirth = rawData['Date Of Birth'] || rawData['Date of Birth'] || rawData['dateOfBirth'] || rawData['DOB'];
    }

    // Marital Status
    if (rawData['Marital Status'] || rawData['maritalStatus']) {
      const status = (rawData['Marital Status'] || rawData['maritalStatus'] || '').toLowerCase().trim();
      if (['single', 'married', 'divorced', 'widowed'].includes(status)) {
        mappedData.maritalStatus = status;
      }
    }

    // Member Status
    if (rawData['Member Status'] || rawData['memberStatus'] || rawData['Status']) {
      const status = (rawData['Member Status'] || rawData['memberStatus'] || rawData['Status'] || '').toLowerCase().trim();
      mappedData.membershipStatus = this.mapMembershipStatus(status);
    }

    // Address fields
    const address: any = {};
    if (rawData['Street'] || rawData['street']) {
      address.street = (rawData['Street'] || rawData['street']).trim();
    }
    if (rawData['City'] || rawData['city']) {
      address.city = (rawData['City'] || rawData['city']).trim();
    }
    if (rawData['State'] || rawData['state']) {
      address.state = (rawData['State'] || rawData['state']).trim();
    }
    if (rawData['Country'] || rawData['country']) {
      address.country = (rawData['Country'] || rawData['country']).trim();
    }
    if (Object.keys(address).length > 0) {
      mappedData.address = address;
    }

    // Date Joined
    if (rawData['Date Joined'] || rawData['dateJoined'] || rawData['Join Date']) {
      mappedData.dateJoined = rawData['Date Joined'] || rawData['dateJoined'] || rawData['Join Date'];
    }

    // Campus/Branch (required)
    if (rawData['Campus'] || rawData['campus'] || rawData['Branch'] || rawData['branch']) {
      mappedData.campusName = (rawData['Campus'] || rawData['campus'] || rawData['Branch'] || rawData['branch']).trim();
    }

    // District
    if (rawData['District'] || rawData['district']) {
      mappedData.districtName = (rawData['District'] || rawData['district']).trim();
    }

    // District Role (District Champ = assistant helper in the district)
    if (rawData['District Role'] || rawData['districtRole']) {
      const role = (rawData['District Role'] || rawData['districtRole'] || '').toLowerCase().trim();
      if (role === 'district champ' || role === 'champ' || role === 'district champion') {
        mappedData.districtRole = 'district_champ';
      }
    }

    // Note: Associate Pastors with a district automatically become District Heads

    // Ministry
    if (rawData['Ministry'] || rawData['ministry']) {
      mappedData.ministryName = (rawData['Ministry'] || rawData['ministry']).trim();
    }

    // Ministry Role
    if (rawData['Ministry Role'] || rawData['ministryRole']) {
      const role = (rawData['Ministry Role'] || rawData['ministryRole'] || '').toLowerCase().trim();
      if (role === 'ministry director' || role === 'director') {
        mappedData.ministryRole = 'director';
      }
    }

    // Unit
    if (rawData['Unit'] || rawData['unit']) {
      mappedData.unitName = (rawData['Unit'] || rawData['unit']).trim();
    }

    // Unit Role
    if (rawData['Unit Role'] || rawData['unitRole']) {
      const role = (rawData['Unit Role'] || rawData['unitRole'] || '').toLowerCase().trim();
      if (role === 'unit head' || role === 'head') {
        mappedData.unitRole = 'head';
      } else if (role === 'assistant head' || role === 'assistant') {
        mappedData.unitRole = 'assistant_head';
      }
    }

    // Leadership Role (Senior Pastor, Associate Pastor, Campus Pastor)
    if (rawData['Leadership Role'] || rawData['leadershipRole']) {
      const role = (rawData['Leadership Role'] || rawData['leadershipRole'] || '').toLowerCase().trim();
      if (role === 'senior pastor') {
        mappedData.leadershipRole = 'senior_pastor';
        mappedData.membershipStatus = MembershipStatus.SENIOR_PASTOR;
      } else if (role === 'associate pastor') {
        mappedData.leadershipRole = 'associate_pastor';
        mappedData.membershipStatus = MembershipStatus.PASTOR;
      } else if (role === 'campus pastor') {
        mappedData.leadershipRole = 'campus_pastor';
        mappedData.membershipStatus = MembershipStatus.PASTOR;
      }
    }

    // Occupation
    if (rawData['Occupation'] || rawData['occupation'] || rawData['Job']) {
      mappedData.occupation = (rawData['Occupation'] || rawData['occupation'] || rawData['Job']).trim();
    }

    // Unique key for duplicate checking (firstName + lastName + email)
    const uniqueKey = `${mappedData.firstName}_${mappedData.lastName}_${mappedData.email}`.toLowerCase();

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
    if (!mappedData.gender) {
      errors.push('Gender is required (Male/Female)');
    }
    if (!mappedData.dateOfBirth) {
      errors.push('Date of birth is required');
    }
    if (!mappedData.campusName) {
      errors.push('Campus/Branch is required');
    }

    // Validate: Unit requires Ministry
    if (mappedData.unitName && !mappedData.ministryName) {
      errors.push('Ministry is required when Unit is specified (units must belong to a ministry)');
    }

    // Validate: Unit role requires Unit
    if (mappedData.unitRole && !mappedData.unitName) {
      errors.push('Unit is required when Unit Role is specified');
    }

    // Validate: District role requires District
    if (mappedData.districtRole && !mappedData.districtName) {
      errors.push('District is required when District Role is specified');
    }

    // Validate: Ministry role requires Ministry
    if (mappedData.ministryRole && !mappedData.ministryName) {
      errors.push('Ministry is required when Ministry Role is specified');
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
      // Step 1: Validate and get the branch/campus
      let branch: BranchDocument | null = null;
      if (mappedData.campusName) {
        branch = await this.branchModel.findOne({
          name: { $regex: new RegExp(`^${this.escapeRegex(mappedData.campusName)}$`, 'i') },
          isActive: true,
        });

        if (!branch) {
          return {
            success: false,
            errors: [`Campus/Branch "${mappedData.campusName}" not found in the system`],
          };
        }
      } else if (options?.branchId) {
        branch = await this.branchModel.findById(options.branchId);
      }

      if (!branch) {
        return {
          success: false,
          errors: ['Campus/Branch is required'],
        };
      }

      const branchId = branch._id as Types.ObjectId;

      // Step 2: Check for duplicate member by firstName + lastName + email
      const existingMember = await this.memberModel.findOne({
        firstName: { $regex: new RegExp(`^${this.escapeRegex(mappedData.firstName)}$`, 'i') },
        lastName: { $regex: new RegExp(`^${this.escapeRegex(mappedData.lastName)}$`, 'i') },
        email: mappedData.email.toLowerCase(),
      });
      if (existingMember) {
        return {
          success: false,
          errors: [`Member "${mappedData.firstName} ${mappedData.lastName}" with email "${mappedData.email}" already exists`],
        };
      }

      // Step 3: Create or find Ministry (if specified)
      let ministry: GroupDocument | null = null;
      if (mappedData.ministryName) {
        ministry = await this.findOrCreateGroup(
          mappedData.ministryName,
          GroupType.MINISTRY,
          branchId,
        );
      }

      // Step 4: Create or find District (if specified)
      let district: GroupDocument | null = null;
      if (mappedData.districtName) {
        district = await this.findOrCreateGroup(
          mappedData.districtName,
          GroupType.DISTRICT,
          branchId,
        );
      }

      // Step 5: Create or find Unit (if specified) - must be linked to ministry
      let unit: GroupDocument | null = null;
      if (mappedData.unitName && ministry) {
        unit = await this.findOrCreateUnit(
          mappedData.unitName,
          branchId,
          ministry._id as Types.ObjectId,
        );
      }

      // Step 6: Parse dates
      let dateOfBirth: Date | undefined;
      if (mappedData.dateOfBirth) {
        dateOfBirth = new Date(mappedData.dateOfBirth);
        if (isNaN(dateOfBirth.getTime())) {
          return {
            success: false,
            errors: ['Invalid date format for Date of Birth. Use YYYY-MM-DD format.'],
          };
        }
      }

      let dateJoined: Date | undefined;
      if (mappedData.dateJoined) {
        dateJoined = new Date(mappedData.dateJoined);
        if (isNaN(dateJoined.getTime())) {
          dateJoined = new Date(); // Default to now if invalid
        }
      }

      // Step 7: Generate temporary password
      const tempPassword = this.generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Step 8: Prepare address
      const address = mappedData.address || {
        street: '',
        city: '',
        state: 'Lagos',
        country: 'Nigeria',
      };
      if (!address.state) address.state = 'Lagos';
      if (!address.country) address.country = 'Nigeria';

      // Step 9: Create the member
      const additionalGroups: Types.ObjectId[] = [];
      if (ministry) {
        additionalGroups.push(ministry._id as Types.ObjectId);
      }

      const memberData: any = {
        firstName: mappedData.firstName,
        lastName: mappedData.lastName,
        email: mappedData.email,
        phone: mappedData.phone,
        gender: mappedData.gender,
        dateOfBirth,
        maritalStatus: mappedData.maritalStatus || 'single',
        membershipStatus: mappedData.membershipStatus || MembershipStatus.MEMBER,
        address,
        dateJoined: dateJoined || new Date(),
        branch: branchId,
        district: district?._id,
        unit: unit?._id,
        additionalGroups,
        occupation: mappedData.occupation,
        password: hashedPassword,
        systemRoles: [UserRole.MEMBER],
        isActive: true,
      };

      const member = new this.memberModel(memberData);
      await member.save();

      const memberId = member._id as Types.ObjectId;

      // Step 10: Add member to group member lists and assign leadership roles
      const leadershipAssignments: string[] = [];

      // Add to district and handle district leadership
      if (district) {
        await this.addMemberToGroup(district._id as Types.ObjectId, memberId);

        // Associate Pastors automatically become District Heads
        if (mappedData.leadershipRole === 'associate_pastor') {
          await this.groupModel.findByIdAndUpdate(district._id, {
            districtPastor: memberId,
          });
          leadershipAssignments.push(`District Head of ${district.name}`);

          // Also add to member's assigned districts
          await this.memberModel.findByIdAndUpdate(memberId, {
            $addToSet: { assignedDistricts: district._id },
          });
        }

        // District Champs are assistants (tracked as regular members for now)
        if (mappedData.districtRole === 'district_champ') {
          leadershipAssignments.push(`District Champ of ${district.name}`);
        }
      }

      // Add to ministry and handle ministry leadership
      if (ministry) {
        await this.addMemberToGroup(ministry._id as Types.ObjectId, memberId);

        if (mappedData.ministryRole === 'director') {
          await this.groupModel.findByIdAndUpdate(ministry._id, {
            ministryDirector: memberId,
          });
          leadershipAssignments.push(`Ministry Director of ${ministry.name}`);
        }
      }

      // Add to unit and handle unit leadership
      if (unit) {
        await this.addMemberToGroup(unit._id as Types.ObjectId, memberId);

        if (mappedData.unitRole === 'head') {
          await this.groupModel.findByIdAndUpdate(unit._id, {
            unitHead: memberId,
          });
          leadershipAssignments.push(`Unit Head of ${unit.name}`);
        } else if (mappedData.unitRole === 'assistant_head') {
          await this.groupModel.findByIdAndUpdate(unit._id, {
            assistantUnitHead: memberId,
          });
          leadershipAssignments.push(`Assistant Unit Head of ${unit.name}`);
        }
      }

      this.logger.debug(
        `Created member ${memberId}: ${member.firstName} ${member.lastName}` +
        (leadershipAssignments.length > 0 ? ` [${leadershipAssignments.join(', ')}]` : ''),
      );

      return {
        success: true,
        entityId: memberId.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to create member: ${error.message}`);
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Find or create a group by name and type
   */
  private async findOrCreateGroup(
    name: string,
    type: GroupType,
    branchId: Types.ObjectId,
  ): Promise<GroupDocument> {
    // Try to find existing group (case-insensitive)
    let group = await this.groupModel.findOne({
      name: { $regex: new RegExp(`^${this.escapeRegex(name)}$`, 'i') },
      type,
      branch: branchId,
      isActive: true,
    });

    if (!group) {
      // Create new group
      group = new this.groupModel({
        name,
        type,
        branch: branchId,
        members: [],
        linkedUnits: [],
        goals: [],
        currentMemberCount: 0,
        isActive: true,
      });
      await group.save();
      this.logger.debug(`Created ${type}: ${name}`);
    }

    return group;
  }

  /**
   * Find or create a unit and link it to a ministry
   */
  private async findOrCreateUnit(
    name: string,
    branchId: Types.ObjectId,
    ministryId: Types.ObjectId,
  ): Promise<GroupDocument> {
    // Try to find existing unit
    let unit = await this.groupModel.findOne({
      name: { $regex: new RegExp(`^${this.escapeRegex(name)}$`, 'i') },
      type: GroupType.UNIT,
      branch: branchId,
      isActive: true,
    });

    if (!unit) {
      // Create new unit
      unit = new this.groupModel({
        name,
        type: GroupType.UNIT,
        branch: branchId,
        members: [],
        linkedUnits: [],
        goals: [],
        currentMemberCount: 0,
        isActive: true,
      });
      await unit.save();
      this.logger.debug(`Created unit: ${name}`);
    }

    // Ensure unit is linked to the ministry
    await this.groupModel.findByIdAndUpdate(
      ministryId,
      { $addToSet: { linkedUnits: unit._id } },
    );

    return unit;
  }

  /**
   * Add member to a group's member list
   */
  private async addMemberToGroup(
    groupId: Types.ObjectId,
    memberId: Types.ObjectId,
  ): Promise<void> {
    await this.groupModel.findByIdAndUpdate(groupId, {
      $addToSet: { members: memberId },
      $inc: { currentMemberCount: 1 },
    });
  }

  /**
   * Generate a temporary password
   */
  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getSampleCsvHeaders(): string[] {
    return [
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Gender',
      'Date Of Birth',
      'Marital Status',
      'Member Status',
      'Street',
      'City',
      'State',
      'Country',
      'Date Joined',
      'Campus',
      'Leadership Role',
      'District',
      'District Role',
      'Ministry',
      'Ministry Role',
      'Unit',
      'Unit Role',
      'Occupation',
    ];
  }

  getSampleCsvRow(): string[] {
    return [
      'John',
      'Adebayo',
      'john.adebayo@email.com',
      '+2348012345678',
      'Male',
      '1985-03-15',
      'Married',
      'DC',
      '12 Victoria Island',
      'Lagos',
      'Lagos',
      'Nigeria',
      '2020-01-15',
      'Main Campus',
      'Associate Pastor',
      'Lekki District',
      '',
      'Media Ministry',
      'Ministry Director',
      'Sound Unit',
      'Unit Head',
      'Software Engineer',
    ];
  }
}
