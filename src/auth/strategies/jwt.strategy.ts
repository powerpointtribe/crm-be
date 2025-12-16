import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { MembersService } from '../../members/members.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private membersService: MembersService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    const member = await this.membersService.findById(payload.sub);
    if (!member) {
      throw new UnauthorizedException('Invalid token');
    }

    // Ensure user is active
    if (!member.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Ensure user has a role assigned
    if (!member.role) {
      throw new UnauthorizedException('No role assigned to this user. Please contact administrator.');
    }

    return member;
  }
}
