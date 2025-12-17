import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Member, MemberDocument } from '../members/schemas/member.schema';

/**
 * Script to fix members with invalid district/unit references
 * Run with: npm run fix-invalid-districts
 */
async function fixInvalidDistricts() {
  console.log('Starting invalid district/unit cleanup...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const memberModel = app.get<Model<MemberDocument>>(getModelToken(Member.name));

  try {
    // Find all members
    const allMembers = await memberModel.find({}).exec();
    console.log(`Total members found: ${allMembers.length}\n`);

    let fixedDistrictCount = 0;
    let fixedUnitCount = 0;
    const invalidMembers: any[] = [];

    for (const member of allMembers) {
      let needsUpdate = false;
      const updates: any = {};

      // Check district field
      if (member.district) {
        const districtValue = member.district.toString();

        // Check if it's a valid ObjectId (24 character hex string)
        if (!Types.ObjectId.isValid(districtValue) || districtValue.length !== 24) {
          console.log(`❌ Member ${member.firstName} ${member.lastName} has invalid district: "${districtValue}"`);
          updates.district = null;
          needsUpdate = true;
          fixedDistrictCount++;

          invalidMembers.push({
            id: member._id,
            name: `${member.firstName} ${member.lastName}`,
            email: member.email,
            invalidDistrict: districtValue
          });
        }
      }

      // Check unit field
      if (member.unit) {
        const unitValue = member.unit.toString();

        // Check if it's a valid ObjectId
        if (!Types.ObjectId.isValid(unitValue) || unitValue.length !== 24) {
          console.log(`❌ Member ${member.firstName} ${member.lastName} has invalid unit: "${unitValue}"`);
          updates.unit = null;
          needsUpdate = true;
          fixedUnitCount++;
        }
      }

      // Update member if needed
      if (needsUpdate) {
        await memberModel.updateOne(
          { _id: member._id },
          { $set: updates }
        );
      }
    }

    console.log('\n=== Cleanup Summary ===');
    console.log(`✅ Fixed ${fixedDistrictCount} invalid district references`);
    console.log(`✅ Fixed ${fixedUnitCount} invalid unit references`);

    if (invalidMembers.length > 0) {
      console.log('\n=== Members with Invalid Districts ===');
      console.log('These members had their districts reset to null:');
      invalidMembers.forEach(m => {
        console.log(`  - ${m.name} (${m.email}) - Was: "${m.invalidDistrict}"`);
      });
      console.log('\n⚠️  Please manually reassign these members to the correct districts.');
    } else {
      console.log('\n✅ No invalid references found!');
    }

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await app.close();
  }
}

fixInvalidDistricts()
  .then(() => {
    console.log('\n✅ Cleanup completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
