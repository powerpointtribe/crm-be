import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  CourseModule,
  CourseModuleDocument,
} from './schemas/course-module.schema';
import { Lesson, LessonDocument } from './schemas/lesson.schema';
import {
  LessonProgress,
  LessonProgressDocument,
} from './schemas/lesson-progress.schema';
import { Event, EventDocument } from '../events/schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationDocument,
} from '../events/schemas/event-registration.schema';
import {
  EventSession,
  EventSessionDocument,
} from '../events/schemas/event-session.schema';
import {
  SessionAttendance,
  SessionAttendanceDocument,
} from '../events/schemas/session-attendance.schema';
import { PortalAccountDocument } from '../portal/schemas/portal-account.schema';
import {
  CreateLessonDto,
  CreateModuleDto,
  UpdateLessonDto,
  UpdateModuleDto,
} from './dto/lms.dto';

@Injectable()
export class LmsService {
  constructor(
    @InjectModel(CourseModule.name)
    private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(LessonProgress.name)
    private readonly progressModel: Model<LessonProgressDocument>,
    @InjectModel(Event.name)
    private readonly eventModel: Model<EventDocument>,
    @InjectModel(EventRegistration.name)
    private readonly registrationModel: Model<EventRegistrationDocument>,
    @InjectModel(EventSession.name)
    private readonly sessionModel: Model<EventSessionDocument>,
    @InjectModel(SessionAttendance.name)
    private readonly attendanceModel: Model<SessionAttendanceDocument>,
  ) {}

  // ===================== FACILITATOR (content authoring) =====================

