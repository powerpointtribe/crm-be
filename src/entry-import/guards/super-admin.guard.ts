import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from '../../roles/schemas/role.schema';
import { UserRole } from '../../common/enums/user-roles.enums';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    @InjectModel(Role.name)
    private roleModel: Model<RoleDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Check systemRoles array first (legacy check)
    if (user.systemRoles?.includes(UserRole.SUPER_ADMIN)) {
      return true;
    }

    // Check the role by looking up the role document
    if (user.role) {
      const roleId = user.role._id || user.role;
      const role = await this.roleModel.findById(roleId).exec();

      if (role && role.slug === 'super-admin') {
        return true;
      }
    }

    throw new ForbiddenException('Super Admin access required');
  }
}
