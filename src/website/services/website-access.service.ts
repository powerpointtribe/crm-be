import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserPermissionsService } from '../../roles/services/user-permissions.service';
import { WebsitePermission } from '../permissions';

type StaffUser = {
  role?: unknown;
  membershipStatus?: string;
};

/** Permission checks that depend on the request body, not just the route. */
@Injectable()
export class WebsiteAccessService {
  constructor(private readonly userPermissions: UserPermissionsService) {}

  async has(user: StaffUser, permission: string): Promise<boolean> {
    const role = user?.role as { _id?: unknown } | undefined;
    const roleId = (role?._id ?? role) as string | undefined;
    if (!roleId) return false;
    try {
      const { permissions } = await this.userPermissions.getUserPermissions(
        String(roleId),
        user.membershipStatus,
      );
      return permissions.includes(permission);
    } catch {
      return false;
    }
  }

  /**
   * Anyone who may create/update content may save drafts. Publishing,
   * scheduling and unpublishing (any change to `status` or `publishAt`, or
   * creating something already published) also need `website:publish-content`.
   */
  async assertCanPublish(
    user: StaffUser,
    dto: { status?: string; publishAt?: Date | null },
    mode: 'create' | 'update',
  ): Promise<void> {
    const touchesPublishing =
      mode === 'update'
        ? dto.status !== undefined || dto.publishAt !== undefined
        : dto.status === 'published' || (dto.publishAt ?? null) !== null;
    if (!touchesPublishing) return;
    if (await this.has(user, WebsitePermission.PUBLISH_CONTENT)) return;
    throw new ForbiddenException(
      `You can save drafts, but publishing needs the '${WebsitePermission.PUBLISH_CONTENT}' permission.`,
    );
  }
}