  private async assertEvent(eventId: string): Promise<EventDocument> {
    const event = await this.eventModel.findById(eventId);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async listModules(eventId: string) {
    await this.assertEvent(eventId);
    const eventOid = new Types.ObjectId(eventId);
    const [modules, lessons] = await Promise.all([
      this.moduleModel.find({ event: eventOid }).sort({ order: 1 }).lean(),
      this.lessonModel.find({ event: eventOid }).sort({ order: 1 }).lean(),
    ]);
    return modules.map((m) => ({
      ...m,
      lessons: lessons.filter((l) => String(l.module) === String(m._id)),
    }));
  }

  async createModule(eventId: string, dto: CreateModuleDto) {
    const event = await this.assertEvent(eventId);
    const order =
      dto.order ??
      (await this.moduleModel.countDocuments({ event: event._id }));
    return this.moduleModel.create({
      event: event._id,
      title: dto.title,
      description: dto.description,
      order,
      status: dto.status || 'draft',
    });
  }

  async updateModule(moduleId: string, dto: UpdateModuleDto) {
    const mod = await this.moduleModel.findByIdAndUpdate(
      moduleId,
      { $set: dto },
      { new: true },
    );
    if (!mod) throw new NotFoundException('Module not found');
    return mod;
  }

  async deleteModule(moduleId: string) {
    const mod = await this.moduleModel.findByIdAndDelete(moduleId);
    if (!mod) throw new NotFoundException('Module not found');
    await this.lessonModel.deleteMany({ module: mod._id });
    return { success: true };
  }

  async createLesson(moduleId: string, dto: CreateLessonDto) {
    const mod = await this.moduleModel.findById(moduleId);
    if (!mod) throw new NotFoundException('Module not found');
    const order =
      dto.order ?? (await this.lessonModel.countDocuments({ module: mod._id }));
    const resources = (dto.resources || []).map((r) => ({
      id: r.id || randomBytes(6).toString('hex'),
      title: r.title,
      type: r.type,
      url: r.url,
    }));
    return this.lessonModel.create({
      event: mod.event,
      module: mod._id,
      title: dto.title,
      summary: dto.summary,
      content: dto.content,
      order,
      durationMinutes: dto.durationMinutes,
      resources,
      reflectionPrompt: dto.reflectionPrompt,
      status: dto.status || 'draft',
    });
  }

  async updateLesson(lessonId: string, dto: UpdateLessonDto) {
    const update: any = { ...dto };
    if (dto.resources) {
      update.resources = dto.resources.map((r) => ({
        id: r.id || randomBytes(6).toString('hex'),
        title: r.title,
        type: r.type,
        url: r.url,
      }));
    }
    const lesson = await this.lessonModel.findByIdAndUpdate(
      lessonId,
      { $set: update },
      { new: true },
    );
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async deleteLesson(lessonId: string) {
    const lesson = await this.lessonModel.findByIdAndDelete(lessonId);
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.progressModel.deleteMany({ lesson: lesson._id });
    return { success: true };
  }

  // ===================== STUDENT (portal) =====================

  /** Resolve the learner's accepted registration for an event slug. */
  private async resolveLearner(account: PortalAccountDocument, eventSlug?: string) {
    const eventFilter: any = {};
    if (eventSlug) eventFilter.registrationSlug = eventSlug;
    const event = await this.eventModel.findOne(
      eventSlug ? { registrationSlug: eventSlug } : eventFilter,
    );
    if (!event) throw new NotFoundException('Event not found');

    const registration = await this.registrationModel.findOne({
      event: event._id,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) {
      throw new ForbiddenException(
        'You have not been accepted into this programme.',
      );
    }
    return { event, registration };
  }

  /**
   * Sequential gating: a published module is unlocked only when the preceding
   * published module is fully completed by the learner. Returns the ordered
   * published modules plus a per-module map of { total, done, complete, locked }.
   * Empty modules count as complete so they never block what follows.
   */
  private async computeModuleProgress(
    eventOid: Types.ObjectId,
    registrationId: Types.ObjectId,
  ) {
    const [modules, lessons, completed] = await Promise.all([
      this.moduleModel
        .find({ event: eventOid, status: 'published' })
        .sort({ order: 1 })
        .lean(),
      this.lessonModel
        .find({ event: eventOid, status: 'published' })
        .select('_id module')
        .lean(),
      this.progressModel
        .find({ registration: registrationId, status: 'completed' })
        .select('lesson')
        .lean(),
    ]);

    const completedSet = new Set(completed.map((p) => String(p.lesson)));
    const lessonsByModule: Record<string, string[]> = {};
    for (const l of lessons) {
      const m = String(l.module);
      (lessonsByModule[m] ||= []).push(String(l._id));
    }

    const map: Record<
      string,
      { total: number; done: number; complete: boolean; locked: boolean }
    > = {};
    let prevComplete = true; // first module is always unlocked
    for (const m of modules) {
      const mid = String(m._id);
      const ids = lessonsByModule[mid] || [];
      const done = ids.filter((id) => completedSet.has(id)).length;
      const complete = ids.length === 0 ? true : done === ids.length;
      const locked = !prevComplete;
      map[mid] = { total: ids.length, done, complete, locked };
      // A locked module never unlocks the next one — even if its lessons were
      // completed earlier. The chain is strictly sequential.
      prevComplete = !locked && complete;
    }
    return { modules, map };
  }

  async getCurriculum(account: PortalAccountDocument, eventSlug?: string) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    const [lessons, { modules, map }] = await Promise.all([
      this.lessonModel
        .find({ event: event._id, status: 'published' })
        .sort({ order: 1 })
        .select('-content')
        .lean(),
      this.computeModuleProgress(
        event._id as Types.ObjectId,
        registration._id as Types.ObjectId,
      ),
    ]);
    return {
      event: { id: event._id, title: event.title, slug: event.registrationSlug },
      modules: modules.map((m) => {
        const meta = map[String(m._id)] || {
          total: 0,
          done: 0,
          complete: false,
          locked: false,
        };
        return {
          id: m._id,
          title: m.title,
          description: m.description,
          order: m.order,
          locked: meta.locked,
          completed: meta.complete,
          lessonsCompleted: meta.done,
          lessonCount: meta.total,
          lessons: lessons
            .filter((l) => String(l.module) === String(m._id))
            .map((l) => ({
              id: l._id,
              title: l.title,
              summary: l.summary,
              order: l.order,
              durationMinutes: l.durationMinutes,
              resourceCount: (l.resources || []).length,
            })),
        };
      }),
    };
  }

  async getLesson(account: PortalAccountDocument, lessonId: string) {
    const lesson = await this.lessonModel.findOne({
      _id: lessonId,
      status: 'published',
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    // Verify the learner is accepted for this lesson's event.
    const registration = await this.registrationModel.findOne({
      event: lesson.event,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) throw new ForbiddenException('Not enrolled.');

    // Sequential gating: block lessons whose module is still locked.
    const { map } = await this.computeModuleProgress(
      lesson.event as Types.ObjectId,
      registration._id as Types.ObjectId,
    );
    if (map[String(lesson.module)]?.locked) {
      throw new ForbiddenException(
        'Complete the previous module to unlock this lesson.',
      );
    }

    const progress = await this.progressModel
      .findOne({ registration: registration._id, lesson: lesson._id })
      .lean();

    return {
      lesson,
      progress: progress
        ? {
            status: progress.status,
            completedAt: progress.completedAt,
            reflection: progress.reflection || '',
          }
        : { status: 'not_started', reflection: '' },
    };
  }

  async getProgress(account: PortalAccountDocument, eventSlug?: string) {
    const { registration } = await this.resolveLearner(account, eventSlug);
    const entries = await this.progressModel
      .find({ registration: registration._id })
      .lean();
    const progress: Record<string, any> = {};
    for (const e of entries) {
      progress[String(e.lesson)] = {
        status: e.status,
        completed: e.status === 'completed',
        completedAt: e.completedAt,
        reflection: e.reflection || '',
      };
    }
    return { progress };
  }

  async setProgress(
    account: PortalAccountDocument,
    eventSlug: string | undefined,
    lessonId: string,
    completed?: boolean,
  ) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    const status = completed ? 'completed' : 'in_progress';
    await this.progressModel.updateOne(
      { registration: registration._id, lesson: new Types.ObjectId(lessonId) },
      {
        $set: {
          event: event._id,
          status,
          completedAt: completed ? new Date() : undefined,
        },
        $setOnInsert: { registration: registration._id },
      },
      { upsert: true },
    );
    return { success: true, status };
  }

  async saveReflection(
    account: PortalAccountDocument,
    eventSlug: string | undefined,
    lessonId: string,
    content: string,
  ) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    await this.progressModel.updateOne(
      { registration: registration._id, lesson: new Types.ObjectId(lessonId) },
      {
        $set: { event: event._id, reflection: content },
        $setOnInsert: { registration: registration._id, status: 'in_progress' },
      },
      { upsert: true },
    );
    return { success: true };
  }

  // ===================== STUDENT: sessions & attendance =====================

  async getSessions(account: PortalAccountDocument, eventSlug?: string) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    const [sessions, attendance] = await Promise.all([
      this.sessionModel
        .find({ event: event._id })
        .sort({ order: 1, date: 1 })
        .lean(),
      this.attendanceModel.find({ registration: registration._id }).lean(),
    ]);
    const bySession: Record<string, any> = {};
    for (const a of attendance) bySession[String(a.session)] = a;

    return {
      sessions: sessions.map((s) => {
        const a = bySession[String(s._id)];
        return {
          id: s._id,
          title: s.title,
          description: s.description,
          order: s.order,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
          joinLink: s.location?.virtualLink || '',
          isVirtual: !!s.location?.isVirtual,
          myAttendance: a
            ? { status: a.status, checkInTime: a.checkInTime }
            : { status: 'absent' },
        };
      }),
    };
  }

  async checkIn(account: PortalAccountDocument, sessionId: string) {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');

    const registration = await this.registrationModel.findOne({
      event: session.event,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) throw new ForbiddenException('Not enrolled.');

    await this.attendanceModel.updateOne(
      { session: session._id, registration: registration._id },
      {
        $set: {
          event: session.event,
          status: 'present',
          checkInTime: new Date(),
        },
        $setOnInsert: {
          session: session._id,
          registration: registration._id,
        },
      },
      { upsert: true },
    );
    return { success: true, status: 'present' };
  }

  // ===================== FACILITATOR: engagement analytics =====================

  async getEngagement(eventId: string) {
    await this.assertEvent(eventId);
    const eventOid = new Types.ObjectId(eventId);

    const [regs, lessonCount, sessionCount, progresses, attendances] =
      await Promise.all([
        this.registrationModel
          .find({ event: eventOid, admissionStatus: 'accepted' })
          .lean(),
        this.lessonModel.countDocuments({ event: eventOid, status: 'published' }),
        this.sessionModel.countDocuments({ event: eventOid }),
        this.progressModel.find({ event: eventOid }).lean(),
        this.attendanceModel
          .find({ event: eventOid, status: { $in: ['present', 'late'] } })
          .lean(),
      ]);

    const completedByReg: Record<string, number> = {};
    const reflectionsByReg: Record<string, number> = {};
    for (const p of progresses) {
      const k = String(p.registration);
      if (p.status === 'completed')
        completedByReg[k] = (completedByReg[k] || 0) + 1;
      if (p.reflection && p.reflection.trim())
        reflectionsByReg[k] = (reflectionsByReg[k] || 0) + 1;
    }
    const presentByReg: Record<string, number> = {};
    for (const a of attendances) {
      const k = String(a.registration);
      presentByReg[k] = (presentByReg[k] || 0) + 1;
    }

    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

    const learners = regs.map((r) => {
      const k = String(r._id);
      const completed = completedByReg[k] || 0;
      const present = presentByReg[k] || 0;
      return {
        registrationId: r._id,
        name: `${r.attendeeInfo?.firstName || ''} ${r.attendeeInfo?.lastName || ''}`.trim(),
        email: r.attendeeInfo?.email,
        checkInCode: r.checkInCode,
        lessonsCompleted: completed,
        progressPercent: pct(completed, lessonCount),
        sessionsAttended: present,
        attendancePercent: pct(present, sessionCount),
        reflections: reflectionsByReg[k] || 0,
      };
    });

    return {
      totals: {
        accepted: regs.length,
        lessons: lessonCount,
        sessions: sessionCount,
      },
      learners: learners.sort((a, b) => b.progressPercent - a.progressPercent),
    };
  }
}
