import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PortalAccount,
  PortalAccountDocument,
  PortalAccountStatus,
} from '../schemas/portal-account.schema';

/**
 * Validates learner (LMS) tokens. Distinct from the staff `jwt` strategy:
 * tokens must carry `typ: 'portal'` and resolve to an active PortalAccount.
 */
@Injectable()
export class PortalJwtStrategy extends PassportStrategy(Strategy, 'portal-jwt') {
  constructor(
    configService: ConfigService,
    @InjectModel(PortalAccount.name)
    private readonly accountModel: Model<PortalAccountDocument>,
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
    if (payload?.typ !== 'portal') {
      throw new UnauthorizedException('Invalid token');
    }
    const account = await this.accountModel.findById(payload.sub);
    if (!account || account.status !== PortalAccountStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid or inactive account');
    }
    return account;
  }
}
