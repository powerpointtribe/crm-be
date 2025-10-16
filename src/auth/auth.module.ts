import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthUnifiedService } from './auth-unified.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MembersModule } from '../members/members.module';
import { AccessControlService } from '../common/services/access-control.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ModuleAccessGuard } from './guards/module-access.guard';
import { User } from 'src/users/schemas/user.schema';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '7d'),
        },
      }),
    }),
    UsersModule,
    MembersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService, // Keep for backward compatibility during migration
    AuthUnifiedService, // New unified service
    AccessControlService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    ModuleAccessGuard,
  ],
  exports: [
    AuthService,
    AuthUnifiedService,
    AccessControlService,
    JwtAuthGuard,
    RolesGuard,
    ModuleAccessGuard,
  ],
})
export class AuthModule {}
