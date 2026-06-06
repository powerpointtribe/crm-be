import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import {
  ExpenseCategory,
  ExpenseCategoryDocument,
} from '../finance/schemas/expense-category.schema';
import { GroupType } from '../common/enums/group-types.enum';
import { MembershipStatus } from '../common/enums/member-status.enum';
import * as bcrypt from 'bcryptjs';

// Expense categories to seed
const EXPENSE_CATEGORIES = [
  { name: 'Repairs and Maintenance', description: 'Equipment repairs, building maintenance, and general upkeep' },
  { name: "Lead Pastor's Welfare", description: "Expenses related to the Lead Pastor's welfare and support" },
  { name: 'Venue Expenses', description: 'Costs for venue rentals, hall bookings, and related expenses' },
  { name: 'Programme & Events', description: 'Church programs, events, and activities expenses' },
  { name: 'Missions', description: 'Mission trips, outreach programs, and evangelism expenses' },
  { name: 'Monthly Bulk Outflows', description: 'Regular monthly bulk payments and recurring expenses' },
  { name: 'Subscriptions', description: 'Software, services, and other subscription expenses' },
  { name: 'Logistics', description: 'Transportation, delivery, and logistics-related expenses' },
  { name: 'Honorarium', description: 'Guest speakers, ministers, and service honorariums' },
  { name: 'In-Reach', description: 'Internal ministry and member care initiatives' },
  { name: 'Birthdays', description: 'Birthday celebrations and related expenses' },
  { name: 'Capital Expenditure', description: 'Major equipment purchases and capital investments' },
  { name: 'Utilities', description: 'Electricity, water, internet, and other utility bills' },
  { name: 'General Welfare', description: 'Member welfare, benevolence, and support programs' },
  { name: 'Member Celebrations', description: 'Weddings, anniversaries, and member milestone celebrations' },
  { name: 'Others', description: 'Miscellaneous expenses not covered by other categories' },
];

/**
 * Seed script to create initial data for the church management system
 * Creates: Branches, Districts, Units, and Sample Members
 *
 * Run with: npx ts-node src/scripts/seed-data.ts
 */
