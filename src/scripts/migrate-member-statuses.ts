import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { MembershipStatus } from '../common/enums/member-status.enum';

/**
 * Migration Script: Update Member Statuses
 *
 * Maps old membership status values to new hierarchical status values:
 * - NEW_CONVERT → MEMBER
 * - WORKER → DC
 * - VOLUNTEER → MEMBER
 * - LEADER → LXL
 * - DISTRICT_PASTOR → PASTOR
 * - CHAMP → DC
 * - UNIT_HEAD → DIRECTOR
 * - INACTIVE → LEFT
 * - TRANSFERRED → LEFT
 *
 * Run with: npm run migrate:member-statuses
 */
async function migrateMemberStatuses() {
  console.log('Starting member status migration...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const memberModel = app.get<Model<MemberDocument>>(getModelToken(Member.name));

  try {
    // Status mapping from old to new
    const statusMapping: Record<string, MembershipStatus> = {
      'NEW': MembershipStatus.MEMBER,
      'NEW_CONVERT': MembershipStatus.MEMBER,
      'DC': MembershipStatus.DC,
      'WORKER': MembershipStatus.DC,
      'volunteer': MembershipStatus.MEMBER,
      'VOLUNTEER': MembershipStatus.MEMBER,
      'LXL': MembershipStatus.LXL,
      'LEADER': MembershipStatus.LXL,
      'district_pastor': MembershipStatus.PASTOR,
      'DISTRICT_PASTOR': MembershipStatus.PASTOR,
      'champ': MembershipStatus.DC,
      'CHAMP': MembershipStatus.DC,
      'unit_head': MembershipStatus.DIRECTOR,
      'UNIT_HEAD': MembershipStatus.DIRECTOR,
      'inactive': MembershipStatus.LEFT,
      'INACTIVE': MembershipStatus.LEFT,
      'transferred': MembershipStatus.LEFT,
      'TRANSFERRED': MembershipStatus.LEFT,
      'DIRECTOR': MembershipStatus.DIRECTOR,
      'PASTOR': MembershipStatus.PASTOR,
      'SENIOR_PASTOR': MembershipStatus.SENIOR_PASTOR,
      'MEMBER': MembershipStatus.MEMBER,
      'LEFT': MembershipStatus.LEFT,
    };

    // Find all members
    const allMembers = await memberModel.find({}).exec();
    console.log(`Total members found: ${allMembers.length}\n`);

    let updatedCount = 0;
    const statusCounts: Record<string, number> = {};

    for (const member of allMembers) {
      const oldStatus = member.membershipStatus as any;
      const newStatus = statusMapping[oldStatus] || MembershipStatus.MEMBER;

      // Track status counts
      if (!statusCounts[newStatus]) {
        statusCounts[newStatus] = 0;
      }
      statusCounts[newStatus]++;

      // Update if status changed
      if (oldStatus !== newStatus) {
        console.log(`Updating ${member.firstName} ${member.lastName}: ${oldStatus} → ${newStatus}`);

        await memberModel.updateOne(
          { _id: member._id },
          { $set: { membershipStatus: newStatus } }
        );

        updatedCount++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`✅ Total members processed: ${allMembers.length}`);
    console.log(`✅ Members updated: ${updatedCount}`);
    console.log(`✅ Members unchanged: ${allMembers.length - updatedCount}`);

    console.log('\n=== Status Distribution ===');
    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`  ${status}: ${count} members (${((count / allMembers.length) * 100).toFixed(1)}%)`);
      });

  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await app.close();
  }
}

migrateMemberStatuses()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
