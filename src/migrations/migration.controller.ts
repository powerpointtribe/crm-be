// import { Controller, Post, Get, UseGuards, Body } from '@nestjs/common';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../common/decorators/roles.decorator';
// import { UserRole } from '../common/enums/user-roles.enums';
// import { UserMemberMigrationService } from './user-member-migration.service';

// @Controller('migrations')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(UserRole.ADMIN) // Only admins can run migrations
// export class MigrationController {
//   constructor(
//     private readonly migrationService: UserMemberMigrationService,
//   ) {}

//   @Post('user-member/run')
//   async runMigration() {
//     try {
//       const result = await this.migrationService.migrateData();
//       return {
//         success: true,
//         message: 'Migration completed successfully',
//         result,
//       };
//     } catch (error) {
//       return {
//         success: false,
//         message: 'Migration failed',
//         error: error.message,
//       };
//     }
//   }

//   @Get('user-member/validate')
//   async validateMigration() {
//     try {
//       const validation = await this.migrationService.validateMigration();
//       return {
//         success: true,
//         validation,
//       };
//     } catch (error) {
//       return {
//         success: false,
//         message: 'Validation failed',
//         error: error.message,
//       };
//     }
//   }

//   @Post('user-member/rollback')
//   async rollbackMigration(@Body() confirmData: { confirm: boolean }) {
//     if (!confirmData.confirm) {
//       return {
//         success: false,
//         message: 'Rollback not confirmed. Please send { "confirm": true } to proceed.',
//       };
//     }

//     try {
//       await this.migrationService.rollback();
//       return {
//         success: true,
//         message: 'Migration rollback completed successfully',
//       };
//     } catch (error) {
//       return {
//         success: false,
//         message: 'Rollback failed',
//         error: error.message,
//       };
//     }
//   }
// }
