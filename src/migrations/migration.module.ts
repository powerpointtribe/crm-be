// import { Module } from '@nestjs/common';
// import { MongooseModule } from '@nestjs/mongoose';
// import { User, UserSchema } from '../users/schemas/user.schema';
// import { Member as OldMember, MemberSchema } from '../members/schemas/member.schema';
// import { Member as NewMember, MemberSchema as NewMemberSchema } from '../members/schemas/member-unified.schema';
// import { MigrationController } from './migration.controller';
// import { UserMemberMigrationService } from './user-member-migration.service';

// @Module({
//   imports: [
//     MongooseModule.forFeature([
//       { name: User.name, schema: UserSchema },
//       { name: 'OldMember', schema: MemberSchema },
//       { name: 'NewMember', schema: NewMemberSchema },
//     ]),
//   ],
//   controllers: [MigrationController],
//   providers: [UserMemberMigrationService],
//   exports: [UserMemberMigrationService],
// })
// export class MigrationModule {}
