import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument } from '../../groups/schemas/group.schema';
import { GroupType } from '../enums/group-types.enum';
import { Member } from '../../members/schemas/member.schema';

export interface RequestWithUserUnit extends Request {
  user: Member;
  userUnit?: Group;
}

@Injectable()
export class UserUnitMiddleware implements NestMiddleware {
  constructor(@InjectModel(Group.name) private groupModel: Model<GroupDocument>) {}

  async use(req: RequestWithUserUnit, res: Response, next: NextFunction) {
    // Use the member's unit field directly
    if (req.user && req.user.unit) {
      try {
        const unit = await this.groupModel.findOne({
          _id: req.user.unit,
          type: GroupType.UNIT,
        });
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
