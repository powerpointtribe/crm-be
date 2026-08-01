import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eventsDefaults } from '../bulk-email/default-templates/events.defaults';
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
import { Quiz, QuizDocument } from './schemas/quiz.schema';
import {
  QuizAttempt,
  QuizAttemptDocument,
} from './schemas/quiz-attempt.schema';
import { Assignment, AssignmentDocument } from './schemas/assignment.schema';
import { Submission, SubmissionDocument } from './schemas/submission.schema';
import { Event, EventDocument } from '../events/schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationDocument,
} from '../events/schemas/event-registration.schema';
import {
  EventAnnouncement,
  EventAnnouncementDocument,
} from '../events/schemas/event-announcement.schema';
import {
  EventSession,
  EventSessionDocument,
} from '../events/schemas/event-session.schema';
import {
  SessionAttendance,
  SessionAttendanceDocument,
} from '../events/schemas/session-attendance.schema';
import { PortalAccountDocument } from '../portal/schemas/portal-account.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { AiService } from '../ai/ai.service';
import { YoutubeService } from '../youtube/youtube.service';
import { EmailProvider } from '../notifications/providers/email.provider';
import { EmailTemplateResolverService } from '../bulk-email/email-template-resolver.service';
import { ZoomService } from '../zoom/zoom.service';
import { PortalService } from '../portal/portal.service';
import { buildAdmissionLetterPdf } from '../events/utils/admission-letter.pdf';
import {
  CreateAssignmentDto,
  CreateLessonDto,
  CreateModuleDto,
  UpdateAssignmentDto,
  UpdateLessonDto,
  UpdateModuleDto,
  UpsertQuizDto,
} from './dto/lms.dto';
import {
  buildDistribution,
  SCHOOL_FIELD_KEYS,
  SCHOOL_ALIASES,
  HEARD_ABOUT_FIELD_KEYS,
  HEARD_ABOUT_ALIASES,
} from '../events/utils/custom-field-distribution.util';

@Injectable()
export class LmsService {
  constructor(
    @InjectModel(CourseModule.name)
    private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(LessonProgress.name)
    private readonly progressModel: Model<LessonProgressDocument>,
    @InjectModel(Quiz.name)
    private readonly quizModel: Model<QuizDocument>,
    @InjectModel(QuizAttempt.name)
    private readonly quizAttemptModel: Model<QuizAttemptDocument>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
    private readonly aiService: AiService,
    private readonly youtubeService: YoutubeService,
    @InjectModel(Event.name)
    private readonly eventModel: Model<EventDocument>,
    @InjectModel(EventRegistration.name)
    private readonly registrationModel: Model<EventRegistrationDocument>,
    @InjectModel(EventAnnouncement.name)
    private readonly announcementModel: Model<EventAnnouncementDocument>,
    @InjectModel(EventSession.name)
    private readonly sessionModel: Model<EventSessionDocument>,
    @InjectModel(SessionAttendance.name)
    private readonly attendanceModel: Model<SessionAttendanceDocument>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
    private readonly emailProvider: EmailProvider,
    private readonly templateResolver: EmailTemplateResolverService,
    private readonly zoomService: ZoomService,
    private readonly portalService: PortalService,
  ) {}

  private readonly logger = new Logger(LmsService.name);

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

  async reorderModules(eventId: string, orderedIds: string[]) {
    await this.assertEvent(eventId);
    const eventOid = new Types.ObjectId(eventId);
    await Promise.all(
      orderedIds.map((mid, i) =>
        this.moduleModel.updateOne(
          { _id: new Types.ObjectId(mid), event: eventOid },
          { $set: { order: i } },
        ),
      ),
    );
    return { success: true };
  }

  async reorderLessons(moduleId: string, orderedIds: string[]) {
    const mod = await this.moduleModel.findById(moduleId);
    if (!mod) throw new NotFoundException('Module not found');
    await Promise.all(
      orderedIds.map((lid, i) =>
        this.lessonModel.updateOne(
          { _id: new Types.ObjectId(lid), module: mod._id },
          { $set: { order: i } },
        ),
      ),
    );
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
      headerImageUrl: dto.headerImageUrl,
      footerImageUrl: dto.footerImageUrl,
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
    await this.quizModel.deleteMany({ lesson: lesson._id });
    await this.quizAttemptModel.deleteMany({ lesson: lesson._id });
    return { success: true };
  }

  // ===================== FACILITATOR: quizzes =====================

  /** Facilitator view of a lesson's quiz (includes correct answers). */
  async getQuizForLesson(lessonId: string) {
    const quiz = await this.quizModel
      .findOne({ lesson: new Types.ObjectId(lessonId) })
      .lean();
    return { quiz: quiz || null };
  }

  /** Create or replace the quiz for a lesson. */
  async upsertQuiz(lessonId: string, dto: UpsertQuizDto) {
    const lesson = await this.lessonModel.findById(lessonId);
    if (!lesson) throw new NotFoundException('Lesson not found');

    const choiceTypes = ['multiple_choice', 'dropdown', 'checkboxes'];
    const questions = (dto.questions || []).map((q) => {
      const type = q.type || 'multiple_choice';
      const isChoice = choiceTypes.includes(type);
      return {
        id: q.id || randomBytes(6).toString('hex'),
        prompt: q.prompt,
        type,
        options: isChoice ? q.options || [] : [],
        correctIndex: type === 'checkboxes' ? 0 : (q.correctIndex ?? 0),
        correctIndexes: type === 'checkboxes' ? q.correctIndexes || [] : [],
        required: q.required !== false,
        points: q.points ?? 1,
      };
    });

    const quiz = await this.quizModel.findOneAndUpdate(
      { lesson: lesson._id },
      {
        $set: {
          event: lesson.event,
          title: dto.title,
          passingScore: dto.passingScore ?? 70,
          status: dto.status || 'draft',
          questions,
        },
      },
      { new: true, upsert: true },
    );
    return quiz;
  }

  async deleteQuiz(lessonId: string) {
    const lessonOid = new Types.ObjectId(lessonId);
    await this.quizModel.deleteOne({ lesson: lessonOid });
    await this.quizAttemptModel.deleteMany({ lesson: lessonOid });
    return { success: true };
  }

  /** Facilitator review of all learner responses to a lesson's quiz. */
  async getQuizResponses(lessonId: string) {
    const quiz = await this.quizModel
      .findOne({ lesson: new Types.ObjectId(lessonId) })
      .lean();
    if (!quiz) return { quiz: null, attempts: [] };

    const attempts = await this.quizAttemptModel
      .find({ quiz: quiz._id })
      .populate('registration', 'attendeeInfo')
      .sort({ updatedAt: -1 })
      .lean();

    const questions = quiz.questions || [];
    const format = (q: any, resp: any): string => {
      const type = q.type || 'multiple_choice';
      if (type === 'checkboxes') {
        const arr = Array.isArray(resp) ? resp : [];
        return (
          arr
            .map((idx: number) => q.options?.[idx])
            .filter((v: any) => v != null)
            .join(', ') || '—'
        );
      }
      if (type === 'multiple_choice' || type === 'dropdown') {
        return typeof resp === 'number' && resp >= 0
          ? (q.options?.[resp] ?? '—')
          : '—';
      }
      return resp === '' || resp == null ? '—' : String(resp);
    };

    return {
      quiz: {
        id: quiz._id,
        title: quiz.title,
        passingScore: quiz.passingScore,
      },
      attempts: attempts.map((a: any) => ({
        name: `${a.registration?.attendeeInfo?.firstName || ''} ${
          a.registration?.attendeeInfo?.lastName || ''
        }`.trim(),
        email: a.registration?.attendeeInfo?.email,
        score: a.score,
        passed: a.passed,
        gradedTotal: a.total,
        submittedAt: a.updatedAt,
        answers: questions.map((q, i) => ({
          prompt: q.prompt,
          type: q.type || 'multiple_choice',
          value: format(q, (a.responses || [])[i]),
        })),
      })),
    };
  }

  // ===================== FACILITATOR: assignments =====================

  async listAssignments(eventId: string) {
    await this.assertEvent(eventId);
    const eventOid = new Types.ObjectId(eventId);
    const assignments = await this.assignmentModel
      .find({ event: eventOid })
      .sort({ createdAt: -1 })
      .lean();
    const counts = await this.submissionModel.aggregate([
      { $match: { event: eventOid } },
      {
        $group: {
          _id: '$assignment',
          submitted: { $sum: 1 },
          graded: {
            $sum: { $cond: [{ $ne: ['$grade', null] }, 1, 0] },
          },
        },
      },
    ]);
    const byId: Record<string, { submitted: number; graded: number }> = {};
    for (const c of counts)
      byId[String(c._id)] = { submitted: c.submitted, graded: c.graded };
    return assignments.map((a) => ({
      ...a,
      submissionCount: byId[String(a._id)]?.submitted || 0,
      gradedCount: byId[String(a._id)]?.graded || 0,
    }));
  }

  async createAssignment(eventId: string, dto: CreateAssignmentDto) {
    const event = await this.assertEvent(eventId);
    return this.assignmentModel.create({
      event: event._id,
      lesson: dto.lesson ? new Types.ObjectId(dto.lesson) : undefined,
      title: dto.title,
      instructions: dto.instructions,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      maxScore: dto.maxScore ?? 100,
      status: dto.status || 'draft',
    });
  }

  async updateAssignment(assignmentId: string, dto: UpdateAssignmentDto) {
    const update: any = { ...dto };
    if (dto.lesson !== undefined)
      update.lesson = dto.lesson ? new Types.ObjectId(dto.lesson) : undefined;
    if (dto.dueDate !== undefined)
      update.dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    const a = await this.assignmentModel.findByIdAndUpdate(
      assignmentId,
      { $set: update },
      { new: true },
    );
    if (!a) throw new NotFoundException('Assignment not found');
    return a;
  }

  async deleteAssignment(assignmentId: string) {
    const a = await this.assignmentModel.findByIdAndDelete(assignmentId);
    if (!a) throw new NotFoundException('Assignment not found');
    await this.submissionModel.deleteMany({ assignment: a._id });
    return { success: true };
  }

  async listSubmissions(assignmentId: string) {
    const assignment = await this.assignmentModel.findById(assignmentId).lean();
    if (!assignment) throw new NotFoundException('Assignment not found');
    const subs = await this.submissionModel
      .find({ assignment: assignment._id })
      .populate('registration', 'attendeeInfo')
      .sort({ submittedAt: -1 })
      .lean();
    return {
      assignment,
      submissions: subs.map((s: any) => ({
        id: s._id,
        registrationId: s.registration?._id || s.registration,
        name: `${s.registration?.attendeeInfo?.firstName || ''} ${
          s.registration?.attendeeInfo?.lastName || ''
        }`.trim(),
        email: s.registration?.attendeeInfo?.email,
        text: s.text,
        fileUrl: s.fileUrl,
        fileName: s.fileName,
        submittedAt: s.submittedAt,
        grade: s.grade ?? null,
        feedback: s.feedback || '',
        gradedAt: s.gradedAt,
      })),
    };
  }

  async gradeSubmission(
    submissionId: string,
    grade: number,
    feedback?: string,
  ) {
    const s = await this.submissionModel.findByIdAndUpdate(
      submissionId,
      { $set: { grade, feedback, gradedAt: new Date() } },
      { new: true },
    );
    if (!s) throw new NotFoundException('Submission not found');
    return { success: true };
  }

