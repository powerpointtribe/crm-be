import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Unit, UnitDocument } from '../../units/schemas/unit.schema';
import { User } from '../../users/schemas/user.schema';

export interface RequestWithUserUnit extends Request {
  user: User;
  userUnit?: Unit;
}

@Injectable()
export class UserUnitMiddleware implements NestMiddleware {
  constructor(@InjectModel(Unit.name) private unitModel: Model<UnitDocument>) {}

  async use(req: RequestWithUserUnit, res: Response, next: NextFunction) {
    if (req.user && req.user.leaderOfUnit) {
      try {
        const unit = await this.unitModel.findById(req.user.leaderOfUnit);
        if (!unit) return next();

        req.userUnit = unit;
      } catch (error) {
        // Log error but don't block request
        console.error('Error fetching user unit:', error);
      }
    }
    next();
  }
}