async function seedData() {
  const logger = new Logger('SeedData');

  logger.log('Starting data seeding...');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Get models directly from Mongoose connection
    const branchModel = app.get('BranchModel') as Model<BranchDocument>;
    const groupModel = app.get('GroupModel') as Model<GroupDocument>;
    const memberModel = app.get('MemberModel') as Model<MemberDocument>;
    const roleModel = app.get('RoleModel') as Model<RoleDocument>;
    const expenseCategoryModel = app.get(
      'ExpenseCategoryModel',
    ) as Model<ExpenseCategoryDocument>;

    // Get default member role
    const memberRole = await roleModel.findOne({ slug: 'member' });
    const districtPastorRole = await roleModel.findOne({ slug: 'district-pastor' });
    const unitHeadRole = await roleModel.findOne({ slug: 'unit-head' });

    if (!memberRole) {
      logger.error('Member role not found. Please run seed:admin first.');
      return;
    }

    // Step 1: Create Main Branch
    logger.log('Step 1: Creating campus...');
    let branch = await branchModel.findOne({ slug: 'main-campus' });

    if (!branch) {
      branch = await branchModel.create({
        name: 'Main Campus',
        slug: 'main-campus',
        description: 'Main church campus',
        address: {
          street: '123 Church Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
        },
        phone: '+234 800 000 0000',
        email: 'main@yourchurch.com',
        isActive: true,
        isMainBranch: true,
        timezone: 'Africa/Lagos',
        serviceTypes: ['Sunday Service', 'Wednesday Service', 'Friday Service'],
      });
      logger.log(`✓ Created branch: ${branch.name}`);
    } else {
      logger.log(`✓ Branch already exists: ${branch.name}`);
    }

    // Step 2: Create Districts
    logger.log('Step 2: Creating districts...');
    const districtNames = [
      'District 1 - Ikeja',
      'District 2 - Lekki',
      'District 3 - Victoria Island',
      'District 4 - Surulere',
      'District 5 - Yaba',
    ];

    const districts: GroupDocument[] = [];
    for (const name of districtNames) {
      let district = await groupModel.findOne({ name, type: GroupType.DISTRICT });

      if (!district) {
        district = await groupModel.create({
          branch: branch._id,
          name,
          type: GroupType.DISTRICT,
          description: `Home cell group - ${name}`,
          isActive: true,
          meetingSchedule: {
            day: 'wednesday',
            time: '6:00 PM',
            location: 'Various Locations',
          },
        });
        logger.log(`  ✓ Created district: ${name}`);
      } else {
        logger.log(`  ✓ District already exists: ${name}`);
      }
      districts.push(district);
    }

    // Step 3: Create Units
    logger.log('Step 3: Creating units...');
    const unitNames = [
      { name: 'Media Unit', description: 'Handles media and technology' },
      { name: 'Choir Unit', description: 'Leads worship and praise' },
      { name: 'Ushering Unit', description: 'Welcomes and seats congregation' },
      { name: 'Protocol Unit', description: 'Handles VIP and security' },
      { name: 'Children Ministry', description: 'Nurtures children in faith' },
      { name: 'Youth Ministry', description: 'Engages young adults' },
      { name: 'Prayer Unit', description: 'Coordinates prayer activities' },
      { name: 'Hospitality Unit', description: 'Handles food and refreshments' },
    ];

    const units: GroupDocument[] = [];
    for (const unitData of unitNames) {
      let unit = await groupModel.findOne({ name: unitData.name, type: GroupType.UNIT });

      if (!unit) {
        unit = await groupModel.create({
          branch: branch._id,
          name: unitData.name,
          type: GroupType.UNIT,
          description: unitData.description,
          isActive: true,
          meetingSchedule: {
            day: 'saturday',
            time: '10:00 AM',
            location: 'Church Building',
          },
        });
        logger.log(`  ✓ Created unit: ${unitData.name}`);
      } else {
        logger.log(`  ✓ Unit already exists: ${unitData.name}`);
      }
      units.push(unit);
    }

    // Step 4: Create Sample Members
    logger.log('Step 4: Creating sample members...');
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    const sampleMembers = [
      // District Pastors
      {
        firstName: 'Pastor',
        lastName: 'Emmanuel',
        email: 'pastor.emmanuel@church.com',
        phone: '+234 801 000 0001',
        dateOfBirth: new Date('1980-03-15'),
        gender: 'male',
        membershipStatus: MembershipStatus.PASTOR,
        role: districtPastorRole?._id || memberRole._id,
        district: districts[0]._id,
        isDistrictPastor: true,
      },
      {
        firstName: 'Pastor',
        lastName: 'Grace',
        email: 'pastor.grace@church.com',
        phone: '+234 801 000 0002',
        dateOfBirth: new Date('1982-07-22'),
        gender: 'female',
        membershipStatus: MembershipStatus.PASTOR,
        role: districtPastorRole?._id || memberRole._id,
        district: districts[1]._id,
        isDistrictPastor: true,
      },
      // Unit Heads
      {
        firstName: 'David',
        lastName: 'Ojo',
        email: 'david.ojo@church.com',
        phone: '+234 802 000 0001',
        dateOfBirth: new Date('1990-05-10'),
        gender: 'male',
        membershipStatus: MembershipStatus.DC,
        role: unitHeadRole?._id || memberRole._id,
        unit: units[0]._id, // Media Unit
        district: districts[0]._id,
        isUnitHead: true,
      },
      {
        firstName: 'Sarah',
        lastName: 'Adeyemi',
        email: 'sarah.adeyemi@church.com',
        phone: '+234 802 000 0002',
        dateOfBirth: new Date('1992-11-25'),
        gender: 'female',
        membershipStatus: MembershipStatus.DC,
        role: unitHeadRole?._id || memberRole._id,
        unit: units[1]._id, // Choir Unit
        district: districts[1]._id,
        isUnitHead: true,
      },
      // Regular Members
      {
        firstName: 'John',
        lastName: 'Okonkwo',
        email: 'john.okonkwo@church.com',
        phone: '+234 803 000 0001',
        dateOfBirth: new Date('1995-01-15'),
        gender: 'male',
        membershipStatus: MembershipStatus.MEMBER,
        role: memberRole._id,
        district: districts[0]._id,
        unit: units[0]._id,
      },
      {
        firstName: 'Mary',
        lastName: 'Bello',
        email: 'mary.bello@church.com',
        phone: '+234 803 000 0002',
        dateOfBirth: new Date('1998-04-20'),
        gender: 'female',
        membershipStatus: MembershipStatus.MEMBER,
        role: memberRole._id,
        district: districts[1]._id,
        unit: units[1]._id,
      },
      {
        firstName: 'Peter',
        lastName: 'Nnamdi',
        email: 'peter.nnamdi@church.com',
        phone: '+234 803 000 0003',
        dateOfBirth: new Date('1988-08-12'),
        gender: 'male',
        membershipStatus: MembershipStatus.LXL,
        role: memberRole._id,
        district: districts[2]._id,
        unit: units[2]._id,
      },
      {
        firstName: 'Ruth',
        lastName: 'Ajayi',
        email: 'ruth.ajayi@church.com',
        phone: '+234 803 000 0004',
        dateOfBirth: new Date('2000-12-05'),
        gender: 'female',
        membershipStatus: MembershipStatus.MEMBER,
        role: memberRole._id,
        district: districts[3]._id,
        unit: units[3]._id,
      },
    ];

    for (const memberData of sampleMembers) {
      const existingMember = await memberModel.findOne({ email: memberData.email });

      if (!existingMember) {
        const { isDistrictPastor, isUnitHead, ...data } = memberData as any;

        const member = await memberModel.create({
          ...data,
          password: hashedPassword,
          branch: branch._id,
          isActive: true,
          address: {
            street: '',
            city: 'Lagos',
            state: 'Lagos',
            country: 'Nigeria',
          },
          dateJoined: new Date(),
        });

        // Assign as district pastor if applicable
        if (isDistrictPastor && memberData.district) {
          await groupModel.findByIdAndUpdate(memberData.district, {
            districtPastor: member._id,
          });
        }

        // Assign as unit head if applicable
        if (isUnitHead && memberData.unit) {
          await groupModel.findByIdAndUpdate(memberData.unit, {
            unitHead: member._id,
          });
        }

        // Add member to district
        if (memberData.district) {
          await groupModel.findByIdAndUpdate(memberData.district, {
            $addToSet: { members: member._id },
          });
        }

        // Add member to unit
        if (memberData.unit) {
          await groupModel.findByIdAndUpdate(memberData.unit, {
            $addToSet: { members: member._id },
          });
        }

        logger.log(`  ✓ Created member: ${memberData.firstName} ${memberData.lastName}`);
      } else {
        logger.log(`  ✓ Member already exists: ${memberData.email}`);
      }
    }

    // Step 5: Create Expense Categories
    logger.log('Step 5: Creating expense categories...');

    // Get or create a system user for createdBy field
    const systemMember = await memberModel.findOne({});
    const createdById = systemMember?._id || new Types.ObjectId();

    for (let i = 0; i < EXPENSE_CATEGORIES.length; i++) {
      const categoryData = EXPENSE_CATEGORIES[i];
      const existingCategory = await expenseCategoryModel.findOne({
        branch: branch._id,
        name: categoryData.name,
      });

      if (!existingCategory) {
        await expenseCategoryModel.create({
          branch: branch._id,
          name: categoryData.name,
          description: categoryData.description,
          isActive: true,
          requiresApproval: true,
          sortOrder: i,
          createdBy: createdById,
        });
        logger.log(`  ✓ Created expense category: ${categoryData.name}`);
      } else {
        logger.log(`  ✓ Expense category already exists: ${categoryData.name}`);
      }
    }

    // Step 6: Display summary
    logger.log('\n=== Seeding Complete ===');
    const branchCount = await branchModel.countDocuments();
    const districtCount = await groupModel.countDocuments({ type: GroupType.DISTRICT });
    const unitCount = await groupModel.countDocuments({ type: GroupType.UNIT });
    const memberCount = await memberModel.countDocuments();
    const expenseCategoryCount = await expenseCategoryModel.countDocuments();

    logger.log(`Branches: ${branchCount}`);
    logger.log(`Districts: ${districtCount}`);
    logger.log(`Units: ${unitCount}`);
    logger.log(`Members: ${memberCount}`);
    logger.log(`Expense Categories: ${expenseCategoryCount}`);
    logger.log('========================\n');

  } catch (error) {
    logger.error('Failed to seed data:', error.message);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the script
seedData()
  .then(() => {
    console.log('✓ Data seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Data seeding failed:', error);
    process.exit(1);
  });
