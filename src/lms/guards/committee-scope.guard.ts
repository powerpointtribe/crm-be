import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CourseModule, CourseModuleDocument } from '../schemas/course-module.schema';
import { Lesson, LessonDocument } from '../schemas/lesson.schema';
import { Event, EventDocument } from '../../events/schemas/event.schema';
import { UserPermissionsService } from '../../roles/services/user-permissions.service';
import { EventsPermission } from '../../events/permissions';

/**
 * Committee scoping for facilitator LMS routes.
 *
 * A Member may author/inspect an event's course only if they are on that
 * event's committee (or are its organizer). Members with a broad management
 * permission (events:delete — admins) bypass the check and may manage any
 * event. The target event is resolved from whichever route param is present:
 * :eventId directly, or :moduleId / :lessonId via their parent event.
 *
 * Runs after JwtAuthGuard (so req.user is populated) and PermissionGuard.
 */
@Injectable()
export class CommitteeScopeGuard implements CanActivate {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    @InjectModel(CourseModule.name)
    private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const member = req.user;
    if (!member) throw new ForbiddenException('Not authenticated.');

    const eventId = await this.resolveEventId(req.params || {});
    if (!eventId) {
      throw new NotFoundException('Could not resolve the event for this route.');
    }

    const event = await this.eventModel
      .findById(eventId)
      .select('committee organizer')
      .lean();
    if (!event) throw new NotFoundException('Event not found.');

    const memberId = String(member._id || member.sub || '');
    const onCommittee = (event.committee || []).some(
      (c: any) => String(c.member) === memberId,
    );
    const isOrganizer = String(event.organizer || '') === memberId;
    if (onCommittee || isOrganizer) return true;

    // Admin bypass: anyone who can delete events manages all of them.
    if (member.role) {
      const perms = await this.userPermissionsService.getUserPermissions(
        member.role._id || member.role,
      );
      if (perms.permissions?.includes(EventsPermission.DELETE_EVENT)) {
        return true;
      }
    }

    throw new ForbiddenException(
      'You can only manage events you are on the committee of.',
    );
  }

  private async resolveEventId(params: any): Promise<string | null> {
    if (params.eventId) return params.eventId;
    if (params.moduleId) {
      const m = await this.moduleModel
        .findById(params.moduleId)
        .select('event')
        .lean();
      return m ? String(m.event) : null;
    }
    if (params.lessonId) {
      const l = await this.lessonModel
        .findById(params.lessonId)
        .select('event')
        .lean();
      return l ? String(l.event) : null;
    }
    return null;
  }
}
