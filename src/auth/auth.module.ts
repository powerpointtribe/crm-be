import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MembersModule } from '../members/members.module';
import { AccessControlService } from '../common/services/access-control.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ModuleAccessGuard } from './guards/module-access.guard';

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
    MembersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessControlService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    ModuleAccessGuard,
  ],
  exports: [
    AuthService,
    AccessControlService,
    JwtAuthGuard,
    RolesGuard,
    ModuleAccessGuard,
  ],
})
export class AuthModule {}