  // ===================== FACILITATOR: AI course generation =====================

  async generateCourseDraft(
    eventId: string,
    params: {
      topic: string;
      audience?: string;
      moduleCount?: number;
      notes?: string;
    },
  ) {
    const event = await this.assertEvent(eventId);
    const schema = {
      type: 'object',
      properties: {
        modules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              lessons: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    summary: { type: 'string' },
                    content: {
                      type: 'string',
                      description:
                        'Lesson body as simple HTML using <p>, <h4>, <ul><li>. No markdown.',
                    },
                    reflectionPrompt: { type: 'string' },
                  },
                  required: ['title', 'summary', 'content'],
                },
              },
            },
            required: ['title', 'lessons'],
          },
        },
      },
      required: ['modules'],
    };
    const moduleCount = params.moduleCount || 4;
    const system =
      'You are an expert instructional designer. Produce a clear, practical course outline. ' +
      'Lesson bodies must be concise, well-structured HTML (only <p>, <h4>, <ul>, <li>, <strong>). Never use markdown.';
    const prompt =
      `Design a course for the programme "${event.title}".\n` +
      `Topic / focus: ${params.topic}\n` +
      (params.audience ? `Audience: ${params.audience}\n` : '') +
      `Create about ${moduleCount} modules, each with 2–4 lessons.\n` +
      (params.notes ? `Additional notes: ${params.notes}\n` : '') +
      'Every lesson needs: a title, a one-line summary, a short HTML body, and a reflection prompt.';

    const draft = await this.aiService.generateJson<{ modules: any[] }>({
      system,
      prompt,
      schema,
      toolName: 'emit_course',
      maxTokens: 8000,
    });
    return draft;
  }

  /** Create AI-drafted modules + lessons as DRAFTS (facilitator reviews/publishes). */
  async applyCourseDraft(
    eventId: string,
    modules: Array<{
      title: string;
      description?: string;
      lessons?: Array<{
        title: string;
        summary?: string;
        content?: string;
        reflectionPrompt?: string;
      }>;
    }>,
  ) {
    const event = await this.assertEvent(eventId);
    let moduleOrder = await this.moduleModel.countDocuments({
      event: event._id,
    });
    let lessonsCreated = 0;
    for (const m of modules || []) {
      if (!m.title?.trim()) continue;
      const mod = await this.moduleModel.create({
        event: event._id,
        title: m.title.trim(),
        description: m.description,
        order: moduleOrder++,
        status: 'draft',
      });
      let lessonOrder = 0;
      for (const l of m.lessons || []) {
        if (!l.title?.trim()) continue;
        await this.lessonModel.create({
          event: event._id,
          module: mod._id,
          title: l.title.trim(),
          summary: l.summary,
          content: l.content,
          reflectionPrompt: l.reflectionPrompt,
          order: lessonOrder++,
          resources: [],
          status: 'draft',
        });
        lessonsCreated += 1;
      }
    }
    return {
      success: true,
      modulesCreated: (modules || []).filter((m) => m.title?.trim()).length,
      lessonsCreated,
    };
  }

  // ===================== STUDENT: AI teaching assistant =====================

  async askAssistant(
    account: PortalAccountDocument,
    params: {
      eventSlug?: string;
      lessonId?: string;
      message: string;
      history?: Array<{ role: string; content: string }>;
    },
  ) {
    const { event } = await this.resolveLearner(account, params.eventSlug);
    const stripHtml = (s: string) =>
      String(s || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    let context = '';
    if (params.lessonId) {
      const lesson = await this.lessonModel
        .findOne({
          _id: new Types.ObjectId(params.lessonId),
          event: event._id,
          status: 'published',
        })
        .lean();
      if (lesson) {
        context = `Current lesson: ${lesson.title}\n${lesson.summary || ''}\n${stripHtml(
          lesson.content || '',
        )}`;
      }
    }
    if (!context) {
      const lessons = await this.lessonModel
        .find({ event: event._id, status: 'published' })
        .select('title summary')
        .sort({ order: 1 })
        .lean();
      context =
        'Course lessons:\n' +
        lessons.map((l) => `- ${l.title}: ${l.summary || ''}`).join('\n');
    }

    const system =
      `You are a warm, encouraging teaching assistant for the programme "${event.title}". ` +
      'Answer the learner using the course material below. If a question is outside the material, ' +
      'say so briefly and give helpful general guidance. Be concise (a few short paragraphs max).\n\n' +
      `COURSE MATERIAL:\n${context.slice(0, 8000)}`;

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...(params.history || []).slice(-8).map((h) => {
        const role: 'user' | 'assistant' =
          h.role === 'assistant' ? 'assistant' : 'user';
        return { role, content: String(h.content || '').slice(0, 2000) };
      }),
      { role: 'user', content: params.message },
    ];

    const reply = await this.aiService.chat({
      system,
      messages,
      maxTokens: 1024,
    });
    return { reply };
  }

  // ===================== STUDENT: assignments =====================

  async getAssignmentsForStudent(
    account: PortalAccountDocument,
    eventSlug?: string,
  ) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    const [assignments, mySubs] = await Promise.all([
      this.assignmentModel
        .find({ event: event._id, status: 'published' })
        .sort({ dueDate: 1, createdAt: -1 })
        .lean(),
      this.submissionModel
        .find({ event: event._id, registration: registration._id })
        .lean(),
    ]);
    const byAssignment: Record<string, any> = {};
    for (const s of mySubs) byAssignment[String(s.assignment)] = s;

    return {
      assignments: assignments.map((a) => {
        const s = byAssignment[String(a._id)];
        return {
          id: a._id,
          title: a.title,
          instructions: a.instructions,
          dueDate: a.dueDate,
          maxScore: a.maxScore,
          lessonId: a.lesson || null,
          submission: s
            ? {
                text: s.text || '',
                fileUrl: s.fileUrl || '',
                fileName: s.fileName || '',
                submittedAt: s.submittedAt,
                grade: s.grade ?? null,
                feedback: s.feedback || '',
              }
            : null,
        };
      }),
    };
  }

  async submitAssignment(
    account: PortalAccountDocument,
    assignmentId: string,
    data: { text?: string; fileUrl?: string; fileName?: string },
  ) {
    const assignment = await this.assignmentModel.findOne({
      _id: new Types.ObjectId(assignmentId),
      status: 'published',
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const registration = await this.registrationModel.findOne({
      event: assignment.event,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) throw new ForbiddenException('Not enrolled.');

    if (!data.text?.trim() && !data.fileUrl?.trim()) {
      throw new BadRequestException(
        'Add some text or attach a file before submitting.',
      );
    }

    await this.submissionModel.updateOne(
      { assignment: assignment._id, registration: registration._id },
      {
        $set: {
          event: assignment.event,
          text: data.text,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          submittedAt: new Date(),
        },
        $setOnInsert: {
          assignment: assignment._id,
          registration: registration._id,
        },
      },
      { upsert: true },
    );
    return { success: true };
  }

  // ===================== STUDENT (portal) =====================

  /** Resolve the learner's accepted registration for an event slug. */
  private async resolveLearner(
    account: PortalAccountDocument,
    eventSlug?: string,
  ) {
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
   * Learner notifications = the event's persisted announcements, newest first,
   * each flagged read/unread against the account's `notificationsReadAt`.
   */
  async getNotifications(account: PortalAccountDocument, eventSlug?: string) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    const list = await this.announcementModel
      .find({ event: event._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const readAt = account.notificationsReadAt
      ? new Date(account.notificationsReadAt).getTime()
      : 0;

    // Personalize {{firstName}}/{{lastName}}/{{email}} for the viewing student.
    const info = registration?.attendeeInfo || ({} as any);
    const vars = {
      firstName: info.firstName || account.firstName || 'there',
      lastName: info.lastName || account.lastName || '',
      email: info.email || account.email || '',
    };

    const items = list.map((a) => {
      const createdAt = (a as any).createdAt as Date;
      return {
        id: String(a._id),
        subject: this.personalizeText(a.subject, vars),
        message: this.personalizeText(a.message, vars),
        senderName: a.senderName || event.title,
        createdAt,
        read: new Date(createdAt).getTime() <= readAt,
      };
    });

    return { items, unread: items.filter((i) => !i.read).length };
  }

  /** Substitute {{firstName}} / {{lastName}} / {{name}} / {{email}} tags with
   *  the viewing student's own details (case/underscore/space tolerant). */
  private personalizeText(
    text: string,
    v: { firstName: string; lastName: string; email: string },
  ): string {
    if (!text) return text;
    return text
      .replace(/\{\{\s*first[\s_]*name\s*\}\}/gi, v.firstName)
      .replace(/\{\{\s*last[\s_]*name\s*\}\}/gi, v.lastName)
      .replace(
        /\{\{\s*(?:full[\s_]*name|name)\s*\}\}/gi,
        `${v.firstName} ${v.lastName}`.trim(),
      )
      .replace(/\{\{\s*email\s*\}\}/gi, v.email);
  }

  /** Mark all of the learner's notifications as read (bell → 0). */
  async markNotificationsRead(account: PortalAccountDocument) {
    account.notificationsReadAt = new Date();
    await account.save();
    return { success: true as const };
  }

  /**
   * Full learner profile for the portal profile page — joins the portal account
   * with the accepted registration (Student ID, cohort, contact details, the
   * headshot they registered with, and progress at a glance).
   */
  async getStudentProfile(account: PortalAccountDocument, eventSlug?: string) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    const info = registration.attendeeInfo || ({} as any);
    const cfr: any = registration.customFieldResponses;
    const cf = (k: string) =>
      (cfr && typeof cfr.get === 'function' ? cfr.get(k) : cfr?.[k]) || null;

    // Course progress at a glance (accepted learner, published lessons only).
    const modules = await this.moduleModel
      .find({ event: event._id, status: 'published' })
      .select('_id')
      .lean();
    const moduleIds = modules.map((m) => m._id);
    const totalLessons = moduleIds.length
      ? await this.lessonModel.countDocuments({
          module: { $in: moduleIds },
          status: 'published',
        })
      : 0;
    const completedLessons = await this.progressModel.countDocuments({
      registration: registration._id,
      status: 'completed',
    });

    return {
      firstName: info.firstName || account.firstName || '',
      lastName: info.lastName || account.lastName || '',
      email: account.email,
      phone: info.phone || null,
      gender: info.gender || null,
      studentId: registration.studentId || null,
      school: cf('university'),
      headshotUrl: cf('headshotUrl'),
      cohort: event.title,
      admissionStatus: registration.admissionStatus,
      acceptedAt: registration.acceptedAt || null,
      registeredAt: registration.registeredAt || null,
      accountStatus: account.status,
      progress: {
        totalLessons,
        completedLessons,
        percent: totalLessons
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0,
      },
    };
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
        .find({
          event: eventOid,
          status: 'published',
          // Session recordings / opt-out lessons don't gate completion.
          excludeFromCompletion: { $ne: true },
          isSessionRecording: { $ne: true },
        })
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
    const [lessons, { modules, map }, sessions] = await Promise.all([
      this.lessonModel
        .find({ event: event._id, status: 'published' })
        .sort({ order: 1 })
        .select('-content')
        .lean(),
      this.computeModuleProgress(
        event._id as Types.ObjectId,
        registration._id as Types.ObjectId,
      ),
      this.sessionModel
        .find({
          event: event._id,
          moduleId: { $ne: null },
          // Hide restricted sessions from learners not on the allow-list.
          $or: [
            { visibility: { $ne: 'restricted' } },
            { allowedRegistrations: registration._id },
          ],
        })
        .select('title date startTime endTime location recording moduleId')
        .lean(),
    ]);

    // One linked session per module — surfaces "Join live" until its recording
    // is published (which then replaces it with the recording lesson).
    const now = new Date();
    const sessionByModule: Record<string, any> = {};
    for (const s of sessions) {
      if (!s.moduleId) continue;
      const mid = String(s.moduleId);
      if (sessionByModule[mid]) continue;
      const joinLink = s.location?.virtualLink || '';
      sessionByModule[mid] = {
        id: s._id,
        title: s.title,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        youtubeVideoId: YoutubeService.extractVideoId(joinLink) || '',
        isLiveNow: this.isWithinLiveWindow(
          s as unknown as EventSessionDocument,
          now,
        ),
        recordingPublished: !!s.recording?.available,
      };
    }

    return {
      event: {
        id: event._id,
        title: event.title,
        slug: event.registrationSlug,
      },
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
          // Linked live session (shown until its recording is published).
          session: sessionByModule[String(m._id)] || null,
          lessons: lessons
            .filter((l) => String(l.module) === String(m._id))
            .map((l) => ({
              id: l._id,
              title: l.title,
              summary: l.summary,
              order: l.order,
              durationMinutes: l.durationMinutes,
              resourceCount: (l.resources || []).length,
              headerImageUrl: l.headerImageUrl || null,
              isSessionRecording: !!l.isSessionRecording,
              // Recordings/optional lessons don't count toward completion.
              countsForCompletion: !l.excludeFromCompletion && !l.isSessionRecording,
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

    // Count this open as a view (powers the facilitator "revisited" metric) and
    // mark the lesson in-progress on first open. $setOnInsert leaves an existing
    // 'completed' status untouched.
    await this.progressModel.updateOne(
      { registration: registration._id, lesson: lesson._id },
      {
        $inc: { viewCount: 1 },
        $set: { event: lesson.event },
        $setOnInsert: { registration: registration._id, status: 'in_progress' },
      },
      { upsert: true },
    );

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

  // ===================== STUDENT: quizzes =====================

  /** Published quiz for a lesson (answers stripped) + the learner's attempt. */
  async getQuizForStudent(account: PortalAccountDocument, lessonId: string) {
    const quiz = await this.quizModel
      .findOne({ lesson: new Types.ObjectId(lessonId), status: 'published' })
      .lean();
    if (!quiz) return { quiz: null };

    const registration = await this.registrationModel.findOne({
      event: quiz.event,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) throw new ForbiddenException('Not enrolled.');

    const attempt = await this.quizAttemptModel
      .findOne({ registration: registration._id, quiz: quiz._id })
      .lean();

    return {
      quiz: {
        id: quiz._id,
        title: quiz.title,
        passingScore: quiz.passingScore,
        questions: (quiz.questions || []).map((q) => ({
          id: q.id,
          prompt: q.prompt,
          type: q.type || 'multiple_choice',
          options: q.options || [],
          required: q.required !== false,
        })),
      },
      attempt: attempt
        ? {
            score: attempt.score,
            passed: attempt.passed,
            attempts: attempt.attempts,
            responses: attempt.responses,
          }
        : null,
    };
  }

  /** Grade a quiz submission, store the attempt, and complete the lesson on pass. */
  async submitQuiz(
    account: PortalAccountDocument,
    lessonId: string,
    responses: any[],
  ) {
    const quiz = await this.quizModel.findOne({
      lesson: new Types.ObjectId(lessonId),
      status: 'published',
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const registration = await this.registrationModel.findOne({
      event: quiz.event,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) throw new ForbiddenException('Not enrolled.');

    // Only choice questions are auto-graded; open answers (text/date/file) are
    // recorded for facilitator review and don't affect the score.
    const choiceTypes = ['multiple_choice', 'dropdown', 'checkboxes'];
    const questions = quiz.questions || [];
    let gradable = 0;
    let correctCount = 0;
    questions.forEach((q, i) => {
      const type = q.type || 'multiple_choice';
      if (!choiceTypes.includes(type)) return;
      gradable += 1;
      const resp = responses[i];
      if (type === 'checkboxes') {
        const sel = (Array.isArray(resp) ? resp : []).map(Number).sort();
        const corr = (q.correctIndexes || []).map(Number).sort();
        if (sel.length === corr.length && sel.every((v, k) => v === corr[k])) {
          correctCount += 1;
        }
      } else if (Number(resp) === q.correctIndex) {
        correctCount += 1;
      }
    });
    const score = gradable ? Math.round((correctCount / gradable) * 100) : 100;
    const passed = gradable ? score >= (quiz.passingScore ?? 70) : true;

    await this.quizAttemptModel.updateOne(
      { registration: registration._id, quiz: quiz._id },
      {
        $set: {
          event: quiz.event,
          lesson: quiz.lesson,
          responses,
          score,
          correctCount,
          total: gradable,
          passed,
        },
        $inc: { attempts: 1 },
      },
      { upsert: true },
    );

    // Passing a quiz completes its lesson (advances the module-lock chain).
    if (passed) {
      await this.progressModel.updateOne(
        { registration: registration._id, lesson: quiz.lesson },
        {
          $set: {
            event: quiz.event,
            status: 'completed',
            completedAt: new Date(),
          },
          $setOnInsert: { registration: registration._id },
        },
        { upsert: true },
      );
    }

    return {
      score,
      passed,
      correctCount,
      total: gradable,
      passingScore: quiz.passingScore ?? 70,
    };
  }

  /**
   * Certificate of completion. Eligible once the learner has completed every
   * published lesson in the event. Returns the data a printable certificate
   * needs; callers render it. Not eligible → { eligible:false, completed, total }.
   */
  async getCertificate(account: PortalAccountDocument, eventSlug?: string) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    const [lessons, completed] = await Promise.all([
      this.lessonModel
        .find({ event: event._id, status: 'published' })
        .select('_id')
        .lean(),
      this.progressModel
        .find({ registration: registration._id, status: 'completed' })
        .select('lesson completedAt')
        .lean(),
    ]);

    const total = lessons.length;
    const completedSet = new Set(completed.map((c) => String(c.lesson)));
    const doneCount = lessons.filter((l) =>
      completedSet.has(String(l._id)),
    ).length;
    const eligible = total > 0 && doneCount === total;

    if (!eligible) {
      return { eligible: false, completed: doneCount, total };
    }

    const times = completed
      .filter((c) => completedSet.has(String(c.lesson)) && c.completedAt)
      .map((c) => new Date(c.completedAt as Date).getTime());
    const completedAt = times.length
      ? new Date(Math.max(...times))
      : new Date();

    const name = `${registration.attendeeInfo?.firstName || ''} ${
      registration.attendeeInfo?.lastName || ''
    }`.trim();
    const code =
      registration.checkInCode ||
      String(registration._id).slice(-6).toUpperCase();

    return {
      eligible: true,
      learnerName: name,
      eventTitle: event.title,
      completedAt,
      lessonsCompleted: doneCount,
      certificateId: `${(event.registrationSlug || 'CERT').toUpperCase()}-${code}`,
    };
  }

  // ===================== STUDENT: sessions & attendance =====================

  async getSessions(account: PortalAccountDocument, eventSlug?: string) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    const [sessions, attendance] = await Promise.all([
      this.sessionModel
        .find({
          event: event._id,
          // Restricted sessions are visible only to allow-listed registrations.
          $or: [
            { visibility: { $ne: 'restricted' } },
            { allowedRegistrations: registration._id },
          ],
        })
        .sort({ order: 1, date: 1 })
        .lean(),
      this.attendanceModel.find({ registration: registration._id }).lean(),
    ]);
    const bySession: Record<string, any> = {};
    for (const a of attendance) bySession[String(a.session)] = a;
    const now = new Date();

    return {
      sessions: sessions.map((s) => {
        const a = bySession[String(s._id)];
        const joinLink = s.location?.virtualLink || '';
        return {
          id: s._id,
          title: s.title,
          description: s.description,
          order: s.order,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
          joinLink,
          // Parsed YouTube id lets the portal embed the stream and track
          // watch-time attendance in-page. Prefers the simulcast link when this
          // is a Zoom session with YouTube overflow configured.
          youtubeVideoId: this.sessionYoutubeId(s),
          // Zoom meeting/webinar embed — when set, the portal shows the Meeting
          // SDK player instead of YouTube (attendance from the Zoom report).
          zoomMeetingId: s.zoomMeetingId || '',
          zoomType: s.zoomType || 'meeting',
          // Facilitator ended the live session → portal shows it as ended even
          // if still within the scheduled window.
          liveEndedAt: s.liveEndedAt || null,
          isVirtual: !!s.location?.isVirtual,
          // Minutes of watch-time required to be marked attended (for the UI).
          presentThresholdMinutes: this.presentThresholdFor(
            s as unknown as EventSessionDocument,
          ),
          // Whether the session's live window is open right now — decides
          // whether watching counts as live or replay ("watched") attendance.
          isLiveNow: this.isWithinLiveWindow(
            s as unknown as EventSessionDocument,
            now,
          ),
          myAttendance: a
            ? {
                status: a.status, // live attendance
                checkInTime: a.checkInTime,
                attendedMinutes: Math.round(a.attendedMinutes || 0),
                liveMinutes: Math.round(a.liveMinutes || 0),
                watched: !!a.watched,
                watchCount: a.watchCount || 0,
              }
            : {
                status: 'absent',
                attendedMinutes: 0,
                liveMinutes: 0,
                watched: false,
                watchCount: 0,
              },
        };
      }),
    };
  }

  // ===================== YouTube live-session attendance =======================
  //
  //  YouTube live viewers are anonymous — there is no participant report like
  //  Zoom's. Instead the trainee portal embeds the stream and pings this
  //  service with watch-time heartbeats; we accumulate `attendedMinutes` per
  //  registrant and derive status from it. `recordWatchHeartbeat` runs live
  //  (immediate feedback); `finalizeSessionAttendance` recomputes the final
  //  present/late/absent after the session for the facilitator.

  // A single heartbeat can never credit more than this many seconds (anti-spoof).
  private readonly MAX_HEARTBEAT_SECONDS = 120;

  // Live Zoom seats to fill before overflowing new viewers to the YouTube
  // simulcast. Sits below the Zoom "Large Meeting 500" hard cap so there's
  // headroom for the concurrency slop in the (unlocked) capacity count.
  private readonly ZOOM_LIVE_CAPACITY = Number(
    process.env.ZOOM_LIVE_CAPACITY || 480,
  );

  // A viewer counts as "currently in Zoom" if they were assigned Zoom and have
  // beaten within this window (also set at assignment, so a fresh assignee
  // counts immediately even before their first heartbeat).
  private readonly ACTIVE_VIEWER_WINDOW_MS = 120_000;

  // Minimum minutes of watch-time to count as attended. Resolved per session:
  // the session's own attendanceConfig.presentThresholdMinutes wins, then the
  // ATTENDANCE_PRESENT_THRESHOLD_MINUTES env default, then 90 (1h30 — the CMIT
  // live-class standard).
  private presentThresholdFor(session: EventSessionDocument): number {
    const perSession = session.attendanceConfig?.presentThresholdMinutes;
    if (perSession && perSession > 0) return perSession;
    const env = Number(process.env.ATTENDANCE_PRESENT_THRESHOLD_MINUTES);
    return env > 0 ? env : 90;
  }

  /** Parse "7:00 PM" / "7:00PM" / "19:00" → [hours24, minutes], or null. */
  private parseHM(time?: string): [number, number] | null {
    const m = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(time || '');
    if (!m) return null;
    let h = Number(m[1]);
    const min = Number(m[2]);
    const mer = m[3]?.toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    return [h, min];
  }

  /** Combine a session's date + startTime into a Date (AM/PM aware). */
  private sessionStart(session: EventSessionDocument): Date | null {
    if (!session.date) return null;
    const hm = this.parseHM(session.startTime);
    if (!hm) return null;
    const start = new Date(session.date);
    start.setHours(hm[0], hm[1], 0, 0);
    return start;
  }

  /** Session's scheduled end (date + endTime), or null if no end time. */
  private sessionEnd(session: EventSessionDocument): Date | null {
    if (!session.date) return null;
    const hm = this.parseHM(session.endTime);
    if (!hm) return null;
    const end = new Date(session.date);
    end.setHours(hm[0], hm[1], 0, 0);
    return end;
  }

  /**
   * Is `at` inside the session's live broadcast window? Watch-time within the
   * scheduled start→end (10 min early grace, 30 min late grace) counts as LIVE
   * attendance; anything outside is a replay ("watched") view only.
   */
  /**
   * Resolve a session's YouTube video id. Prefers the explicit simulcast link
   * (`youtubeStreamUrl`, used for Zoom→YouTube overflow); falls back to the
   * session's join link (legacy YouTube-only sessions). Accepts a full URL or a
   * bare video id.
   */
  private sessionYoutubeId(session: any): string {
    const explicit = (session.youtubeStreamUrl || '').trim();
    if (explicit) return YoutubeService.extractVideoId(explicit) || explicit;
    return YoutubeService.extractVideoId(session.location?.virtualLink || '') || '';
  }

  private isWithinLiveWindow(session: EventSessionDocument, at: Date): boolean {
    const start = this.sessionStart(session);
    if (!start) return false;
    // Facilitator ended the live session early → not live from that point on.
    const endedAt = (session as any).liveEndedAt;
    if (endedAt && at.getTime() >= new Date(endedAt).getTime()) return false;
    const end = this.sessionEnd(session);
    const openFrom = start.getTime() - 10 * 60_000;
    const openTo =
      (end ? end.getTime() : start.getTime() + 3 * 3_600_000) + 30 * 60_000;
    return at.getTime() >= openFrom && at.getTime() <= openTo;
  }

  /** Was `joinedAt` after the session's late-arrival grace window? */
  private isLateJoin(
    session: EventSessionDocument,
    joinedAt?: Date | null,
  ): boolean {
    const start = this.sessionStart(session);
    if (!start || !joinedAt) return false;
    const graceMin =
      session.attendanceConfig?.lateArrivalThresholdMinutes ?? 15;
    return joinedAt.getTime() > start.getTime() + graceMin * 60_000;
  }

  private deriveStatus(
    minutes: number,
    late: boolean,
    thresholdMinutes: number,
  ): 'present' | 'late' | 'absent' {
    // Attendance is only recorded once the watch-time threshold is reached.
    // Below it the learner has NOT attended yet — 'absent' whether the session
    // is still live or being finalized (no "counting counts as present").
    if (minutes < thresholdMinutes) return 'absent';
    // At/above threshold: attended. 'late' only if they joined after the
    // session's late-arrival grace window (e.g. watching a replay long after
    // the scheduled start); otherwise 'present'.
    return late ? 'late' : 'present';
  }

  /**
   * Record a watch-time heartbeat from a trainee watching the embedded live
   * stream. Accumulates minutes and updates their attendance status live.
   */
  /**
   * Decide which player a learner watches this session on. Zoom fills first;
   * once live Zoom seats reach ZOOM_LIVE_CAPACITY, new viewers overflow to the
   * YouTube simulcast. The choice is PINNED per registration (sticky) so a
   * viewer never bounces between players mid-session. Attendance is unaffected
   * either way — the heartbeat is the same for both.
   */
  async getWatchSource(account: PortalAccountDocument, sessionId: string) {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');

    const registration = await this.registrationModel.findOne({
      event: session.event,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) throw new ForbiddenException('Not enrolled.');

    const hasZoom = !!session.zoomMeetingId;
    const youtubeVideoId = this.sessionYoutubeId(session);
    const hasYoutube = !!youtubeVideoId;

    // No overflow configured (no YouTube simulcast) → whatever the session has.
    if (!hasYoutube) return { source: hasZoom ? 'zoom' : 'none' };
    if (!hasZoom) return { source: 'youtube' };

    const now = new Date();

    // Sticky: honour an existing assignment.
    const existing = await this.attendanceModel
      .findOne({ session: session._id, registration: registration._id })
      .select('watchSource')
      .lean();
    if (existing?.watchSource) {
      return { source: existing.watchSource };
    }

    // Count viewers currently occupying a live Zoom seat.
    const activeZoom = await this.attendanceModel.countDocuments({
      session: session._id,
      watchSource: 'zoom',
      lastBeatAt: { $gte: new Date(now.getTime() - this.ACTIVE_VIEWER_WINDOW_MS) },
    });

    const source: 'zoom' | 'youtube' =
      activeZoom < this.ZOOM_LIVE_CAPACITY ? 'zoom' : 'youtube';

    // Pin the assignment (and stamp lastBeatAt so a Zoom assignee counts toward
    // capacity immediately, before their first real heartbeat).
    await this.attendanceModel.updateOne(
      { session: session._id, registration: registration._id },
      {
        $set: { watchSource: source, lastBeatAt: now },
        $setOnInsert: {
          event: session.event,
          session: session._id,
          registration: registration._id,
        },
      },
      { upsert: true },
    );

    return {
      source,
      activeZoom,
      capacity: this.ZOOM_LIVE_CAPACITY,
    };
  }

  async recordWatchHeartbeat(
    account: PortalAccountDocument,
    sessionId: string,
    dto: { seconds?: number; newView?: boolean; source?: 'zoom' | 'youtube' },
  ) {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');

    const registration = await this.registrationModel.findOne({
      event: session.event,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) throw new ForbiddenException('Not enrolled.');

    const now = new Date();
    const isLive = this.isWithinLiveWindow(session, now);
    const threshold = this.presentThresholdFor(session);

    // Cap this beat's credit to the REAL wall-clock elapsed since the last beat
    // (server-side), so a client can't inflate minutes by spamming heartbeats.
    const prior = await this.attendanceModel
      .findOne({ session: session._id, registration: registration._id })
      .select('lastBeatAt')
      .lean();
    let seconds = Math.max(
      0,
      Math.min(this.MAX_HEARTBEAT_SECONDS, Math.round(Number(dto.seconds) || 0)),
    );
    if (prior?.lastBeatAt) {
      const realElapsed = Math.round(
        (now.getTime() - new Date(prior.lastBeatAt).getTime()) / 1000,
      );
      seconds = Math.min(seconds, Math.max(0, realElapsed + 5)); // +5s grace
    }
    const incMin = seconds / 60;

    // Single atomic upsert — accumulate the counters with $inc (no read-first),
    // so a heartbeat is one write regardless of concurrency. Derived fields
    // (status/watched) are computed from the returned totals and only persisted
    // when they actually change (≈once per learner, at the threshold crossing).
    const doc = await this.attendanceModel.findOneAndUpdate(
      { session: session._id, registration: registration._id },
      {
        $inc: {
          attendedMinutes: incMin,
          liveMinutes: isLive ? incMin : 0,
          ...(dto.newView ? { watchCount: 1 } : {}),
        },
        $set: {
          lastBeatAt: now,
          ...(dto.source ? { watchSource: dto.source } : {}),
        },
        $setOnInsert: {
          event: session.event,
          session: session._id,
          registration: registration._id,
          checkInTime: now,
        },
      },
      { upsert: true, new: true },
    );

    const attendedMinutes = doc?.attendedMinutes || 0;
    const liveMinutes = doc?.liveMinutes || 0;
    const watchCount = doc?.watchCount || 0;
    const joinedAt = doc?.checkInTime || now;

    // LIVE attendance (present/late/absent) is derived from LIVE minutes;
    // "watched" from total watch-time.
    const late = this.isLateJoin(session, joinedAt);
    const status = this.deriveStatus(liveMinutes, late, threshold);
    const watched = attendedMinutes >= threshold;

    if (doc && (doc.status !== status || doc.watched !== watched)) {
      await this.attendanceModel.updateOne(
        { _id: doc._id },
        {
          $set: {
            status,
            watched,
            lateByMinutes:
              late && liveMinutes >= threshold
                ? Math.max(
                    0,
                    Math.round(
                      (joinedAt.getTime() -
                        (this.sessionStart(session)?.getTime() ??
                          joinedAt.getTime())) /
                        60_000,
                    ),
                  )
                : 0,
          },
        },
      );
    }

    return {
      status, // live attendance status
      attendedMinutes: Math.round(attendedMinutes),
      liveMinutes: Math.round(liveMinutes),
      watched,
      watchCount,
      isLive,
      thresholdMinutes: threshold,
    };
  }

  /**
   * Recompute final attendance for a session from accumulated watch-time.
   * Below the threshold becomes 'absent'. Facilitator-triggered (post-session).
   */
  async finalizeSessionAttendance(eventId: string, sessionId: string) {
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      event: new Types.ObjectId(eventId),
    });
    if (!session) throw new NotFoundException('Session not found');

    const rows = await this.attendanceModel.find({ session: session._id });
    const threshold = this.presentThresholdFor(session);
    const counts = { present: 0, late: 0, absent: 0 };
    let watched = 0; // reached threshold via any watch-time (live or replay)
    let views = 0; // total viewing sessions across all learners
    for (const row of rows) {
      const late = this.isLateJoin(session, row.checkInTime);
      // Live attendance is derived from LIVE minutes only.
      const status = this.deriveStatus(row.liveMinutes || 0, late, threshold);
      const didWatch = (row.attendedMinutes || 0) >= threshold;
      counts[status] += 1;
      if (didWatch) watched += 1;
      views += row.watchCount || 0;
      if (status !== row.status || didWatch !== row.watched) {
        row.status = status as any;
        row.watched = didWatch;
        await row.save();
      }
    }
    return { total: rows.length, ...counts, watched, views };
  }

  // ===================== Zoom attendance sync ==================================
  //
  //  Pull a session's attendance from Zoom's past-meeting participant report.
  //  For a recurring meeting the same `zoomMeetingId` is reused across sessions;
  //  we resolve the occurrence whose start time is closest to the session's
  //  scheduled start. Participant emails (reliable when the meeting uses Zoom
  //  registration) are matched to accepted registrants; unmatched participants
  //  are returned for the facilitator to reconcile — nothing is silently dropped.

  async syncSessionAttendanceFromZoom(eventId: string, sessionId: string) {
    await this.assertEvent(eventId);
    if (!this.zoomService.isConfigured) {
      throw new BadRequestException('Zoom is not configured on the server.');
    }
    const session = await this.sessionModel.findOne({
      _id: sessionId,
      event: new Types.ObjectId(eventId),
    });
    if (!session) throw new NotFoundException('Session not found');

    const meetingId = (session.zoomMeetingId || '').replace(/\s+/g, '');
    if (!meetingId) {
      throw new BadRequestException(
        'This session has no Zoom Meeting ID set. Add it on the session first.',
      );
    }

    const kind = session.zoomType === 'webinar' ? 'webinar' : 'meeting';

    // Resolve the occurrence matching this session's date (recurring meeting/
    // webinar); fall back to the id itself for a one-off.
    let target = meetingId;
    let occurrence: string | null = null;
    try {
      const instances = await this.zoomService.getPastInstances(meetingId, kind);
      if (instances.length) {
        const sStart =
          this.sessionStart(session)?.getTime() ??
          new Date(session.date).getTime();
        const best = instances
          .map((i) => ({
            uuid: i.uuid,
            diff: Math.abs(new Date(i.start_time).getTime() - (sStart || 0)),
          }))
          .sort((a, b) => a.diff - b.diff)[0];
        if (best) {
          target = best.uuid;
          occurrence = best.uuid;
        }
      }
    } catch {
      // No instances (one-off meeting) — use the meeting id directly.
    }

    const participants = await this.zoomService.getParticipants(target, kind);

    // Index accepted registrants by email AND by normalized full name. Zoom's
    // report only carries emails for authenticated/registered joiners — students
    // who join via the embedded SDK appear with the injected NAME and no email —
    // so we match on either. Ambiguous (duplicate) names are dropped so we never
    // credit the wrong person.
    const regs = await this.registrationModel
      .find({ event: session.event, admissionStatus: 'accepted' })
      .select('attendeeInfo')
      .lean();
    const normName = (s: string) =>
      (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const regByEmail = new Map<string, any>();
    const regByName = new Map<string, any>();
    const nameCounts = new Map<string, number>();
    for (const r of regs) {
      const e = (r.attendeeInfo?.email || '').trim().toLowerCase();
      if (e) regByEmail.set(e, r);
      const n = normName(
        `${r.attendeeInfo?.firstName || ''} ${r.attendeeInfo?.lastName || ''}`,
      );
      if (n) {
        nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
        regByName.set(n, r);
      }
    }
    for (const [n, c] of nameCounts) if (c > 1) regByName.delete(n);

    // Resolve each participant (email first, then name) and aggregate watch-
    // seconds + earliest join per registration (people can have multiple rows
    // from rejoining).
    const byReg = new Map<
      string,
      { reg: any; seconds: number; firstJoin?: Date }
    >();
    let withoutEmail = 0;
    const unmatched: Array<{
      email: string | null;
      name?: string;
      minutes: number;
    }> = [];
    for (const p of participants) {
      const email = (p.user_email || '').trim().toLowerCase();
      if (!email) withoutEmail += 1;
      const reg =
        (email && regByEmail.get(email)) || regByName.get(normName(p.name || ''));
      const seconds = Number(p.duration) || 0;
      const jt = p.join_time ? new Date(p.join_time) : undefined;
      if (!reg) {
        unmatched.push({
          email: email || null,
          name: p.name,
          minutes: Math.round(seconds / 60),
        });
        continue;
      }
      const k = String(reg._id);
      const rec = byReg.get(k) || { reg, seconds: 0 };
      rec.seconds += seconds;
      if (jt && (!rec.firstJoin || jt < rec.firstJoin)) rec.firstJoin = jt;
      byReg.set(k, rec);
    }

    const threshold = this.presentThresholdFor(session);
    const sStartMs =
      this.sessionStart(session)?.getTime() ?? new Date(session.date).getTime();

    // Reconcile the two signals: the PLATFORM heartbeat (liveMinutes — reliable,
    // we know who's logged in) and the ZOOM report. A learner is present if
    // EITHER meets the threshold; when they disagree we flag it for the
    // facilitator but still mark present. The heartbeat's liveMinutes is left
    // untouched — we only add zoomMinutes + status + discrepancy.
    const existing = await this.attendanceModel
      .find({ session: session._id })
      .lean();
    const platformByReg = new Map<string, any>();
    for (const a of existing) platformByReg.set(String(a.registration), a);

    const regIds = new Set<string>([
      ...byReg.keys(),
      ...platformByReg.keys(),
    ]);
    let present = 0;
    let late = 0;
    const discrepancies: Array<{
      registrationId: string;
      name?: string;
      platformMinutes: number;
      zoomMinutes: number;
      reason: string;
    }> = [];
    const bulkOps: any[] = [];

    for (const regId of regIds) {
      const z = byReg.get(regId);
      const p = platformByReg.get(regId);
      const zoomMin = z ? Math.round(z.seconds / 60) : 0;
      const platformMin = p ? Math.round(p.liveMinutes || 0) : 0;
      const bestMin = Math.max(zoomMin, platformMin);

      const isPresent = zoomMin >= threshold || platformMin >= threshold;
      const firstJoin =
        z?.firstJoin || (p?.checkInTime ? new Date(p.checkInTime) : undefined);
      const isLate = this.isLateJoin(session, firstJoin);
      const status = isPresent ? (isLate ? 'late' : 'present') : 'absent';
      if (isPresent) (status === 'late' ? late++ : present++);

      // YouTube-overflow viewers are never expected in the Zoom report, so a
      // "0 Zoom minutes" gap is by-design, not a discrepancy — skip flagging.
      const isOverflow = p?.watchSource === 'youtube';
      let discrepancy: string | undefined;
      if (isOverflow) {
        discrepancy = undefined;
      } else if (platformMin >= threshold && zoomMin < threshold)
        discrepancy = `On platform ${platformMin}m but Zoom shows ${zoomMin}m`;
      else if (zoomMin >= threshold && platformMin < threshold)
        discrepancy = `In Zoom ${zoomMin}m but only ${platformMin}m on the platform`;
      if (discrepancy) {
        const reg = z?.reg;
        discrepancies.push({
          registrationId: regId,
          name: reg
            ? `${reg.attendeeInfo?.firstName || ''} ${reg.attendeeInfo?.lastName || ''}`.trim()
            : undefined,
          platformMinutes: platformMin,
          zoomMinutes: zoomMin,
          reason: discrepancy,
        });
      }

      const lateBy =
        isLate && firstJoin
          ? Math.max(0, Math.round((firstJoin.getTime() - sStartMs) / 60_000))
          : 0;

      bulkOps.push({
        updateOne: {
          filter: {
            session: session._id,
            registration: new Types.ObjectId(regId),
          },
          update: {
            $set: {
              event: session.event,
              status,
              attendedMinutes: Math.max(p?.attendedMinutes || 0, zoomMin),
              zoomMinutes: zoomMin,
              watched: bestMin >= threshold,
              checkInTime: firstJoin,
              lateByMinutes: lateBy,
              attendanceDiscrepancy: discrepancy || null,
            },
            $setOnInsert: { registration: new Types.ObjectId(regId) },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length) {
      await this.attendanceModel.bulkWrite(bulkOps, { ordered: false });
    }

    session.zoomAttendanceSyncedAt = new Date();
    await session.save();

    return {
      sessionId,
      meetingId,
      occurrence,
      thresholdMinutes: threshold,
      totalParticipants: participants.length,
      participantsWithoutEmail: withoutEmail,
      processed: regIds.size,
      present,
      late,
      flagged: discrepancies.length,
      discrepancies: discrepancies.sort(
        (a, b) => b.platformMinutes - a.platformMinutes,
      ),
      unmatched: unmatched.sort((a, b) => b.minutes - a.minutes),
    };
  }

  /**
   * SDK join info for a student to watch a session's Zoom meeting/webinar
   * embedded in the portal — no separate Zoom login. The signature carries the
   * student as an attendee (role 0); the frontend passes their name/email so
   * they show up (reliably matched) in the participant report.
   */
  async getZoomJoinInfo(account: PortalAccountDocument, sessionId: string) {
    if (!this.zoomService.isSdkConfigured) {
      throw new BadRequestException('Embedded Zoom is not configured.');
    }
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    const meetingNumber = (session.zoomMeetingId || '').replace(/\s+/g, '');
    if (!meetingNumber) {
      throw new BadRequestException('This session has no Zoom meeting set.');
    }

    const registration = await this.registrationModel.findOne({
      event: session.event,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) throw new ForbiddenException('Not enrolled.');

    const { signature, sdkKey } = this.zoomService.generateSdkSignature(
      meetingNumber,
      0,
    );
    const name = `${registration.attendeeInfo?.firstName || ''} ${
      registration.attendeeInfo?.lastName || ''
    }`.trim();
    return {
      sdkKey,
      signature,
      meetingNumber,
      password: session.zoomPasscode || '',
      zoomType: session.zoomType || 'meeting',
      userName: name || account.email,
      userEmail: account.email,
    };
  }

  /** Current live status of a session's YouTube broadcast (for the portal). */
  async getSessionLiveStatus(eventId: string, sessionId: string) {
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      event: new Types.ObjectId(eventId),
    });
    if (!session) throw new NotFoundException('Session not found');
    return this.youtubeService.getLiveStatus(
      session.location?.virtualLink || '',
    );
  }

  /**
   * End the live session for students now (e.g. right after the host ends the
   * Zoom meeting). Stamps `liveEndedAt` so the portal stops showing it LIVE,
   * independent of the scheduled end time. Pass `resume: true` to clear it.
   */
  async setSessionLiveEnded(
    eventId: string,
    sessionId: string,
    resume = false,
  ) {
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      event: new Types.ObjectId(eventId),
    });
    if (!session) throw new NotFoundException('Session not found');
    (session as any).liveEndedAt = resume ? undefined : new Date();
    if (resume) session.set('liveEndedAt', undefined);
    await session.save();
    return { liveEndedAt: (session as any).liveEndedAt ?? null };
  }

  // ===================== Application reminders =================================
  //
  //  Nudge registrants who started but haven't submitted their application.
  //  One reminder per registrant per interval (APPLICATION_REMINDER_INTERVAL_DAYS,
  //  default 4 days), capped at APPLICATION_REMINDER_MAX (default 6). The first
  //  reminder fires `interval` days after they registered. Set
  //  APPLICATION_REMINDER_ENABLED=false to switch it off.

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendApplicationReminders() {
    if (process.env.APPLICATION_REMINDER_ENABLED === 'false') return;
    const intervalDays =
      Number(process.env.APPLICATION_REMINDER_INTERVAL_DAYS) || 4;
    const maxReminders = Number(process.env.APPLICATION_REMINDER_MAX) || 6;
    const cutoff = new Date(Date.now() - intervalDays * 86_400_000);

    // Events whose application flow is active (have a base URL to build links).
    const events = await this.eventModel
      .find({
        'registrationSettings.applicationBaseUrl': { $exists: true, $ne: '' },
      })
      .select('registrationSettings')
      .lean();
    if (!events.length) return;
    const baseByEvent = new Map(
      events.map((e) => [
        String(e._id),
        e.registrationSettings?.applicationBaseUrl,
      ]),
    );
    // Per-event sender so reminders are branded like the event's other emails
    // (and, for CMIT, replies route to the CMIT inbox via the provider default).
    const fromByEvent = new Map(
      events.map((e) => {
        const s = e.registrationSettings;
        const from =
          s?.senderEmail && s?.senderName
            ? `${s.senderName} <${s.senderEmail}>`
            : s?.senderEmail;
        return [String(e._id), from];
      }),
    );

    // Not yet submitted, has a token, and due for a reminder: either never
    // reminded (and registered before the cutoff) or last reminded before it.
    const regs = await this.registrationModel
      .find({
        event: { $in: events.map((e) => e._id) },
        applicationToken: { $exists: true, $ne: null },
        $and: [
          {
            $or: [
              { applicationSubmittedAt: { $exists: false } },
              { applicationSubmittedAt: null },
            ],
          },
          {
            $or: [
              { applicationReminderSentAt: { $lte: cutoff } },
              { applicationReminderSentAt: null, createdAt: { $lte: cutoff } },
            ],
          },
        ],
      })
      .limit(500);

    const year = String(new Date().getFullYear());
    let sent = 0;
    for (const reg of regs) {
      if ((reg.applicationReminderCount || 0) >= maxReminders) continue;
      const email = reg.attendeeInfo?.email;
      const base = baseByEvent.get(String(reg.event));
      if (!email || !base) continue;
      const applicationUrl = `${base.replace(/\/+$/, '')}/apply/${reg.applicationToken}`;
      try {
        const { subject, html } = await this.templateResolver.resolveTemplate(
          'events.application-reminder',
          {
            firstName: reg.attendeeInfo?.firstName || 'there',
            applicationUrl,
            year,
          },
        );
        const from = fromByEvent.get(String(reg.event));
        await this.emailProvider.sendEmail({
          to: email,
          subject,
          html,
          ...(from ? { from } : {}),
        });
        reg.applicationReminderSentAt = new Date();
        reg.applicationReminderCount = (reg.applicationReminderCount || 0) + 1;
        await reg.save();
        sent += 1;
      } catch (e) {
        this.logger.warn(
          `Application reminder to ${email} failed: ${(e as Error).message}`,
        );
      }
    }
    if (sent) this.logger.log(`Application reminders sent: ${sent}`);
  }

  // ===================== Admission letters ====================================
  //
  //  Emails every newly-admitted (admissionStatus 'accepted') CMIT registrant a
  //  personalized PDF admission letter with a unique Student ID. Idempotent via
  //  `admissionLetterSentAt`, so it covers every admission path (any place that
  //  sets 'accepted') without double-sending. Toggle with the
  //  AUTO_ADMISSION_ENABLED constant below.

  private nextStudentSeq = new Map<string, number>();

  // Auto-admission config (hardcoded constants, not env-driven).
  private readonly AUTO_ADMISSION_ENABLED = true;
  private readonly ADMISSION_LETTER_CC = ['cmithub@gmail.com'];

  // Build the per-event "From" string so an event's emails are branded with its
  // own sender (for CMIT that's info@cmithub.org, which also routes replies to
  // the CMIT inbox via the email provider's reply-to default).
  private senderFromEvent(ev?: {
    registrationSettings?: { senderEmail?: string; senderName?: string };
  } | null): string | undefined {
    const s = ev?.registrationSettings;
    if (!s?.senderEmail) return undefined;
    return s.senderName ? `${s.senderName} <${s.senderEmail}>` : s.senderEmail;
  }

  // ── CMIT Cohort 1 onboarding reminders (one-off, event on Sat 25 July 2026) ─
  // Sends a reminder template to EVERYONE registered for the CMIT event, from
  // the CMIT sender (replies route to the CMIT inbox via the provider default).
  private async sendOnboardingReminderToAll(slug: string): Promise<void> {
    // PAUSED by default after the 2026-07 Gmail 4.7.28 rate-limit incident on
    // cmithub.org (a low-reputation domain). This kill-switch is scoped to the
    // CMIT reminder campaign only — it does NOT affect powerpointtribe.org mail,
    // CMIT admission letters, or any other cron. To resume, set
    // ONBOARDING_REMINDERS_ENABLED=true and restart, ideally ramping the domain
    // gradually (see scripts/send-onboarding-blast.ts --gmail-rate).
    if (process.env.ONBOARDING_REMINDERS_ENABLED !== 'true') {
      this.logger.warn(
        `Onboarding reminder ${slug} skipped — ONBOARDING_REMINDERS_ENABLED is not 'true' (campaign paused)`,
      );
      return;
    }
    const tpl = eventsDefaults.find((t) => t.slug === slug);
    if (!tpl) {
      this.logger.warn(`Onboarding reminder template not found: ${slug}`);
      return;
    }
    const ev = await this.eventModel.findOne({
      registrationSlug: 'cmit-cohort-1',
    });
    if (!ev) {
      this.logger.warn('CMIT event not found — skipping onboarding reminder');
      return;
    }
    const from = this.senderFromEvent(ev);
    const regs = await this.registrationModel
      .find({ event: ev._id, 'attendeeInfo.email': { $exists: true, $ne: null } })
      .select('attendeeInfo')
      .lean();
    const emails = [
      ...new Set(
        regs
          .map((r) => (r.attendeeInfo?.email || '').trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    this.logger.log(`Onboarding reminder ${slug}: ${emails.length} recipients`);
    let sent = 0;
    let failed = 0;
    // cmithub.org has low sending reputation — throttle Gmail recipients hard
    // (Gmail enforces per-sending-domain rate limits) and back off exponentially
    // on transient/rate failures. These pace values match the blast script.
    const gmailDelayMs = 12_000; // ~300 emails/hour to Gmail
    const otherDelayMs = 3_600; // ~1000 emails/hour to other providers
    for (const to of emails) {
      const isGmail = /@(gmail|googlemail)\.com$/i.test(to);
      let ok = false;
      for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
        try {
          await this.emailProvider.sendEmail({
            to,
            subject: tpl.subject,
            html: tpl.htmlContent,
            ...(from ? { from } : {}),
          });
          ok = true;
        } catch (e) {
          const msg = (e as Error).message || '';
          // Permanent (unverified sender/invalid recipient) or exhausted credit,
          // or last attempt → give up on this recipient.
          if (/not verified|invalid|credit/i.test(msg) || attempt === 4) {
            this.logger.warn(
              `Onboarding reminder ${slug} → ${to} failed: ${msg}`,
            );
            break;
          }
          const isRate = /rate|too many|429|throttl|temporar|4\.7\.\d+|defer/i.test(msg);
          await new Promise((r) =>
            setTimeout(r, (isRate ? 30_000 : 2_000) * 2 ** (attempt - 1)),
          );
        }
      }
      if (ok) sent += 1;
      else failed += 1;
      await new Promise((r) => setTimeout(r, isGmail ? gmailDelayMs : otherDelayMs));
    }
    this.logger.log(`Onboarding reminder ${slug} done: sent ${sent}, failed ${failed}`);
  }

  // Reminder 2 — Sat 25 July 2026, 8:00 AM WAT (morning of the event).
  @Cron('0 0 8 25 7 *', { timeZone: 'Africa/Lagos' })
  async onboardingReminderTwo() {
    if (new Date().getFullYear() !== 2026) return;
    await this.sendOnboardingReminderToAll('events.onboarding-reminder-2');
  }

  // Reminder 3 — Sat 25 July 2026, 6:00 PM WAT (1 hour before, 7:00 PM start).
  @Cron('0 0 18 25 7 *', { timeZone: 'Africa/Lagos' })
  async onboardingReminderThree() {
    if (new Date().getFullYear() !== 2026) return;
    await this.sendOnboardingReminderToAll('events.onboarding-reminder-3');
  }

  // Reminder 4 — Sat 25 July 2026, 6:50 PM WAT (10 minutes before start).
  @Cron('0 50 18 25 7 *', { timeZone: 'Africa/Lagos' })
  async onboardingReminderFour() {
    if (new Date().getFullYear() !== 2026) return;
    await this.sendOnboardingReminderToAll('events.onboarding-reminder-4');
  }

  private async assignStudentId(eventOid: Types.ObjectId): Promise<string> {
    const key = String(eventOid);
    const year = new Date().getFullYear();
    let seq = this.nextStudentSeq.get(key);
    if (seq === undefined) {
      const last = await this.registrationModel
        .findOne({ event: eventOid, studentId: { $regex: /^CMIT-\d{4}-/ } })
        .sort({ studentId: -1 })
        .select('studentId')
        .lean();
      const m = last?.studentId?.match(/(\d+)\s*$/);
      seq = m ? parseInt(m[1], 10) : 0;
    }
    seq += 1;
    this.nextStudentSeq.set(key, seq);
    // Format: CMIT-<year>-<zero-padded id> (e.g. CMIT-2026-0007)
    return `CMIT-${year}-${String(seq).padStart(4, '0')}`;
  }

  // Auto-admit: every 15 minutes, admit + email the admission letter to every
  // CMIT registrant who has COMPLETED their application but hasn't been sent one
  // yet. `sendAdmissionLetterForRegistration` sets admissionStatus=accepted,
  // assigns a Student ID, emails the letter (CC admin) and stamps
  // `admissionLetterSentAt` — so this is idempotent and never double-sends.
  // Disable with the AUTO_ADMISSION_ENABLED constant.
  @Cron('0 */15 * * * *')
  async sendAdmissionLetters() {
    if (!this.AUTO_ADMISSION_ENABLED) return;

    // Scope to CMIT event(s) — the letter content is CMIT-specific.
    const events = await this.eventModel
      .find({
        $or: [
          { registrationSlug: 'cmit-cohort-1' },
          { name: /campus ministers in training|CMIT/i },
        ],
      })
      .select('registrationSettings')
      .lean();
    if (!events.length) return;
    const eventIds = events.map((e) => e._id);

    const regs = await this.registrationModel
      .find({
        event: { $in: eventIds },
        // Completed the application form…
        applicationSubmittedAt: { $ne: null },
        // …and not yet sent an admission letter.
        $or: [
          { admissionLetterSentAt: { $exists: false } },
          { admissionLetterSentAt: null },
        ],
        'attendeeInfo.email': { $ne: null },
      })
      .limit(300);

    let sent = 0;
    for (const reg of regs) {
      const res = await this.sendAdmissionLetterForRegistration(reg).catch(
        (e) => {
          this.logger.warn(
            `Admission letter to ${reg.attendeeInfo?.email} failed: ${(e as Error).message}`,
          );
          return { sent: false as const };
        },
      );
      if (res.sent) sent += 1;
    }
    if (sent) this.logger.log(`Auto-admitted + sent admission letters: ${sent}`);
  }

  /** True when an event's admission letter content applies (CMIT-specific). */
  private isCmitEvent(event: {
    registrationSlug?: string;
    name?: string;
    title?: string;
  }): boolean {
    if (event?.registrationSlug === 'cmit-cohort-1') return true;
    return /campus ministers in training|CMIT/i.test(
      `${event?.name || ''} ${event?.title || ''}`,
    );
  }

  /**
   * Build + email the personalized CMIT admission letter (PDF) for a single
   * accepted registration, assigning a Student ID if needed. Idempotent via
   * `admissionLetterSentAt`. Called on acceptance and by the safety-net cron.
   * Returns whether an email was actually sent (with a reason when skipped).
   */
  async sendAdmissionLetterForRegistration(
    reg: EventRegistrationDocument,
    event?: EventDocument,
  ): Promise<{ sent: boolean; reason?: string }> {
    const email = reg.attendeeInfo?.email;
    if (!email) return { sent: false, reason: 'no-email' };
    if (reg.admissionLetterSentAt) return { sent: false, reason: 'already-sent' };

    const ev =
      event ||
      (await this.eventModel
        .findById(reg.event)
        .select('registrationSlug name title registrationSettings')
        .lean());
    if (!ev) return { sent: false, reason: 'no-event' };
    if (!this.isCmitEvent(ev)) return { sent: false, reason: 'not-cmit' };

    if (!reg.studentId) {
      reg.studentId = await this.assignStudentId(reg.event as Types.ObjectId);
    }

    // Step 1 — ACCEPT first, and persist it (with the Student ID) BEFORE the
    // letter goes out. This way a transient email failure never loses the
    // admission; the next run just retries the letter.
    if (reg.admissionStatus !== 'accepted' || reg.isModified('studentId')) {
      reg.admissionStatus = 'accepted';
      if (!reg.acceptedAt) reg.acceptedAt = new Date();
      await reg.save();
    }

    const firstName = reg.attendeeInfo?.firstName || '';
    const lastName = reg.attendeeInfo?.lastName || '';
    const studentName = [firstName, lastName].filter(Boolean).join(' ');
    const issueDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const pdf = await buildAdmissionLetterPdf({
      studentName,
      studentId: reg.studentId,
      issueDate,
    });

    const cfg = (ev as EventDocument).registrationSettings;
    const from =
      cfg?.senderEmail && cfg?.senderName
        ? `${cfg.senderName} <${cfg.senderEmail}>`
        : cfg?.senderEmail;

    // Mint a set-password link and embed it in the admission letter so a
    // newly-admitted learner can log in immediately (no separate invite email).
    let setupUrl = '';
    try {
      const res = await this.portalService.provisionSetupUrl(
        reg,
        ev as EventDocument,
      );
      setupUrl = res.setupUrl || '';
    } catch (e) {
      this.logger.warn(
        `Could not mint portal setup URL for ${email}: ${(e as Error).message}`,
      );
    }

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'events.admission-letter',
      {
        firstName,
        lastName,
        year: String(new Date().getFullYear()),
        setupUrl,
      },
    );

    await this.emailProvider.sendEmail({
      to: email,
      ...(this.ADMISSION_LETTER_CC.length
        ? { cc: this.ADMISSION_LETTER_CC }
        : {}),
      subject,
      html,
      ...(from ? { from } : {}),
      attachments: [
        {
          filename: `CMIT_Admission_Letter_${reg.studentId.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    reg.admissionLetterSentAt = new Date();
    await reg.save();
    return { sent: true };
  }

  // ===================== YouTube session recordings ============================
  //
  //  After a live session ends, YouTube keeps the VOD at the same watch URL. We
  //  detect the end (poll videos.list → actualEndTime), email the facilitator
  //  the link once, and let them publish it into a module as a replay lesson.

  /** Facilitator notification recipients: event organizer + committee (with
   *  first names), then the event contact email as a fallback. */
  private async resolveFacilitatorRecipients(
    event: EventDocument,
  ): Promise<Array<{ email: string; firstName: string }>> {
    const memberIds: Types.ObjectId[] = [];
    if (event.organizer) memberIds.push(event.organizer as Types.ObjectId);
    for (const c of event.committee || []) {
      if (c?.member) memberIds.push(c.member as Types.ObjectId);
    }
    const byEmail = new Map<string, string>();
    if (memberIds.length) {
      const members = await this.memberModel
        .find({ _id: { $in: memberIds } })
        .select('email firstName')
        .lean();
      for (const m of members) {
        if (m.email) byEmail.set(m.email, m.firstName || 'there');
      }
    }
    if (event.contactEmail && !byEmail.has(event.contactEmail)) {
      byEmail.set(event.contactEmail, 'there');
    }
    return [...byEmail].map(([email, firstName]) => ({ email, firstName }));
  }

  /** Facilitator dashboard sessions URL for email CTAs. */
  private dashboardUrl(event?: EventDocument): string {
    const appBase = event?.registrationSettings?.applicationBaseUrl;
    const base =
      process.env.FACILITATOR_DASHBOARD_URL ||
      (appBase
        ? `${appBase.replace(/\/+$/, '')}/facilitator`
        : process.env.FRONTEND_URL || '');
    return base ? `${base.replace(/\/+$/, '')}/sessions` : '';
  }

  /** Learner portal URL for a lesson (replay deep-link). */
  private portalLessonUrl(
    event: EventDocument,
    lessonId: Types.ObjectId,
  ): string {
    const base =
      event.registrationSettings?.applicationBaseUrl?.replace(/\/+$/, '') ||
      process.env.FRONTEND_URL ||
      '';
    return base ? `${base}/portal/lessons/${lessonId}` : '';
  }

  /** Manual trigger: check a single session for a ready recording + notify. */
  async checkAndNotifyRecording(sessionId: string) {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    return this.checkAndNotifyRecordingDoc(session);
  }

  /** Idempotent core: mark recording available + email facilitator once. */
  private async checkAndNotifyRecordingDoc(session: EventSessionDocument) {
    const videoId = YoutubeService.extractVideoId(
      session.location?.virtualLink,
    );
    if (!videoId) return { ready: false, reason: 'no-youtube-link' };
    if (session.recording?.notifiedAt) {
      return { ready: true, alreadyNotified: true, url: session.recording.url };
    }

    const status = await this.youtubeService.getLiveStatus(videoId);
    if (status.state !== 'ended') return { ready: false, state: status.state };

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    session.recording = {
      ...(session.recording || { available: false }),
      available: true,
      url,
      videoId,
      endedAt: status.actualEndTime
        ? new Date(status.actualEndTime)
        : new Date(),
    };

    try {
      const event = await this.eventModel.findById(session.event);
      const recipients = event
        ? await this.resolveFacilitatorRecipients(event)
        : [];
      const dashboardUrl = this.dashboardUrl(event || undefined);
      const year = String(new Date().getFullYear());
      let sent = 0;
      for (const r of recipients) {
        try {
          const { subject, html } = await this.templateResolver.resolveTemplate(
            'events.session-recording-ready',
            {
              firstName: r.firstName,
              sessionTitle: session.title,
              recordingUrl: url,
              dashboardUrl,
              year,
            },
          );
          const from = this.senderFromEvent(event);
          await this.emailProvider.sendEmail({
            to: r.email,
            subject,
            html,
            ...(from ? { from } : {}),
          });
          sent += 1;
        } catch (e) {
          this.logger.warn(
            `Recording email to ${r.email} failed: ${(e as Error).message}`,
          );
        }
      }
      if (sent) session.recording.notifiedAt = new Date();
    } catch (err) {
      this.logger.warn(
        `Recording notify failed for session ${session._id}: ${(err as Error).message}`,
      );
    }

    await session.save();
    return { ready: true, url };
  }

  /** Every 10 min: check past, un-notified virtual sessions for a ready recording. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async pollSessionRecordings() {
    if (!this.youtubeService.isConfigured) return;
    const sessions = await this.sessionModel
      .find({
        date: { $lte: new Date() },
        'location.isVirtual': true,
        'location.virtualLink': { $regex: 'youtu', $options: 'i' },
        'recording.notifiedAt': { $exists: false },
      })
      .limit(50);
    for (const s of sessions) {
      try {
        await this.checkAndNotifyRecordingDoc(s);
      } catch (err) {
        this.logger.warn(
          `pollSessionRecordings ${s._id} failed: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Publish a session's recording into a module as a published video lesson so
   * trainees can watch the replay under that module's resources.
   */
  async publishSessionRecording(
    eventId: string,
    sessionId: string,
    dto: { moduleId: string; title?: string },
  ) {
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      event: new Types.ObjectId(eventId),
    });
    if (!session) throw new NotFoundException('Session not found');

    const videoId = YoutubeService.extractVideoId(
      session.location?.virtualLink,
    );
    const url =
      session.recording?.url ||
      (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
    if (!url) {
      throw new BadRequestException(
        'No recording available for this session yet.',
      );
    }

    const mod = await this.moduleModel.findOne({
      _id: new Types.ObjectId(dto.moduleId),
      event: session.event,
    });
    if (!mod) throw new NotFoundException('Module not found for this event.');

    const order = await this.lessonModel.countDocuments({ module: mod._id });
    const title = (dto.title || `Session recording — ${session.title}`).trim();
    const lesson = await this.lessonModel.create({
      event: session.event,
      module: mod._id,
      title,
      summary: 'Replay of the live session.',
      content: `<p>Watch the session replay above. If it doesn’t load, <a href="${url}" target="_blank" rel="noopener">open it on YouTube</a>.</p>`,
      order,
      resources: [
        {
          id: randomBytes(6).toString('hex'),
          title: 'Session recording (video)',
          type: 'video',
          url,
        },
      ],
      // Recordings show under the module but never count toward completion.
      isSessionRecording: true,
      excludeFromCompletion: true,
      status: 'published',
    });

    session.recording = {
      ...(session.recording || { available: true, url }),
      available: true,
      url,
      publishedLessonId: lesson._id,
      publishedModuleId: mod._id,
      publishedAt: new Date(),
    };
    await session.save();

    // Notify trainees the replay is available (background — don't block publish).
    void this.notifyStudentsRecordingAvailable(
      String(session.event),
      session.title,
      mod.title,
      lesson._id,
    );

    return {
      published: true,
      lessonId: lesson._id,
      moduleId: mod._id,
      moduleTitle: mod.title,
      url,
    };
  }

  /**
   * Email accepted trainees that a session replay is now available in a module.
   * Runs in the background; sends in small batches to avoid overwhelming the
   * email provider.
   */
  private async notifyStudentsRecordingAvailable(
    eventId: string,
    sessionTitle: string,
    moduleTitle: string,
    lessonId: Types.ObjectId,
  ) {
    try {
      const event = await this.eventModel.findById(eventId);
      if (!event) return;
      const watchUrl = this.portalLessonUrl(event, lessonId);
      const year = String(new Date().getFullYear());
      const regs = await this.registrationModel
        .find({ event: event._id, admissionStatus: 'accepted' })
        .select('attendeeInfo')
        .lean();

      const recipients = regs
        .map((r) => ({
          email: r.attendeeInfo?.email,
          firstName: r.attendeeInfo?.firstName || 'there',
        }))
        .filter((r) => !!r.email) as Array<{
        email: string;
        firstName: string;
      }>;

      const BATCH = 20;
      let sent = 0;
      for (let i = 0; i < recipients.length; i += BATCH) {
        const slice = recipients.slice(i, i + BATCH);
        await Promise.all(
          slice.map(async (r) => {
            try {
              const { subject, html } =
                await this.templateResolver.resolveTemplate(
                  'events.session-recording-available',
                  {
                    firstName: r.firstName,
                    sessionTitle,
                    moduleTitle,
                    watchUrl,
                    year,
                  },
                );
              const from = this.senderFromEvent(event);
              await this.emailProvider.sendEmail({
                to: r.email,
                subject,
                html,
                ...(from ? { from } : {}),
              });
              sent += 1;
            } catch (e) {
              this.logger.warn(
                `Replay email to ${r.email} failed: ${(e as Error).message}`,
              );
            }
          }),
        );
      }
      this.logger.log(
        `Replay notification: emailed ${sent}/${recipients.length} trainees for "${sessionTitle}".`,
      );
    } catch (err) {
      this.logger.warn(
        `notifyStudentsRecordingAvailable failed: ${(err as Error).message}`,
      );
    }
  }

  // ===================== FACILITATOR: event overview =====================

  /** Headline stats across the event funnel + learning activity (rates). */
  async getEventOverview(eventId: string) {
    await this.assertEvent(eventId);
    const eventOid = new Types.ObjectId(eventId);
    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

    const [
      totalReg,
      appliedCount,
      admissionAgg,
      lessonCount,
      sessionCount,
      assignmentCount,
      acceptedRegs,
      progresses,
      attendances,
      submissions,
      cfrRegs,
    ] = await Promise.all([
      this.registrationModel.countDocuments({ event: eventOid }),
      this.registrationModel.countDocuments({
        event: eventOid,
        applicationSubmittedAt: { $ne: null },
      }),
      this.registrationModel.aggregate([
        { $match: { event: eventOid } },
        { $group: { _id: '$admissionStatus', n: { $sum: 1 } } },
      ]),
      this.lessonModel.countDocuments({ event: eventOid, status: 'published' }),
      this.sessionModel.countDocuments({ event: eventOid }),
      this.assignmentModel.countDocuments({
        event: eventOid,
        status: 'published',
      }),
      this.registrationModel
        .find({ event: eventOid, admissionStatus: 'accepted' })
        .select('_id')
        .lean(),
      this.progressModel
        .find({ event: eventOid })
        .select('registration status reflection')
        .lean(),
      this.attendanceModel
        .find({ event: eventOid, status: { $in: ['present', 'late'] } })
        .select('registration')
        .lean(),
      this.submissionModel.find({ event: eventOid }).select('grade').lean(),
      this.registrationModel
        .find({ event: eventOid })
        .select('customFieldResponses')
        .lean(),
    ]);

    const admissions = { pending: 0, accepted: 0, rejected: 0, waitlisted: 0 };
    for (const a of admissionAgg as any[]) {
      if (a._id === 'accepted') admissions.accepted = a.n;
      else if (a._id === 'rejected') admissions.rejected = a.n;
      else if (a._id === 'waitlisted') admissions.waitlisted = a.n;
      else admissions.pending += a.n; // 'applied' or null/undefined
    }

    const acceptedIds = new Set(acceptedRegs.map((r) => String(r._id)));
    const acceptedCount = acceptedIds.size;

    const completedByReg: Record<string, number> = {};
    let reflectionsTotal = 0;
    for (const p of progresses) {
      const k = String(p.registration);
      if (p.status === 'completed' && acceptedIds.has(k))
        completedByReg[k] = (completedByReg[k] || 0) + 1;
      if (p.reflection && p.reflection.trim() && acceptedIds.has(k))
        reflectionsTotal += 1;
    }
    const presentByReg: Record<string, number> = {};
    for (const a of attendances) {
      const k = String(a.registration);
      if (acceptedIds.has(k)) presentByReg[k] = (presentByReg[k] || 0) + 1;
    }

    let progressSum = 0;
    let completedAll = 0;
    let attendanceSum = 0;
    for (const id of acceptedIds) {
      const done = completedByReg[id] || 0;
      progressSum += pct(done, lessonCount);
      if (lessonCount > 0 && done >= lessonCount) completedAll += 1;
      attendanceSum += pct(presentByReg[id] || 0, sessionCount);
    }

    return {
      registrations: {
        total: totalReg,
        applied: appliedCount,
        notApplied: totalReg - appliedCount,
        appliedRate: pct(appliedCount, totalReg),
      },
      admissions: {
        ...admissions,
        acceptedRate: pct(admissions.accepted, totalReg),
      },
      course: {
        lessons: lessonCount,
        avgProgress: acceptedCount
          ? Math.round(progressSum / acceptedCount)
          : 0,
        completedAll,
        completionRate: pct(completedAll, acceptedCount),
      },
      attendance: {
        sessions: sessionCount,
        avgAttendance: acceptedCount
          ? Math.round(attendanceSum / acceptedCount)
          : 0,
      },
      assignments: {
        total: assignmentCount,
        submissions: submissions.length,
        graded: submissions.filter(
          (s) => s.grade !== null && s.grade !== undefined,
        ).length,
      },
      reflections: reflectionsTotal,
      acceptedCount,
      demographics: {
        school: buildDistribution(cfrRegs, SCHOOL_FIELD_KEYS, SCHOOL_ALIASES),
        heardAbout: buildDistribution(
          cfrRegs,
          HEARD_ABOUT_FIELD_KEYS,
          HEARD_ABOUT_ALIASES,
        ),
      },
    };
  }

  // ===================== FACILITATOR: engagement analytics =====================

  async getEngagement(
    eventId: string,
    opts: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
    } = {},
  ) {
    await this.assertEvent(eventId);
    const eventOid = new Types.ObjectId(eventId);

    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(opts.limit) || 25));
    const search = (opts.search || '').trim().toLowerCase();
    const sortBy = opts.sortBy || 'progress';

    const [regs, lessons, modules, sessionCount, progresses, attendances] =
      await Promise.all([
        this.registrationModel
          .find({ event: eventOid, admissionStatus: 'accepted' })
          .lean(),
        this.lessonModel
          .find({ event: eventOid, status: 'published' })
          .select('_id module')
          .lean(),
        this.moduleModel.find({ event: eventOid }).sort({ order: 1 }).lean(),
        this.sessionModel.countDocuments({ event: eventOid }),
        this.progressModel.find({ event: eventOid }).lean(),
        this.attendanceModel
          .find({ event: eventOid, status: { $in: ['present', 'late'] } })
          .lean(),
      ]);

    const lessonCount = lessons.length;
    const lessonToModule: Record<string, string> = {};
    for (const l of lessons) lessonToModule[String(l._id)] = String(l.module);
    const moduleTitle: Record<string, string> = {};
    for (const m of modules)
      moduleTitle[String(m._id)] = (m as any).title || 'Untitled module';

    // Per-registration rollups + per-module revisit rollups.
    const completedByReg: Record<string, number> = {};
    const reflectionsByReg: Record<string, number> = {};
    const startedRegs = new Set<string>();
    const moduleViews: Record<string, number> = {};
    const moduleRevisitOpens: Record<string, number> = {};
    const moduleRevisitLearners: Record<string, Set<string>> = {};

    for (const p of progresses) {
      const k = String(p.registration);
      if (p.status === 'completed')
        completedByReg[k] = (completedByReg[k] || 0) + 1;
      if (p.reflection && p.reflection.trim())
        reflectionsByReg[k] = (reflectionsByReg[k] || 0) + 1;
      const views = (p as any).viewCount || 0;
      const timeSpent = (p as any).timeSpentSec || 0;
      if (p.status !== 'not_started' || views > 0 || timeSpent > 0)
        startedRegs.add(k);

      const mod = lessonToModule[String(p.lesson)];
      if (mod && views > 0) {
        moduleViews[mod] = (moduleViews[mod] || 0) + views;
        if (views >= 2) {
          // Re-opens beyond the first view.
          moduleRevisitOpens[mod] = (moduleRevisitOpens[mod] || 0) + (views - 1);
          (moduleRevisitLearners[mod] ||= new Set()).add(k);
        }
      }
    }

    const presentByReg: Record<string, number> = {};
    for (const a of attendances) {
      const k = String(a.registration);
      presentByReg[k] = (presentByReg[k] || 0) + 1;
    }

    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
    const sum = (arr: number[]) => arr.reduce((s, n) => s + n, 0);

    // Full learner list (computed over everyone, then filtered/sorted/paged).
    let learners = regs.map((r) => {
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
        started: startedRegs.has(k),
      };
    });

    // Overview — aggregates across ALL accepted learners (not just the page).
    const startedCount = learners.filter((l) => l.started).length;
    const completedAll =
      lessonCount > 0
        ? learners.filter((l) => l.lessonsCompleted >= lessonCount).length
        : 0;
    const overview = {
      accepted: regs.length,
      started: startedCount,
      notStarted: regs.length - startedCount,
      completedAll,
      avgProgressPercent: learners.length
        ? Math.round(sum(learners.map((l) => l.progressPercent)) / learners.length)
        : 0,
      avgAttendancePercent: learners.length
        ? Math.round(
            sum(learners.map((l) => l.attendancePercent)) / learners.length,
          )
        : 0,
      totalReflections: sum(learners.map((l) => l.reflections)),
      revisitedModules: modules
        .map((m) => {
          const id = String(m._id);
          return {
            moduleId: id,
            title: moduleTitle[id],
            totalViews: moduleViews[id] || 0,
            revisitOpens: moduleRevisitOpens[id] || 0,
            learnersRevisited: moduleRevisitLearners[id]?.size || 0,
          };
        })
        .filter((m) => m.revisitOpens > 0)
        .sort((a, b) => b.revisitOpens - a.revisitOpens),
    };

    // Search + sort + paginate the learner list.
    if (search) {
      learners = learners.filter(
        (l) =>
          l.name.toLowerCase().includes(search) ||
          (l.email || '').toLowerCase().includes(search),
      );
    }
    const sorters: Record<string, (a: any, b: any) => number> = {
      progress: (a, b) => b.progressPercent - a.progressPercent,
      attendance: (a, b) => b.attendancePercent - a.attendancePercent,
      name: (a, b) => a.name.localeCompare(b.name),
      reflections: (a, b) => b.reflections - a.reflections,
    };
    learners.sort(sorters[sortBy] || sorters.progress);

    const total = learners.length;
    const start = (page - 1) * limit;
    const items = learners.slice(start, start + limit);

    return {
      totals: {
        accepted: regs.length,
        lessons: lessonCount,
        sessions: sessionCount,
      },
      overview,
      learners: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Attendance records where the platform heartbeat and the Zoom report disagree
   * (`attendanceDiscrepancy` set) — for the facilitator to reconcile.
   */
  async getFlaggedAttendance(eventId: string) {
    await this.assertEvent(eventId);
    const eventOid = new Types.ObjectId(eventId);
    const flagged = await this.attendanceModel
      .find({ event: eventOid, attendanceDiscrepancy: { $ne: null } })
      .select(
        'registration session attendanceDiscrepancy liveMinutes zoomMinutes status',
      )
      .lean();
    if (!flagged.length) return { items: [] };

    const regIds = [...new Set(flagged.map((f) => String(f.registration)))];
    const sessIds = [...new Set(flagged.map((f) => String(f.session)))];
    const [regs, sessions] = await Promise.all([
      this.registrationModel
        .find({ _id: { $in: regIds } })
        .select('attendeeInfo')
        .lean(),
      this.sessionModel.find({ _id: { $in: sessIds } }).select('title').lean(),
    ]);
    const nameById = new Map(
      regs.map((r) => [
        String(r._id),
        `${r.attendeeInfo?.firstName || ''} ${r.attendeeInfo?.lastName || ''}`.trim(),
      ]),
    );
    const emailById = new Map(
      regs.map((r) => [String(r._id), r.attendeeInfo?.email || null]),
    );
    const titleById = new Map(
      sessions.map((s) => [String(s._id), (s as any).title]),
    );

    return {
      items: flagged
        .map((f) => ({
          student: nameById.get(String(f.registration)) || 'Unknown',
          email: emailById.get(String(f.registration)) || null,
          session: titleById.get(String(f.session)) || 'Session',
          platformMinutes: Math.round((f as any).liveMinutes || 0),
          zoomMinutes: Math.round((f as any).zoomMinutes || 0),
          status: f.status,
          reason: (f as any).attendanceDiscrepancy,
        }))
        .sort((a, b) => b.platformMinutes - a.platformMinutes),
    };
  }
}
