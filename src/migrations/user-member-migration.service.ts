import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Member as OldMember, MemberDocument } from '../members/schemas/member.schema';
import { Member as NewMember, MemberDocument as NewMemberDocument } from '../members/schemas/member-unified.schema';
import { UserRole } from '../common/enums/user-roles.enums';
import { MembershipStatus } from '../common/enums/member-status.enum';

interface MigrationResult {
  migratedUsers: number;
  migratedMembers: number;
  orphanedUsers: number;
  orphanedMembers: number;
  errors: string[];
}

@Injectable()
export class UserMemberMigrationService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel('OldMember') private oldMemberModel: Model<MemberDocument>,
    @InjectModel('NewMember') private newMemberModel: Model<NewMemberDocument>,
  ) {}

  async migrateData(): Promise<MigrationResult> {
    const result: MigrationResult = {
      migratedUsers: 0,
      migratedMembers: 0,
      orphanedUsers: 0,
      orphanedMembers: 0,
      errors: [],
    };

    try {
      console.log('Starting User-Member migration...');

      // 1. Get all users and members
      const users = await this.userModel.find().lean();
      const members = await this.oldMemberModel.find().lean();

      console.log(`Found ${users.length} users and ${members.length} members`);

      // 2. Create mapping by email
      const usersByEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));
      const membersByEmail = new Map(members.map(m => [m.email.toLowerCase(), m]));

      // 3. Process users and merge with member data
      for (const user of users) {
        try {
          const existingMember = membersByEmail.get(user.email.toLowerCase());

          const newMemberData = {
            // From User (Authentication data)
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            password: user.password,
            phone: user.phone || '',
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            systemRoles: user.roles,

            // From Member (if exists - Church data)
            ...(existingMember && {
              dateOfBirth: existingMember.dateOfBirth,
              gender: existingMember.gender,
              maritalStatus: existingMember.maritalStatus,
              address: existingMember.address,
              membershipStatus: existingMember.membershipStatus,
              dateJoined: existingMember.dateJoined,
              baptismDate: existingMember.baptismDate,
              confirmationDate: existingMember.confirmationDate,
              district: existingMember.district,
              unit: existingMember.unit,
              additionalGroups: existingMember.additionalGroups || [],
              leadershipRoles: existingMember.leadershipRoles,
              ministries: existingMember.ministries || [],
              skills: existingMember.skills || [],
              occupation: existingMember.occupation,
              workAddress: existingMember.workAddress,
              spouse: existingMember.spouse,
              children: existingMember.children || [],
              parent: existingMember.parent,
              emergencyContact: existingMember.emergencyContact,
              spiritualJourney: existingMember.spiritualJourney,
              profilePicture: existingMember.profilePicture,
              notes: existingMember.notes,
              engagement: existingMember.engagement,
            }),

            // Set defaults for missing required fields
            dateOfBirth: existingMember?.dateOfBirth || new Date('1990-01-01'),
            gender: existingMember?.gender || 'male',
            membershipStatus: existingMember?.membershipStatus || MembershipStatus.NEW_CONVERT,
            dateJoined: existingMember?.dateJoined || user.createdAt || new Date(),

            // Map User relationships to Member
            directorOfMinistries: user.directorOfMinistries,

            // Determine unit type based on roles and unit assignment
            unitType: this.determineUnitType(user, existingMember),

            // Initialize empty arrays if not present
            additionalGroups: existingMember?.additionalGroups || [],
            ministries: existingMember?.ministries || [],
            skills: existingMember?.skills || [],
            children: existingMember?.children || [],

            // Initialize default values
            leadershipRoles: existingMember?.leadershipRoles || {
              isDistrictPastor: false,
              isChamp: false,
              isUnitHead: false,
            },

            spiritualJourney: existingMember?.spiritualJourney || {
              foundationClass: { completed: false },
              baptismClass: { completed: false },
              membershipClass: { completed: false },
              leadershipClass: { completed: false },
            },

            engagement: existingMember?.engagement || {
              attendanceCount: 0,
              engagementScore: 0,
            },

            // Timestamps
            createdAt: user.createdAt || new Date(),
            updatedAt: user.updatedAt || new Date(),
          };

          await this.newMemberModel.create(newMemberData);
          result.migratedUsers++;

          console.log(`Migrated user ${user.email} -> member`);
        } catch (error) {
          result.errors.push(`Failed to migrate user ${user.email}: ${error.message}`);
          console.error(`Error migrating user ${user.email}:`, error);
        }
      }

      // 4. Handle orphaned members (members without users)
      for (const member of members) {
        try {
          if (!usersByEmail.has(member.email.toLowerCase())) {
            const newMemberData = {
              // Copy all member data
              ...member,

              // Add required authentication fields with defaults
              password: await bcrypt.hash('ChangeMe123!', 10), // Default password
              systemRoles: [UserRole.MEMBER],
              isActive: true,
              lastLogin: undefined,

              // Ensure required fields have values
              phone: member.phone || '',
              unitType: this.determineUnitTypeFromMember(member),

              // Initialize missing arrays
              additionalGroups: member.additionalGroups || [],
              ministries: member.ministries || [],
              skills: member.skills || [],
              children: member.children || [],

              // Remove old MongoDB _id to let new schema generate it
              _id: undefined,
            };

            await this.newMemberModel.create(newMemberData);
            result.orphanedMembers++;

            console.log(`Migrated orphaned member ${member.email} with default password`);
          }
        } catch (error) {
          result.errors.push(`Failed to migrate orphaned member ${member.email}: ${error.message}`);
          console.error(`Error migrating orphaned member ${member.email}:`, error);
        }
      }

      console.log('Migration completed successfully!');
      console.log(`Results:`, result);

      return result;
    } catch (error) {
      result.errors.push(`Migration failed: ${error.message}`);
      console.error('Migration failed:', error);
      throw error;
    }
  }

  private determineUnitType(user: any, member?: any): string | undefined {
    // If member has unit type, use it
    if (member?.unitType) {
      return member.unitType;
    }

    // Determine based on roles and unit assignments
    if (user.roles.includes(UserRole.DC)) {
      return 'ministry_unit';
    }

    if (user.roles.includes(UserRole.LXL)) {
      return 'leadership_unit';
    }

    // Check if they're in GIA based on unit assignment or ministry
    if (member?.unit || user.unit) {
      // This would need to be checked against actual unit data
      // For now, return undefined and let it be set manually
      return undefined;
    }

    return undefined;
  }

  private determineUnitTypeFromMember(member: any): string | undefined {
    // If member has unit type, use it
    if (member.unitType) {
      return member.unitType;
    }

    // Try to determine from leadership roles
    if (member.leadershipRoles?.isDistrictPastor) {
      return 'district';
    }

    if (member.leadershipRoles?.isUnitHead) {
      return 'leadership_unit';
    }

    // Default to undefined - will need manual assignment
    return undefined;
  }

  async validateMigration(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check if all users have been migrated
      const userCount = await this.userModel.countDocuments();
      const memberCount = await this.oldMemberModel.countDocuments();
      const newMemberCount = await this.newMemberModel.countDocuments();

      console.log(`Validation: ${userCount} users, ${memberCount} old members, ${newMemberCount} new members`);

      if (newMemberCount < userCount) {
        issues.push(`Missing migrated users: expected at least ${userCount}, got ${newMemberCount}`);
      }

      // Check for duplicate emails
      const duplicateEmails = await this.newMemberModel.aggregate([
        { $group: { _id: '$email', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
      ]);

      if (duplicateEmails.length > 0) {
        issues.push(`Found duplicate emails: ${duplicateEmails.map(d => d._id).join(', ')}`);
      }

      // Check for members without passwords
      const membersWithoutPasswords = await this.newMemberModel.countDocuments({ password: { $exists: false } });
      if (membersWithoutPasswords > 0) {
        issues.push(`Found ${membersWithoutPasswords} members without passwords`);
      }

      // Check for members with invalid roles
      const membersWithInvalidRoles = await this.newMemberModel.countDocuments({
        systemRoles: { $exists: false }
      });
      if (membersWithInvalidRoles > 0) {
        issues.push(`Found ${membersWithInvalidRoles} members without system roles`);
      }

      return {
        isValid: issues.length === 0,
        issues
      };
    } catch (error) {
      issues.push(`Validation failed: ${error.message}`);
      return { isValid: false, issues };
    }
  }

  async rollback(): Promise<void> {
    console.log('Rolling back migration...');

    try {
      // Remove all migrated members
      await this.newMemberModel.deleteMany({});
      console.log('Rollback completed successfully');
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    }
  }
}