// Test-only helper. The "-spec.ts" suffix keeps it out of the production build
// (tsconfig.build.json excludes **/*spec.ts) without being picked up as a test.
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { MembersService } from '../members/members.service';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import {
  Permission,
  PermissionSchema,
} from '../roles/schemas/permission.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { UserPermissionsService } from '../roles/services/user-permissions.service';

export const TEST_JWT_SECRET = 'integration-test-secret';

/**
 * Real staff auth for integration specs: JwtStrategy + PermissionGuard +
 * UserPermissionsService run unchanged against real Role/Permission documents.
 * Only the member lookup is in memory. Import PassportModule in the test
 * module and add `harness.providers`.
 */
export function staffAuthHarness(connection: Connection) {
  const roleModel = connection.model(Role.name, RoleSchema);
  const permissionModel = connection.model(Permission.name, PermissionSchema);
  const memberModel = connection.model(Member.name, MemberSchema);
  const members = new Map<string, Record<string, unknown>>();
  const jwt = new JwtService({ secret: TEST_JWT_SECRET });
  let n = 0;

  const providers: Provider[] = [
    JwtStrategy,
    UserPermissionsService,
    { provide: getModelToken(Role.name), useValue: roleModel },
    { provide: getModelToken(Permission.name), useValue: permissionModel },
    { provide: getModelToken(Member.name), useValue: memberModel },
    {
      provide: ConfigService,
      useValue: {
        get: (k: string, d?: unknown) =>
          k === 'JWT_SECRET' ? TEST_JWT_SECRET : d,
      },
    },
    {
      provide: MembersService,
      useValue: {
        findById: (id: string) =>
          Promise.resolve(members.get(String(id)) ?? null),
      },
    },
  ];

  /** A signed-in staff member whose role has exactly `permissions`. */
  async function staff(
    permissions: string[],
    extra: { membershipStatus?: string } = {},
  ): Promise<{ token: string; id: Types.ObjectId }> {
    n += 1;
    const ids: Types.ObjectId[] = [];
    for (const name of permissions) {
      const [resource, action] = name.split(':');
      const doc = await permissionModel.findOneAndUpdate(
        { name },
        {
          $setOnInsert: {
            name,
            displayName: name,
            module: resource,
            resource,
            action,
            isActive: true,
          },
        },
        { upsert: true, new: true },
      );
      ids.push(doc._id);
    }
    const role = await roleModel.create({
      name: `test-role-${n}`,
      slug: `test-role-${n}`,
      displayName: `Test role ${n}`,
      permissions: ids,
      isActive: true,
    });
    const id = new Types.ObjectId();
    members.set(String(id), {
      _id: id,
      isActive: true,
      role: role._id,
      membershipStatus: extra.membershipStatus,
    });
    return { token: jwt.sign({ sub: id, role: role._id }), id };
  }

  return { providers, staff, members };
}
