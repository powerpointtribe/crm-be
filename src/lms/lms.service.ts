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
import {
  SermonSummary,
  SermonSummaryDocument,
} from './schemas/sermon-summary.schema';
import { QaPost, QaPostDocument } from './schemas/qa-post.schema';
import {
  FacilitatorAudit,
  FacilitatorAuditDocument,
} from './schemas/facilitator-audit.schema';
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
  SessionAttendanceStatus,
} from '../events/schemas/session-attendance.schema';
import { PortalAccountDocument } from '../portal/schemas/portal-account.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import {
  LeaderboardEntry,
  LeaderboardEntryDocument,
} from './schemas/leaderboard-entry.schema';
import {
  LeaderboardWeights,
  LeaderboardWeightsDocument,
} from './schemas/leaderboard-weights.schema';
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
    @InjectModel(SermonSummary.name)
    private readonly sermonSummaryModel: Model<SermonSummaryDocument>,
    @InjectModel(QaPost.name)
    private readonly qaPostModel: Model<QaPostDocument>,
    @InjectModel(FacilitatorAudit.name)
    private readonly auditModel: Model<FacilitatorAuditDocument>,
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
    @InjectModel(LeaderboardEntry.name)
    private readonly leaderboardModel: Model<LeaderboardEntryDocument>,
    @InjectModel(LeaderboardWeights.name)
    private readonly leaderboardWeightsModel: Model<LeaderboardWeightsDocument>,
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
    const [modules, lessons, summaryCounts] = await Promise.all([
      this.moduleModel.find({ event: eventOid }).sort({ order: 1 }).lean(),
      this.lessonModel.find({ event: eventOid }).sort({ order: 1 }).lean(),
      this.sermonSummaryModel.aggregate([
        { $match: { event: eventOid, submittedAt: { $ne: null } } },
        { $group: { _id: '$module', n: { $sum: 1 } } },
      ]),
    ]);
    const summaryByModule = new Map(
      (summaryCounts as any[]).map((s) => [String(s._id), s.n]),
    );
    return modules.map((m) => ({
      ...m,
      lessons: lessons.filter((l) => String(l.module) === String(m._id)),
      summaryCount: summaryByModule.get(String(m._id)) || 0,
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
    await this.sermonSummaryModel.deleteMany({ module: mod._id });
    return { success: true };
  }

  // ── Module audio messages ("Messages to listen to") ──────────────────────

  /** Attach an uploaded audio message to a module (facilitator). */
  async addModuleAudioMessage(
    moduleId: string,
    dto: { url: string; title?: string; fileName?: string },
  ) {
    const mod = await this.moduleModel.findById(moduleId);
    if (!mod) throw new NotFoundException('Module not found');
    const message = {
      id: new Types.ObjectId().toString(),
      title: (dto.title || '').trim() || 'Message',
      url: dto.url,
      fileName: dto.fileName,
      createdAt: new Date(),
    };
    (mod.audioMessages ||= []).push(message);
    await mod.save();
    return message;
  }

  /** Remove an audio message from a module (facilitator). */
  async removeModuleAudioMessage(moduleId: string, messageId: string) {
    const res = await this.moduleModel.updateOne(
      { _id: new Types.ObjectId(moduleId) },
      { $pull: { audioMessages: { id: messageId } } },
    );
    if (!res.matchedCount) throw new NotFoundException('Module not found');
    return { success: true };
  }

  private readonly SERMON_SUMMARY_MAX_WORDS = 500;

  private countWords(text: string): number {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  /** A learner's sermon summary for a module (one per module). */
  async getSermonSummary(account: PortalAccountDocument, moduleId: string) {
    const mod = await this.moduleModel.findById(moduleId).lean();
    if (!mod) throw new NotFoundException('Module not found');
    const registration = await this.registrationModel.findOne({
      event: mod.event,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) throw new ForbiddenException('Not enrolled.');
    const summary = await this.sermonSummaryModel
      .findOne({ module: mod._id, registration: registration._id })
      .lean();
    return {
      content: summary?.content || '',
      wordCount: summary?.wordCount || 0,
      submitted: !!summary?.submittedAt,
      submittedAt: summary?.submittedAt || null,
      maxWords: this.SERMON_SUMMARY_MAX_WORDS,
      grade: typeof summary?.grade === 'number' ? summary.grade : null,
      feedback: summary?.feedback || '',
      gradedAt: summary?.gradedAt || null,
    };
  }

  /** Save a learner's sermon summary for a module (≤ 500 words). */
  async saveSermonSummary(
    account: PortalAccountDocument,
    moduleId: string,
    content: string,
  ) {
    const mod = await this.moduleModel.findById(moduleId);
    if (!mod) throw new NotFoundException('Module not found');
    if (!(mod.audioMessages || []).length) {
      throw new BadRequestException('This module has no messages to summarise.');
    }
    const registration = await this.registrationModel.findOne({
      event: mod.event,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) throw new ForbiddenException('Not enrolled.');

    const clean = (content || '').trim();
    const words = this.countWords(clean);
    if (!words) throw new BadRequestException('Write a short summary first.');
    if (words > this.SERMON_SUMMARY_MAX_WORDS) {
      throw new BadRequestException(
        `Keep your summary to ${this.SERMON_SUMMARY_MAX_WORDS} words or fewer (currently ${words}).`,
      );
    }
    await this.sermonSummaryModel.updateOne(
      { module: mod._id, registration: registration._id },
      {
        $set: {
          event: mod.event,
          content: clean,
          wordCount: words,
          submittedAt: new Date(),
        },
        $setOnInsert: { module: mod._id, registration: registration._id },
      },
      { upsert: true },
    );
    return { success: true, wordCount: words };
  }

  /**
   * Facilitator: all learners' sermon summaries for a module — the note they
   * wrote for the "Messages to listen to", with grade/feedback for review.
   */
  async listModuleSermonSummaries(moduleId: string) {
    const mod = await this.moduleModel.findById(moduleId).lean();
    if (!mod) throw new NotFoundException('Module not found');
    const summaries = await this.sermonSummaryModel
      .find({ module: mod._id, submittedAt: { $ne: null } })
      .lean();
    const regIds = summaries.map((s) => s.registration);
    const regs = await this.registrationModel
      .find({ _id: { $in: regIds } })
      .select('attendeeInfo')
      .lean();
    const byId = new Map(regs.map((r) => [String(r._id), r]));
    const items = summaries
      .map((s) => {
        const r = byId.get(String(s.registration));
        const name =
          `${r?.attendeeInfo?.firstName || ''} ${r?.attendeeInfo?.lastName || ''}`.trim();
        return {
          id: String(s._id),
          student: name || r?.attendeeInfo?.email || 'Unknown',
          email: r?.attendeeInfo?.email || null,
          content: s.content || '',
          wordCount: s.wordCount || 0,
          submittedAt: s.submittedAt || null,
          grade: typeof s.grade === 'number' ? s.grade : null,
          feedback: s.feedback || '',
          gradedAt: s.gradedAt || null,
        };
      })
      .sort((a, b) => a.student.localeCompare(b.student));
    return {
      module: { id: String(mod._id), title: mod.title },
      total: items.length,
      graded: items.filter((i) => i.grade !== null).length,
      items,
    };
  }

  /** Facilitator: every learner's written reflection for one lesson. */
  async getLessonReflections(lessonId: string) {
    const lesson = await this.lessonModel
      .findById(lessonId)
      .select('title reflectionPrompt')
      .lean();
    if (!lesson) throw new NotFoundException('Lesson not found');

    const progresses = await this.progressModel
      .find({ lesson: lesson._id, reflection: { $nin: [null, ''] } })
      .select('registration reflection updatedAt')
      .lean();
    const regIds = progresses.map((p) => p.registration);
    const regs = await this.registrationModel
      .find({ _id: { $in: regIds } })
      .select('attendeeInfo')
      .lean();
    const byId = new Map(regs.map((r) => [String(r._id), r]));

    const items = progresses
      .map((p) => {
        const r = byId.get(String(p.registration));
        const name =
          `${r?.attendeeInfo?.firstName || ''} ${r?.attendeeInfo?.lastName || ''}`.trim();
        return {
          student: name || r?.attendeeInfo?.email || 'Unknown',
          email: r?.attendeeInfo?.email || null,
          content: (p.reflection || '').trim(),
          updatedAt: (p as any).updatedAt || null,
        };
      })
      .filter((i) => i.content)
      .sort((a, b) => a.student.localeCompare(b.student));

    return {
      lesson: {
        id: String(lesson._id),
        title: lesson.title,
        prompt: (lesson as any).reflectionPrompt || '',
      },
      total: items.length,
      items,
    };
  }

  /** Facilitator: grade a learner's sermon summary (0–100) + optional feedback. */
  async gradeSermonSummary(
    summaryId: string,
    grade?: number,
    feedback?: string,
  ) {
    const set: any = { gradedAt: new Date() };
    if (grade !== undefined && grade !== null) {
      const g = Number(grade);
      if (!Number.isFinite(g) || g < 0 || g > 100) {
        throw new BadRequestException('Grade must be between 0 and 100.');
      }
      set.grade = Math.round(g);
    }
    if (feedback !== undefined) set.feedback = (feedback || '').trim();
    const s = await this.sermonSummaryModel.findByIdAndUpdate(
      summaryId,
      { $set: set },
      { new: true },
    );
    if (!s) throw new NotFoundException('Summary not found');
    return { success: true };
  }

  /**
   * Bulk-grade a module's sermon summaries from a re-uploaded CSV. Each row is
   * matched by summary id; rows with a valid 0–100 grade are applied (feedback
   * optional). Invalid/blank grades are skipped and reported.
   */
  async bulkGradeSermonSummaries(
    moduleId: string,
    grades: Array<{ id?: string; grade?: any; feedback?: string }>,
  ) {
    const mod = await this.moduleModel.findById(moduleId).lean();
    if (!mod) throw new NotFoundException('Module not found');
    if (!Array.isArray(grades)) {
      throw new BadRequestException('Expected a list of grades.');
    }

    // Only touch summaries that belong to this module.
    const owned = new Set(
      (
        await this.sermonSummaryModel
          .find({ module: mod._id })
          .select('_id')
          .lean()
      ).map((s) => String(s._id)),
    );

    const now = new Date();
    let updated = 0;
    const skipped: Array<{ id?: string; reason: string }> = [];
    const ops: any[] = [];

    for (const row of grades) {
      const id = (row?.id || '').trim();
      if (!id) {
        skipped.push({ id: row?.id, reason: 'missing id' });
        continue;
      }
      if (!owned.has(id)) {
        skipped.push({ id, reason: 'not in this module' });
        continue;
      }
      const hasGrade =
        row.grade !== undefined && row.grade !== null && `${row.grade}`.trim() !== '';
      const hasFeedback = row.feedback !== undefined;
      if (!hasGrade && !hasFeedback) {
        skipped.push({ id, reason: 'no grade' });
        continue;
      }
      const set: any = { gradedAt: now };
      if (hasGrade) {
        const g = Number(row.grade);
        if (!Number.isFinite(g) || g < 0 || g > 100) {
          skipped.push({ id, reason: `invalid grade "${row.grade}"` });
          continue;
        }
        set.grade = Math.round(g);
      }
      if (hasFeedback) set.feedback = (row.feedback || '').trim();
      ops.push({
        updateOne: { filter: { _id: new Types.ObjectId(id) }, update: { $set: set } },
      });
      updated += 1;
    }

    if (ops.length) await this.sermonSummaryModel.bulkWrite(ops, { ordered: false });
    return { updated, skipped: skipped.length, skippedRows: skipped };
  }

  // ===================== Q&A community feed ====================================
  //
  //  Facilitators publish a week's questions + answers (text or audio). Learners
  //  see a read-only feed and can drop one reaction per post (no comments).

  private readonly QA_REACTIONS = ['🙏', '❤️', '🔥', '👍', '😮', '💡'];

  private shapeQaPost(p: any, myRegId?: string) {
    const counts: Record<string, number> = {};
    let total = 0;
    let mine: string | null = null;
    for (const r of p.reactions || []) {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
      total += 1;
      if (myRegId && String(r.registration) === myRegId) mine = r.emoji;
    }
    return {
      id: String(p._id),
      label: p.label || null,
      question: p.question,
      answerType: p.answerType,
      answerText: p.answerText || null,
      answerAudioUrl: p.answerAudioUrl || null,
      answerAudioName: p.answerAudioName || null,
      createdAt: p.createdAt,
      reactions: counts,
      reactionTotal: total,
      myReaction: mine,
    };
  }

  async createQaPost(
    eventId: string,
    dto: {
      question: string;
      label?: string;
      answerType?: 'text' | 'audio';
      answerText?: string;
      answerAudioUrl?: string;
      answerAudioName?: string;
    },
  ) {
    await this.assertEvent(eventId);
    const question = (dto.question || '').trim();
    if (!question) throw new BadRequestException('A question is required.');
    const answerType = dto.answerType === 'audio' ? 'audio' : 'text';
    if (answerType === 'audio' && !dto.answerAudioUrl) {
      throw new BadRequestException('Upload the audio answer first.');
    }
    if (answerType === 'text' && !(dto.answerText || '').trim()) {
      throw new BadRequestException('Write a text answer.');
    }
    const post = await this.qaPostModel.create({
      event: new Types.ObjectId(eventId),
      label: (dto.label || '').trim() || undefined,
      question,
      answerType,
      answerText: answerType === 'text' ? (dto.answerText || '').trim() : undefined,
      answerAudioUrl: answerType === 'audio' ? dto.answerAudioUrl : undefined,
      answerAudioName: answerType === 'audio' ? dto.answerAudioName : undefined,
    });
    return this.shapeQaPost(post.toObject());
  }

  async listQaPosts(eventId: string) {
    await this.assertEvent(eventId);
    const posts = await this.qaPostModel
      .find({ event: new Types.ObjectId(eventId) })
      .sort({ createdAt: -1 })
      .lean();
    return { items: posts.map((p) => this.shapeQaPost(p)) };
  }

  async deleteQaPost(postId: string) {
    const res = await this.qaPostModel.findByIdAndDelete(postId);
    if (!res) throw new NotFoundException('Post not found');
    return { success: true };
  }

  async getQaFeed(account: PortalAccountDocument, eventSlug?: string) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    const posts = await this.qaPostModel
      .find({ event: event._id })
      .sort({ createdAt: -1 })
      .lean();
    const myReg = String(registration._id);
    return {
      supportEmail: 'cmithub@gmail.com',
      reactions: this.QA_REACTIONS,
      items: posts.map((p) => this.shapeQaPost(p, myReg)),
    };
  }

  /**
   * Public (unauthenticated) Q&A feed for a cohort — every published answer,
   * newest first. Read-only; no per-viewer reaction state. Callers (the public
   * marketing page) hide the section entirely when `items` is empty.
   */
  async getPublicQaFeed(eventSlug?: string) {
    const event = await this.eventModel
      .findOne({ registrationSlug: eventSlug || 'cmit-cohort-1' })
      .select('_id')
      .lean();
    if (!event) return { supportEmail: 'cmithub@gmail.com', items: [] };
    const posts = await this.qaPostModel
      .find({ event: event._id })
      .sort({ createdAt: -1 })
      .lean();
    return {
      supportEmail: 'cmithub@gmail.com',
      items: posts.map((p) => this.shapeQaPost(p)),
    };
  }

  async reactToQaPost(
    account: PortalAccountDocument,
    postId: string,
    emoji: string,
  ) {
    const post = await this.qaPostModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');
    const registration = await this.registrationModel.findOne({
      event: post.event,
      'attendeeInfo.email': account.email,
      admissionStatus: 'accepted',
    });
    if (!registration) throw new ForbiddenException('Not enrolled.');

    const regId = registration._id as Types.ObjectId;
    const existing = (post.reactions || []).find(
      (r) => String(r.registration) === String(regId),
    );
    // Toggle off if same emoji; otherwise set/replace. Empty emoji clears.
    if (!emoji || (existing && existing.emoji === emoji)) {
      post.reactions = (post.reactions || []).filter(
        (r) => String(r.registration) !== String(regId),
      );
    } else if (this.QA_REACTIONS.includes(emoji)) {
      post.reactions = (post.reactions || []).filter(
        (r) => String(r.registration) !== String(regId),
      );
      post.reactions.push({ registration: regId, emoji });
    } else {
      throw new BadRequestException('Unknown reaction.');
    }
    await post.save();
    return this.shapeQaPost(post.toObject(), String(regId));
  }

  // ===================== Facilitator audit log =================================
  //
  //  Every change action on the facilitator dashboard is recorded (who/what/
  //  when) via FacilitatorAuditInterceptor and shown to all facilitators.

  // Turn a controller handler name into a readable action, e.g.
  // "gradeSermonSummary" → "Grade sermon summary".
  private humanizeAuditAction(handler: string): string {
    const words = String(handler || 'action')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim()
      .toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  // Best-effort resolve of the owning event from route params, so audit entries
  // land under the right event even when the route doesn't carry :eventId.
  private async resolveEventIdForAudit(
    params: Record<string, string>,
  ): Promise<Types.ObjectId | null> {
    const oid = (v?: string) => {
      try {
        return v ? new Types.ObjectId(v) : null;
      } catch {
        return null;
      }
    };
    if (params.eventId) return oid(params.eventId);
    try {
      if (params.moduleId) {
        const m = await this.moduleModel
          .findById(params.moduleId)
          .select('event')
          .lean();
        return (m?.event as Types.ObjectId) || null;
      }
      if (params.lessonId) {
        const l = await this.lessonModel
          .findById(params.lessonId)
          .select('event')
          .lean();
        return (l?.event as Types.ObjectId) || null;
      }
      if (params.summaryId) {
        const s = await this.sermonSummaryModel
          .findById(params.summaryId)
          .select('event')
          .lean();
        return (s?.event as Types.ObjectId) || null;
      }
      if (params.sessionId) {
        const s = await this.sessionModel
          .findById(params.sessionId)
          .select('event')
          .lean();
        return (s?.event as Types.ObjectId) || null;
      }
      if (params.assignmentId) {
        const a = await this.assignmentModel
          .findById(params.assignmentId)
          .select('event')
          .lean();
        return (a?.event as Types.ObjectId) || null;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  /** Write one audit entry for a facilitator change action (never throws). */
  async recordFacilitatorAudit(ctx: {
    handler: string;
    method: string;
    path: string;
    params: Record<string, string>;
    actor?: any;
  }) {
    try {
      const event = await this.resolveEventIdForAudit(ctx.params || {});
      const actor = ctx.actor || {};
      const actorName =
        `${actor.firstName || ''} ${actor.lastName || ''}`.trim() ||
        actor.email ||
        'A facilitator';
      await this.auditModel.create({
        event: event || undefined,
        actor: actor?._id,
        actorName,
        actorEmail: actor?.email,
        action: this.humanizeAuditAction(ctx.handler),
        method: ctx.method,
        path: ctx.path,
      });
    } catch {
      /* auditing must never break the request */
    }
  }

  /** Paginated audit log for an event (visible to all its facilitators). */
  async getAuditLog(
    eventId: string,
    opts: { page?: number; limit?: number } = {},
  ) {
    await this.assertEvent(eventId);
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, Math.max(1, opts.limit || 30));
    const filter = { event: new Types.ObjectId(eventId) };
    const [rows, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.auditModel.countDocuments(filter),
    ]);
    return {
      items: rows.map((r) => ({
        id: String(r._id),
        actor: r.actorName || 'A facilitator',
        action: r.action,
        method: r.method || null,
        at: r.createdAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
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
    const [modules, lessons, completed, summaries] = await Promise.all([
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
      this.sermonSummaryModel
        .find({ registration: registrationId, submittedAt: { $ne: null } })
        .select('module')
        .lean(),
    ]);

    const completedSet = new Set(completed.map((p) => String(p.lesson)));
    const summarySet = new Set(summaries.map((s) => String(s.module)));
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
      // A module with audio messages also requires the learner's summary note
      // — it counts as one extra completion task.
      const needsSummary = ((m as any).audioMessages || []).length > 0;
      const summaryDone = needsSummary && summarySet.has(mid);
      const total = ids.length + (needsSummary ? 1 : 0);
      const done =
        ids.filter((id) => completedSet.has(id)).length +
        (summaryDone ? 1 : 0);
      const complete = total === 0 ? true : done === total;
      const locked = !prevComplete;
      map[mid] = { total, done, complete, locked };
      // A locked module never unlocks the next one — even if its lessons were
      // completed earlier. The chain is strictly sequential.
      prevComplete = !locked && complete;
    }
    return { modules, map, summarySet };
  }

  async getCurriculum(account: PortalAccountDocument, eventSlug?: string) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    const [lessons, { modules, map, summarySet }, sessions] = await Promise.all([
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
          // "Messages to listen to" — audio the learner plays/downloads.
          audioMessages: ((m as any).audioMessages || []).map((a: any) => ({
            id: a.id,
            title: a.title,
            url: a.url,
            fileName: a.fileName || null,
          })),
          // A summary note is required to complete a module that has messages.
          summaryRequired: (((m as any).audioMessages || []).length || 0) > 0,
          summarySubmitted: summarySet.has(String(m._id)),
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
    const { map, modules } = await this.computeModuleProgress(
      lesson.event as Types.ObjectId,
      registration._id as Types.ObjectId,
    );
    if (map[String(lesson.module)]?.locked) {
      throw new ForbiddenException(
        'Complete the previous module to unlock this lesson.',
      );
    }

    // Prev/next lesson pointers — the lessons flattened in module order, then
    // lesson order, so "Next" flows from the end of one module into the start
    // of the next. `locked` marks a target whose module isn't unlocked yet.
    const orderedLessons = await this.lessonModel
      .find({ event: lesson.event, status: 'published' })
      .sort({ order: 1 })
      .select('title module order')
      .lean();
    const flat: any[] = [];
    for (const m of modules) {
      const mid = String(m._id);
      for (const l of orderedLessons) {
        if (String(l.module) === mid) flat.push(l);
      }
    }
    const idx = flat.findIndex((l) => String(l._id) === String(lesson._id));
    const toNav = (l: any) =>
      l
        ? { id: l._id, title: l.title, locked: !!map[String(l.module)]?.locked }
        : null;
    const nav = {
      prev: idx > 0 ? toNav(flat[idx - 1]) : null,
      next: idx >= 0 && idx < flat.length - 1 ? toNav(flat[idx + 1]) : null,
    };

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
      nav,
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
   * scheduled start→end (5 min early grace, 30 min late grace) counts as LIVE
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
    const openFrom = start.getTime() - 5 * 60_000; // join opens 5 min early
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
    opts?: { isLive?: boolean; joined?: boolean },
  ): 'present' | 'late' | 'absent' | 'attending' {
    // At/above threshold: attended. 'late' only if they joined after the
    // session's late-arrival grace window (e.g. watching a replay long after
    // the scheduled start); otherwise 'present'.
    if (minutes >= thresholdMinutes) return late ? 'late' : 'present';
    // Below threshold, but they've joined a session that's live right now →
    // 'attending' (in the room, still accumulating). Finalize (isLive false)
    // resolves this to 'absent' if the threshold was never reached.
    if (opts?.isLive && opts?.joined) return 'attending';
    return 'absent';
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
      .select('lastBeatAt statusManual')
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
    // They're sending a heartbeat, so they've joined. During the live window a
    // below-threshold learner is 'attending' (present once they cross it).
    const status = this.deriveStatus(liveMinutes, late, threshold, {
      isLive,
      joined: true,
    });
    const watched = attendedMinutes >= threshold;

    // A facilitator's manual status wins — don't let heartbeats overwrite it.
    if (
      doc &&
      !prior?.statusManual &&
      (doc.status !== status || doc.watched !== watched)
    ) {
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
    const counts: Record<string, number> = {
      present: 0,
      late: 0,
      absent: 0,
      attending: 0,
    };
    let watched = 0; // reached threshold via any watch-time (live or replay)
    let views = 0; // total viewing sessions across all learners
    for (const row of rows) {
      // A facilitator's manual status is preserved — don't recompute it.
      if (row.statusManual) {
        counts[row.status] = (counts[row.status] || 0) + 1;
        if (row.watched) watched += 1;
        views += row.watchCount || 0;
        continue;
      }
      const late = this.isLateJoin(session, row.checkInTime);
      // Finalizing after the session — no live context, so below-threshold
      // 'attending' learners resolve to 'absent'.
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

    const { byReg, withoutEmail, unmatched } = await this.matchZoomParticipants(
      session,
      participants.map((p) => ({
        email: p.user_email,
        name: p.name,
        seconds: Number(p.duration) || 0,
        joinTime: p.join_time ? new Date(p.join_time) : undefined,
      })),
    );

    return this.writeReconciledAttendance(session, byReg, {
      withoutEmail,
      unmatched,
      totalParticipants: participants.length,
      meetingId,
      occurrence,
    });
  }

  /**
   * Match a list of Zoom participants to accepted registrants — by email first,
   * then by normalized full name (the embedded SDK injects the learner's name
   * but no email). Ambiguous duplicate names are dropped so we never credit the
   * wrong person. Aggregates watch-seconds + earliest join per registration.
   */
  private async matchZoomParticipants(
    session: EventSessionDocument,
    participants: Array<{
      email?: string | null;
      name?: string | null;
      seconds: number;
      joinTime?: Date;
    }>,
  ) {
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
      const email = (p.email || '').trim().toLowerCase();
      if (!email) withoutEmail += 1;
      const reg =
        (email && regByEmail.get(email)) || regByName.get(normName(p.name || ''));
      const seconds = Number(p.seconds) || 0;
      if (!reg) {
        unmatched.push({
          email: email || null,
          name: p.name || undefined,
          minutes: Math.round(seconds / 60),
        });
        continue;
      }
      const k = String(reg._id);
      const rec = byReg.get(k) || { reg, seconds: 0 };
      rec.seconds += seconds;
      if (p.joinTime && (!rec.firstJoin || p.joinTime < rec.firstJoin))
        rec.firstJoin = p.joinTime;
      byReg.set(k, rec);
    }
    return { byReg, withoutEmail, unmatched };
  }

  /**
   * Reconcile matched Zoom minutes against the platform heartbeat and persist.
   * A learner is present if EITHER signal meets the threshold; disagreements are
   * flagged (but still marked present). Shared by the API sync and CSV upload.
   */
  private async writeReconciledAttendance(
    session: EventSessionDocument,
    byReg: Map<string, { reg: any; seconds: number; firstJoin?: Date }>,
    meta: {
      withoutEmail: number;
      unmatched: Array<{ email: string | null; name?: string; minutes: number }>;
      totalParticipants: number;
      meetingId?: string | null;
      occurrence?: string | null;
      source?: 'api' | 'csv';
    },
  ) {
    const threshold = this.presentThresholdFor(session);
    const sStartMs =
      this.sessionStart(session)?.getTime() ?? new Date(session.date).getTime();

    const existing = await this.attendanceModel
      .find({ session: session._id })
      .lean();
    const platformByReg = new Map<string, any>();
    for (const a of existing) platformByReg.set(String(a.registration), a);

    const regIds = new Set<string>([...byReg.keys(), ...platformByReg.keys()]);
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
      // A facilitator's manual status is kept as-is (not recomputed/flagged).
      const manual = !!p?.statusManual;
      const status = manual
        ? (p.status as string)
        : isPresent
          ? isLate
            ? 'late'
            : 'present'
          : 'absent';
      if (status === 'present') present++;
      else if (status === 'late') late++;

      // YouTube-overflow viewers are never expected in the Zoom report, so a
      // "0 Zoom minutes" gap is by-design, not a discrepancy — skip flagging.
      const isOverflow = p?.watchSource === 'youtube';
      let discrepancy: string | undefined;
      if (isOverflow || manual) {
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
      sessionId: String(session._id),
      meetingId: meta.meetingId ?? null,
      occurrence: meta.occurrence ?? null,
      source: meta.source ?? 'api',
      thresholdMinutes: threshold,
      totalParticipants: meta.totalParticipants,
      participantsWithoutEmail: meta.withoutEmail,
      processed: regIds.size,
      present,
      late,
      flagged: discrepancies.length,
      discrepancies: discrepancies.sort(
        (a, b) => b.platformMinutes - a.platformMinutes,
      ),
      unmatched: meta.unmatched.sort((a, b) => b.minutes - a.minutes),
    };
  }

  /**
   * Import a Zoom participant report CSV (exported from the Zoom web portal) and
   * reconcile it into attendance — matching by name/email, same as the live API
   * sync. Useful when the API report is unavailable or incomplete.
   */
  async importZoomAttendanceCsv(
    eventId: string,
    sessionId: string,
    csv: string,
  ) {
    await this.assertEvent(eventId);
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      event: new Types.ObjectId(eventId),
    });
    if (!session) throw new NotFoundException('Session not found');

    const participants = this.parseZoomCsv(csv);
    if (!participants.length) {
      throw new BadRequestException(
        'No participants found in the file. Upload the Zoom participant report ' +
          'CSV (with Name / Duration columns).',
      );
    }
    const { byReg, withoutEmail, unmatched } = await this.matchZoomParticipants(
      session,
      participants,
    );
    return this.writeReconciledAttendance(session, byReg, {
      withoutEmail,
      unmatched,
      totalParticipants: participants.length,
      meetingId: session.zoomMeetingId || null,
      source: 'csv',
    });
  }

  /**
   * Parse a Zoom participant report CSV. Handles the leading summary block Zoom
   * prepends and rows split by rejoining — returns one entry per row with name,
   * email and watch-seconds (Zoom reports "Duration (Minutes)").
   */
  private parseZoomCsv(
    csv: string,
  ): Array<{ email?: string; name?: string; seconds: number; joinTime?: Date }> {
    const rows = this.parseCsvRows(csv);
    if (!rows.length) return [];

    // Find the header row that names the participant columns (Zoom prepends a
    // meeting-summary block above it).
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const lower = rows[i].map((c) => c.trim().toLowerCase());
      const hasName = lower.some((c) => c.startsWith('name'));
      const hasDuration = lower.some((c) => c.includes('duration'));
      if (hasName && hasDuration) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) return [];

    const header = rows[headerIdx].map((c) => c.trim().toLowerCase());
    const col = (pred: (c: string) => boolean) => header.findIndex(pred);
    const nameIdx = col((c) => c.startsWith('name'));
    const emailIdx = col((c) => c.includes('email'));
    const durIdx = col((c) => c.includes('duration'));
    const joinIdx = col((c) => c.includes('join') && c.includes('time'));

    const out: Array<{
      email?: string;
      name?: string;
      seconds: number;
      joinTime?: Date;
    }> = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const name = nameIdx >= 0 ? (r[nameIdx] || '').trim() : '';
      const email = emailIdx >= 0 ? (r[emailIdx] || '').trim() : '';
      if (!name && !email) continue; // blank / trailing line
      const minutes = durIdx >= 0 ? parseFloat(r[durIdx] || '0') : 0;
      const jt = joinIdx >= 0 && r[joinIdx] ? new Date(r[joinIdx]) : undefined;
      out.push({
        name: name || undefined,
        email: email || undefined,
        seconds: Number.isFinite(minutes) ? Math.round(minutes * 60) : 0,
        joinTime: jt && !isNaN(jt.getTime()) ? jt : undefined,
      });
    }
    return out;
  }

  /** Minimal RFC-4180 CSV parser (handles quoted fields, commas, CRLF). */
  private parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    const src = text.replace(/^﻿/, ''); // strip BOM
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') {
            field += '"';
            i++;
          } else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      } else field += ch;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
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

  /**
   * Zoom `meeting.ended` webhook handler — the host ended the meeting, so end
   * the matching live session(s) for students automatically. Only sessions
   * whose live window contains "now" and aren't already ended are touched, so a
   * recurring meeting-id shared across sessions won't end a future one.
   */
  async handleZoomMeetingEnded(meetingId: string) {
    const id = (meetingId || '').replace(/\s+/g, '');
    if (!id) return { updated: 0 };
    const now = new Date();
    const sessions = await this.sessionModel.find({ zoomMeetingId: id });
    const targets = sessions.filter(
      (s) =>
        !(s as any).liveEndedAt &&
        this.isWithinLiveWindow(s as unknown as EventSessionDocument, now),
    );
    for (const s of targets) {
      (s as any).liveEndedAt = now;
      await s.save();
    }
    if (targets.length) {
      this.logger.log(
        `Zoom meeting ${id} ended — closed ${targets.length} live session(s).`,
      );
    }
    return { updated: targets.length, sessionIds: targets.map((s) => String(s._id)) };
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

  // ===================== Weekly module-completion reminders ====================
  //
  //  Every 48h, nudge accepted learners who haven't completed the current
  //  week's module: list the pending lessons if they've started, else just the
  //  module title. Set MODULE_REMINDER_ENABLED=false to switch off.

  @Cron('0 0 9 */2 * *', { timeZone: 'Africa/Lagos' })
  async sendModuleCompletionReminders() {
    if (process.env.MODULE_REMINDER_ENABLED === 'false') return;
    const events = await this.eventModel
      .find({
        'registrationSettings.applicationBaseUrl': { $exists: true, $ne: '' },
      })
      .lean();
    for (const event of events) {
      try {
        await this.remindCurrentModule(event as any);
      } catch (e) {
        this.logger.warn(
          `Module reminder for "${(event as any).title}" failed: ${(e as Error).message}`,
        );
      }
    }
  }

  /**
   * Build the reminder batch: for every "started week" (module whose session
   * has occurred), collect each accepted learner's incomplete modules — so a
   * learner behind on an earlier week is reminded about it too, not just the
   * current week. Per incomplete module: pending lessons if started, else the
   * module counts as not-started.
   */
  private async buildModuleReminderBatch(event: any) {
    const eventOid = event._id as Types.ObjectId;
    const modules = await this.moduleModel
      .find({
        event: eventOid,
        status: 'published',
        excludeFromReminders: { $ne: true },
      })
      .sort({ order: 1 })
      .lean();
    if (!modules.length) return null;

    // Released weeks = published modules not opted out of reminders (facilitators
    // publish a module when its week opens; drafts are future weeks). So a
    // learner behind on any released week — including an earlier one — is
    // reminded about it.
    const targets = modules;

    const targetIds = targets.map((m) => m._id);
    const lessons = await this.lessonModel
      .find({
        event: eventOid,
        module: { $in: targetIds },
        status: 'published',
        excludeFromCompletion: { $ne: true },
        isSessionRecording: { $ne: true },
      })
      .select('_id title order module')
      .sort({ order: 1 })
      .lean();
    const lessonsByModule = new Map<string, any[]>();
    for (const l of lessons) {
      const k = String(l.module);
      if (!lessonsByModule.has(k)) lessonsByModule.set(k, []);
      lessonsByModule.get(k)!.push(l);
    }
    const summaryModuleIds = targets
      .filter((m) => ((m.audioMessages as any[]) || []).length > 0)
      .map((m) => m._id);

    const regs = await this.registrationModel
      .find({ event: eventOid, admissionStatus: 'accepted' })
      .select('attendeeInfo')
      .lean();
    if (!regs.length) return { event, targets, recipients: [] };

    const regIds = regs.map((r) => r._id);
    const [progresses, summaries] = await Promise.all([
      lessons.length
        ? this.progressModel
            .find({
              registration: { $in: regIds },
              lesson: { $in: lessons.map((l) => l._id) },
            })
            .select('registration lesson status')
            .lean()
        : [],
      summaryModuleIds.length
        ? this.sermonSummaryModel
            .find({
              module: { $in: summaryModuleIds },
              registration: { $in: regIds },
              submittedAt: { $ne: null },
            })
            .select('registration module')
            .lean()
        : [],
    ]);

    const doneByReg = new Map<string, Set<string>>(); // completed lesson ids
    const startedLessonModuleByReg = new Map<string, Set<string>>(); // module ids with any progress
    for (const p of progresses) {
      const rk = String(p.registration);
      const lm = lessons.find((l) => String(l._id) === String(p.lesson));
      if (lm) {
        if (!startedLessonModuleByReg.has(rk))
          startedLessonModuleByReg.set(rk, new Set());
        startedLessonModuleByReg.get(rk)!.add(String(lm.module));
      }
      if (p.status === 'completed') {
        if (!doneByReg.has(rk)) doneByReg.set(rk, new Set());
        doneByReg.get(rk)!.add(String(p.lesson));
      }
    }
    const summaryByReg = new Map<string, Set<string>>(); // module ids w/ summary
    for (const s of summaries) {
      const rk = String(s.registration);
      if (!summaryByReg.has(rk)) summaryByReg.set(rk, new Set());
      summaryByReg.get(rk)!.add(String(s.module));
    }

    const recipients: Array<{
      email: string;
      firstName: string;
      modules: Array<{ title: string; started: boolean; pending: string[] }>;
    }> = [];
    for (const r of regs) {
      const email = r.attendeeInfo?.email;
      if (!email) continue;
      const rk = String(r._id);
      const done = doneByReg.get(rk) || new Set();
      const startedModules = startedLessonModuleByReg.get(rk) || new Set();
      const summaryModules = summaryByReg.get(rk) || new Set();

      const incomplete: Array<{
        title: string;
        started: boolean;
        pending: string[];
      }> = [];
      for (const m of targets) {
        const mid = String(m._id);
        const ml = lessonsByModule.get(mid) || [];
        const needsSummary = ((m.audioMessages as any[]) || []).length > 0;
        const lessonsComplete =
          ml.length === 0 || ml.every((l) => done.has(String(l._id)));
        const summaryOk = !needsSummary || summaryModules.has(mid);
        if (lessonsComplete && summaryOk) continue; // this module is complete

        const started =
          startedModules.has(mid) || summaryModules.has(mid);
        const pending = ml
          .filter((l) => !done.has(String(l._id)))
          .map((l) => l.title);
        if (needsSummary && !summaryModules.has(mid)) {
          pending.push('Write your summary of the messages');
        }
        incomplete.push({ title: m.title, started, pending });
      }
      if (!incomplete.length) continue; // fully caught up → no reminder
      recipients.push({
        email,
        firstName: r.attendeeInfo?.firstName || 'there',
        modules: incomplete,
      });
    }
    return { event, targets, recipients };
  }

  private async remindCurrentModule(event: any) {
    const batch = await this.buildModuleReminderBatch(event);
    if (!batch || !batch.recipients.length) return;
    const from = this.senderFromEvent(event);
    const base =
      event.registrationSettings?.applicationBaseUrl?.replace(/\/+$/, '') ||
      process.env.FRONTEND_URL ||
      '';
    const portalUrl = base ? `${base}/portal/courses` : '';
    let sent = 0;
    for (const r of batch.recipients) {
      try {
        const { subject, html } = this.renderModuleReminderEmail({
          firstName: r.firstName,
          modules: r.modules,
          portalUrl,
        });
        await this.emailProvider.sendEmail({
          to: r.email,
          subject,
          html,
          ...(from ? { from } : {}),
        });
        sent += 1;
        await new Promise((res) => setTimeout(res, 150)); // gentle Gmail throttle
      } catch (e) {
        this.logger.warn(
          `Module reminder to ${r.email} failed: ${(e as Error).message}`,
        );
      }
    }
    this.logger.log(
      `Module reminders for "${event.title}": ${sent}/${batch.recipients.length} sent.`,
    );
  }

  /**
   * Branded reminder email listing every incomplete module — pending lessons
   * for ones they've started, "not started yet" for the rest.
   */
  renderModuleReminderEmail(ctx: {
    firstName: string;
    modules: Array<{ title: string; started: boolean; pending: string[] }>;
    portalUrl: string;
  }): { subject: string; html: string } {
    const esc = (s: string) =>
      String(s || '').replace(
        /[&<>"]/g,
        (c) =>
          ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c,
      );
    const { firstName, modules, portalUrl } = ctx;
    const n = modules.length;
    const subject =
      n === 1
        ? `A quick nudge: finish ${modules[0].title}`
        : `You have ${n} modules to catch up on`;
    const intro =
      n === 1
        ? `Here's what's left to complete:`
        : `You're a little behind — here's everything still to complete, including earlier weeks:`;
    const sections = modules
      .map((m) => {
        const body =
          m.started && m.pending.length
            ? `<ul style="margin:8px 0 0;padding-left:20px;color:#3a4066;font-size:14px;line-height:1.7">${m.pending
                .map((p) => `<li>${esc(p)}</li>`)
                .join('')}</ul>`
            : `<p style="margin:6px 0 0;font-size:13px;color:#8890ac">Not started yet.</p>`;
        return `<div style="margin:14px 0 0;padding:14px 16px;border:1px solid #eceef6;border-radius:12px;background:#fafbff">
          <div style="font-weight:700;font-size:15px;color:#1b2559">${esc(m.title)}</div>
          ${body}
        </div>`;
      })
      .join('');
    const button = portalUrl
      ? `<a href="${esc(portalUrl)}" style="display:inline-block;background:#1b2559;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:999px">Go to my courses →</a>`
      : '';
    const html = `<!doctype html><html><body style="margin:0;background:#f5f6fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="background:#fff;border:1px solid #e6e8f2;border-radius:20px;padding:28px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#c79a3a">Campus Ministers in Training</div>
      <h1 style="margin:10px 0 0;font-size:22px;line-height:1.25;color:#1b2559">Hi ${esc(firstName)},</h1>
      <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#3a4066">${intro}</p>
      ${sections}
      <div style="margin:22px 0 6px">${button}</div>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#8890ac">Have a question? Reply to this email or reach us at cmithub@gmail.com. Keep showing up — you've got this. 💪</p>
    </div>
    <p style="text-align:center;margin:16px 0 0;font-size:11px;color:#aab">A vision of Dami Oguntunde Teaching Ministries</p>
  </div></body></html>`;
    return { subject, html };
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
      .find({
        event: eventOid,
        attendanceDiscrepancy: { $ne: null },
        discrepancyResolved: { $ne: true },
      })
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
          id: String(f._id),
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

  /** Reconcile/close a flagged attendance discrepancy — drops it from the list. */
  async resolveAttendanceFlag(eventId: string, attendanceId: string) {
    await this.assertEvent(eventId);
    const res = await this.attendanceModel.updateOne(
      { _id: new Types.ObjectId(attendanceId), event: new Types.ObjectId(eventId) },
      { $set: { discrepancyResolved: true, discrepancyResolvedAt: new Date() } },
    );
    if (!res.matchedCount) throw new NotFoundException('Attendance not found');
    return { success: true };
  }

  // ===================== Attendance tracker (facilitator) ======================
  //
  //  A dedicated view over live-session attendance: an event-wide breakdown
  //  (present/late/attending/absent per session + overall) and per-session
  //  detail (each learner's watch-time, replays, source and status).

  /** Event-wide attendance breakdown: one row per session + overall totals. */
  async getAttendanceOverview(eventId: string) {
    await this.assertEvent(eventId);
    const eventOid = new Types.ObjectId(eventId);
    const [sessions, acceptedCount, attendance] = await Promise.all([
      this.sessionModel
        .find({ event: eventOid })
        .sort({ order: 1, date: 1 })
        .select('title order date startTime endTime')
        .lean(),
      this.registrationModel.countDocuments({
        event: eventOid,
        admissionStatus: 'accepted',
      }),
      this.attendanceModel
        .find({ event: eventOid })
        .select('session status')
        .lean(),
    ]);

    const bySession = new Map<string, any[]>();
    for (const a of attendance) {
      const k = String(a.session);
      if (!bySession.has(k)) bySession.set(k, []);
      bySession.get(k)!.push(a);
    }

    const overall = { present: 0, late: 0, attending: 0, absent: 0, excused: 0 };
    const sessionRows = sessions.map((s) => {
      const rows = bySession.get(String(s._id)) || [];
      const counts = {
        present: 0,
        late: 0,
        attending: 0,
        absent: 0,
        excused: 0,
      };
      for (const r of rows) {
        if (counts[r.status as keyof typeof counts] !== undefined)
          counts[r.status as keyof typeof counts]++;
      }
      // Accepted learners with no record at all → absent.
      counts.absent += Math.max(0, acceptedCount - rows.length);
      for (const k of Object.keys(overall) as (keyof typeof overall)[])
        overall[k] += counts[k];
      const attended = counts.present + counts.late;
      return {
        sessionId: s._id,
        title: s.title,
        order: s.order,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        counts,
        totalRegistrants: acceptedCount,
        attendanceRate: acceptedCount
          ? Math.round((attended / acceptedCount) * 100)
          : 0,
      };
    });

    const slots = acceptedCount * sessions.length;
    return {
      overall: {
        ...overall,
        totalRegistrants: acceptedCount,
        sessions: sessions.length,
        attendanceRate: slots
          ? Math.round(((overall.present + overall.late) / slots) * 100)
          : 0,
      },
      sessions: sessionRows,
    };
  }

  /** Per-session attendance detail — one row per accepted learner. */
  /**
   * Facilitator manually sets a learner's status for a session. Marked
   * `statusManual` so the heartbeat / Zoom sync / finalize leave it untouched.
   */
  async setAttendanceStatus(
    eventId: string,
    sessionId: string,
    registrationId: string,
    status: string,
  ) {
    await this.assertEvent(eventId);
    const allowed = ['present', 'late', 'absent', 'excused'];
    if (!allowed.includes(status)) {
      throw new BadRequestException('Invalid status.');
    }
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      event: new Types.ObjectId(eventId),
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.attendanceModel.updateOne(
      {
        session: session._id,
        registration: new Types.ObjectId(registrationId),
      },
      {
        $set: {
          status,
          watched: status === 'present' || status === 'late',
          statusManual: true,
          statusManualAt: new Date(),
        },
        $setOnInsert: {
          event: session.event,
          session: session._id,
          registration: new Types.ObjectId(registrationId),
        },
      },
      { upsert: true },
    );
    return { success: true, status };
  }

  /**
   * Bulk-mark every learner who watched a session for at least `minMinutes` as
   * present. `field` picks the watch-time source: 'attended' = total watch-time
   * (live + replay, the platform total), 'live' = only the live-window minutes.
   * Marked rows are set statusManual so the automated writers won't revert them.
   */
  async bulkMarkPresentByWatchTime(
    eventId: string,
    sessionId: string,
    opts: { minMinutes?: number; field?: 'attended' | 'live' } = {},
  ) {
    await this.assertEvent(eventId);
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      event: new Types.ObjectId(eventId),
    });
    if (!session) throw new NotFoundException('Session not found');

    const minMinutes = Math.max(1, Number(opts.minMinutes) || 20);
    const field = opts.field === 'live' ? 'liveMinutes' : 'attendedMinutes';

    const res = await this.attendanceModel.updateMany(
      {
        session: session._id,
        [field]: { $gte: minMinutes },
        // Don't touch those already present, or deliberately excused.
        status: {
          $nin: [
            SessionAttendanceStatus.PRESENT,
            SessionAttendanceStatus.EXCUSED,
          ],
        },
      },
      {
        $set: {
          status: SessionAttendanceStatus.PRESENT,
          watched: true,
          statusManual: true,
          statusManualAt: new Date(),
        },
      },
    );

    return {
      success: true,
      minMinutes,
      field,
      updated: res.modifiedCount ?? 0,
    };
  }

  async getSessionAttendanceDetail(eventId: string, sessionId: string) {
    await this.assertEvent(eventId);
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      event: new Types.ObjectId(eventId),
    });
    if (!session) throw new NotFoundException('Session not found');
    const threshold = this.presentThresholdFor(session);

    const [regs, attendance] = await Promise.all([
      this.registrationModel
        .find({ event: session.event, admissionStatus: 'accepted' })
        .select('attendeeInfo')
        .lean(),
      this.attendanceModel.find({ session: session._id }).lean(),
    ]);
    const attByReg = new Map(attendance.map((a) => [String(a.registration), a]));

    const counts = { present: 0, late: 0, attending: 0, absent: 0, excused: 0 };
    const items = regs.map((r) => {
      const a = attByReg.get(String(r._id));
      const status = (a?.status as string) || 'absent';
      if (counts[status as keyof typeof counts] !== undefined)
        counts[status as keyof typeof counts]++;
      const name =
        `${r.attendeeInfo?.firstName || ''} ${r.attendeeInfo?.lastName || ''}`.trim();
      return {
        registrationId: String(r._id),
        student: name || r.attendeeInfo?.email || 'Unknown',
        email: r.attendeeInfo?.email || null,
        status,
        manual: !!(a as any)?.statusManual,
        liveMinutes: Math.round((a as any)?.liveMinutes || 0),
        attendedMinutes: Math.round((a as any)?.attendedMinutes || 0),
        watchCount: (a as any)?.watchCount || 0,
        zoomMinutes: Math.round((a as any)?.zoomMinutes || 0),
        checkInTime: (a as any)?.checkInTime || null,
        lateByMinutes: (a as any)?.lateByMinutes || 0,
        watchSource: (a as any)?.watchSource || null,
        discrepancy: (a as any)?.attendanceDiscrepancy || null,
      };
    });
    // Most-engaged first, then by name — absent (0 min) sink to the bottom.
    items.sort(
      (x, y) =>
        y.liveMinutes - x.liveMinutes ||
        (x.student || '').localeCompare(y.student || ''),
    );

    return {
      session: {
        id: session._id,
        title: session.title,
        order: session.order,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        thresholdMinutes: threshold,
        zoomAttendanceSyncedAt: (session as any).zoomAttendanceSyncedAt || null,
      },
      counts,
      totalRegistrants: regs.length,
      items,
    };
  }

  // ===================== LEADERBOARD =====================
  //
  // Learners earn points for completed lessons, completing whole modules,
  // passed quizzes (scaled by score) and graded sermon summaries (scaled by
  // grade), plus a consecutive-week "streak" bonus on the all-time board.
  // Scores are snapshotted into `leaderboardentries` (scope 'overall' | 'weekly')
  // by a cron + on facilitator demand, so student reads are a cheap sort.
  // Weekly window = Sunday → Saturday, Africa/Lagos.

  // Africa/Lagos is a fixed UTC+1 (no DST), so a constant offset is exact.
  private static readonly LAGOS_OFFSET_MS = 60 * 60 * 1000;
  private static readonly WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  // Internal test accounts always kept off the board (in addition to the
  // facilitator-managed excludedEmails list).
  private isTestLearnerEmail(email?: string): boolean {
    if (!email) return false;
    return /^gthankgod(\+[^@]+)?@gmail\.com$/i.test(email.trim());
  }

  // Phased rollout: only these learners can open the leaderboard for now.
  // Everyone else gets a 403 (the portal also hides the nav for them).
  private static readonly LEADERBOARD_ALLOWLIST = new Set([
    'gthankgod+19@gmail.com',
    'damioguntunde@gmail.com',
    'nonsoorji67@gmail.com',
    'abigail.tolusanya@gmail.com',
  ]);

  private canViewLeaderboard(email?: string): boolean {
    if (!email) return false;
    return LmsService.LEADERBOARD_ALLOWLIST.has(email.trim().toLowerCase());
  }

  // Index of the Sun–Sat week a timestamp falls in (weeks since Unix epoch in
  // Lagos time). Used both to bucket "this week" and to measure streaks.
  private lagosWeekIndex(d: Date): number {
    const shifted = d.getTime() + LmsService.LAGOS_OFFSET_MS;
    // Unix epoch (1970-01-01) was a Thursday; shift so weeks start on Sunday.
    return Math.floor((shifted + 4 * 24 * 60 * 60 * 1000) / LmsService.WEEK_MS);
  }

  // Start (UTC instant) of the current Sun 00:00 Africa/Lagos window.
  private currentWeekStart(now = new Date()): Date {
    const idx = this.lagosWeekIndex(now);
    const startShifted =
      idx * LmsService.WEEK_MS - 4 * 24 * 60 * 60 * 1000;
    return new Date(startShifted - LmsService.LAGOS_OFFSET_MS);
  }

  private async getOrCreateWeights(
    eventOid: Types.ObjectId,
  ): Promise<LeaderboardWeightsDocument> {
    let w = await this.leaderboardWeightsModel.findOne({ event: eventOid });
    if (!w) {
      w = await this.leaderboardWeightsModel.create({ event: eventOid });
    }
    return w;
  }

  /**
   * Recompute + persist both leaderboard snapshots for an event. Idempotent:
   * wipes and rewrites the event's rows. Returns a small summary.
   */
  async recomputeLeaderboard(eventId: string) {
    const eventOid = new Types.ObjectId(eventId);
    const weights = await this.getOrCreateWeights(eventOid);
    const excluded = new Set(
      (weights.excludedEmails || []).map((e) => e.trim().toLowerCase()),
    );

    const [regs, modules, lessons, progresses, attempts, summaries] =
      await Promise.all([
        this.registrationModel
          .find({ event: eventOid, admissionStatus: 'accepted' })
          .lean(),
        this.moduleModel
          .find({ event: eventOid, status: 'published' })
          .select('_id')
          .lean(),
        this.lessonModel
          .find({
            event: eventOid,
            status: 'published',
            isSessionRecording: { $ne: true },
            excludeFromCompletion: { $ne: true },
          })
          .select('_id module')
          .lean(),
        this.progressModel
          .find({ event: eventOid, status: 'completed' })
          .select('registration lesson completedAt')
          .lean(),
        this.quizAttemptModel
          .find({ event: eventOid, passed: true })
          .select('registration score updatedAt')
          .lean(),
        this.sermonSummaryModel
          .find({ event: eventOid, grade: { $ne: null } })
          .select('registration grade gradedAt')
          .lean(),
      ]);

    // Countable lessons + module membership.
    const countableLesson = new Set(lessons.map((l) => String(l._id)));
    const lessonToModule: Record<string, string> = {};
    const moduleLessonCount: Record<string, number> = {};
    for (const l of lessons) {
      lessonToModule[String(l._id)] = String(l.module);
      const m = String(l.module);
      moduleLessonCount[m] = (moduleLessonCount[m] || 0) + 1;
    }
    // Only modules that are published AND have at least one countable lesson.
    const publishedModules = new Set(modules.map((m) => String(m._id)));

    const now = new Date();
    const currentWeek = this.lagosWeekIndex(now);
    const weekStart = this.currentWeekStart(now);
    const w = {
      perLesson: weights.perLesson,
      perModule: weights.perModule,
      quizMax: weights.quizMax,
      summaryMax: weights.summaryMax,
      streakBonusPerWeek: weights.streakBonusPerWeek,
    };

    // Per-learner accumulators.
    type Acc = {
      lessons: number;
      modules: number;
      quizzes: number;
      summaries: number;
      wLessons: number;
      wModules: number;
      wQuizzes: number;
      wSummaries: number;
      completedInModule: Record<string, number>;
      moduleDoneAt: Record<string, number>; // module -> max completedAt ms
      activeWeeks: Set<number>;
      lastActivity: number;
    };
    const acc: Record<string, Acc> = {};
    const ensure = (k: string): Acc =>
      (acc[k] ||= {
        lessons: 0,
        modules: 0,
        quizzes: 0,
        summaries: 0,
        wLessons: 0,
        wModules: 0,
        wQuizzes: 0,
        wSummaries: 0,
        completedInModule: {},
        moduleDoneAt: {},
        activeWeeks: new Set<number>(),
        lastActivity: 0,
      });
    const touch = (a: Acc, ts?: Date) => {
      if (!ts) return;
      const ms = new Date(ts).getTime();
      a.activeWeeks.add(this.lagosWeekIndex(new Date(ms)));
      if (ms > a.lastActivity) a.lastActivity = ms;
    };
    const inThisWeek = (ts?: Date) =>
      !!ts && this.lagosWeekIndex(new Date(ts)) === currentWeek;

    // Lessons.
    for (const p of progresses) {
      const lid = String(p.lesson);
      if (!countableLesson.has(lid)) continue;
      const a = ensure(String(p.registration));
      a.lessons += w.perLesson;
      touch(a, p.completedAt);
      if (inThisWeek(p.completedAt)) a.wLessons += w.perLesson;
      const mod = lessonToModule[lid];
      if (mod) {
        a.completedInModule[mod] = (a.completedInModule[mod] || 0) + 1;
        const ms = p.completedAt ? new Date(p.completedAt).getTime() : 0;
        if (ms > (a.moduleDoneAt[mod] || 0)) a.moduleDoneAt[mod] = ms;
      }
    }
    // Module-completion bonuses (all countable lessons in a published module).
    for (const k of Object.keys(acc)) {
      const a = acc[k];
      for (const mod of Object.keys(a.completedInModule)) {
        if (!publishedModules.has(mod)) continue;
        const need = moduleLessonCount[mod] || 0;
        if (need > 0 && a.completedInModule[mod] >= need) {
          a.modules += w.perModule;
          const doneMs = a.moduleDoneAt[mod] || 0;
          if (doneMs && this.lagosWeekIndex(new Date(doneMs)) === currentWeek)
            a.wModules += w.perModule;
        }
      }
    }
    // Quizzes (scaled by percent score).
    for (const q of attempts) {
      const a = ensure(String(q.registration));
      const pts = Math.round((w.quizMax * (q.score || 0)) / 100);
      a.quizzes += pts;
      touch(a, (q as any).updatedAt);
      if (inThisWeek((q as any).updatedAt)) a.wQuizzes += pts;
    }
    // Sermon summaries (scaled by grade).
    for (const s of summaries) {
      const a = ensure(String(s.registration));
      const pts = Math.round((w.summaryMax * (s.grade || 0)) / 100);
      a.summaries += pts;
      touch(a, s.gradedAt);
      if (inThisWeek(s.gradedAt)) a.wSummaries += pts;
    }

    // Consecutive-week streak ending at the current or immediately prior week
    // (so a learner mid-week who hasn't acted yet keeps last week's streak).
    const streakWeeks = (a: Acc): number => {
      if (!a.activeWeeks.size) return 0;
      let anchor = a.activeWeeks.has(currentWeek)
        ? currentWeek
        : a.activeWeeks.has(currentWeek - 1)
          ? currentWeek - 1
          : -1;
      if (anchor < 0) return 0;
      let n = 0;
      while (a.activeWeeks.has(anchor)) {
        n += 1;
        anchor -= 1;
      }
      return n;
    };

    // Build rows keyed by registration, with denormalised name/studentId.
    const regInfo: Record<string, { name: string; studentId?: string }> = {};
    for (const r of regs) {
      const email = (r.attendeeInfo?.email || '').trim().toLowerCase();
      if (excluded.has(email) || this.isTestLearnerEmail(email)) continue;
      regInfo[String(r._id)] = {
        name: `${r.attendeeInfo?.firstName || ''} ${r.attendeeInfo?.lastName || ''}`.trim(),
        studentId: (r as any).studentId,
      };
    }

    const buildRows = (scope: 'overall' | 'weekly') => {
      const rows = Object.keys(regInfo)
        .map((k) => {
          const a = acc[k];
          const info = regInfo[k];
          if (!a) return null;
          const streak = streakWeeks(a);
          const streakPts =
            scope === 'overall' ? streak * w.streakBonusPerWeek : 0;
          const breakdown =
            scope === 'overall'
              ? {
                  lessons: a.lessons,
                  modules: a.modules,
                  quizzes: a.quizzes,
                  summaries: a.summaries,
                  streak: streakPts,
                }
              : {
                  lessons: a.wLessons,
                  modules: a.wModules,
                  quizzes: a.wQuizzes,
                  summaries: a.wSummaries,
                  streak: 0,
                };
          const points =
            breakdown.lessons +
            breakdown.modules +
            breakdown.quizzes +
            breakdown.summaries +
            breakdown.streak;
          return {
            registration: new Types.ObjectId(k),
            name: info.name,
            studentId: info.studentId,
            points,
            breakdown,
            streakWeeks: streak,
            lastActivityAt: a.lastActivity ? new Date(a.lastActivity) : undefined,
          };
        })
        .filter((r): r is NonNullable<typeof r> => !!r && r.points > 0);

      // Rank: points desc, tie-break earliest-to-reach (earlier last activity).
      rows.sort(
        (x, y) =>
          y.points - x.points ||
          (x.lastActivityAt?.getTime() || Infinity) -
            (y.lastActivityAt?.getTime() || Infinity),
      );
      return rows.map((r, i) => ({
        ...r,
        event: eventOid,
        scope,
        weekStart: scope === 'weekly' ? weekStart : undefined,
        rank: i + 1,
        computedAt: now,
      }));
    };

    const overallRows = buildRows('overall');
    const weeklyRows = buildRows('weekly');

    // Replace the event's snapshot atomically-enough (wipe + reinsert).
    await this.leaderboardModel.deleteMany({ event: eventOid });
    if (overallRows.length)
      await this.leaderboardModel.insertMany(overallRows, { ordered: false });
    if (weeklyRows.length)
      await this.leaderboardModel.insertMany(weeklyRows, { ordered: false });

    return {
      event: eventId,
      overall: overallRows.length,
      weekly: weeklyRows.length,
      weekStart,
      computedAt: now,
    };
  }

  /** Recompute every event that has a published module. Cron + admin trigger. */
  async recomputeAllLeaderboards() {
    const eventIds = await this.moduleModel.distinct('event', {
      status: 'published',
    });
    for (const id of eventIds) {
      try {
        await this.recomputeLeaderboard(String(id));
      } catch (err) {
        this.logger.error(
          `Leaderboard recompute failed for event ${String(id)}: ${(err as Error).message}`,
        );
      }
    }
    return { events: eventIds.length };
  }

  // Refresh snapshots a few times a day; the weekly board naturally rolls to
  // the new Sun–Sat window on the first run after the boundary.
  @Cron('0 20 */4 * * *', { timeZone: 'Africa/Lagos' })
  async leaderboardCron() {
    await this.recomputeAllLeaderboards();
  }

  private shapeEntry(e: any) {
    return {
      rank: e.rank,
      name: e.name,
      studentId: e.studentId,
      points: e.points,
      breakdown: e.breakdown,
      streakWeeks: e.streakWeeks,
    };
  }

  /**
   * Student-facing board: top 100 for the scope (paginated 25/page) plus the
   * caller's own rank + breakdown, even when they're outside the top 100.
   */
  async getLeaderboardForLearner(
    account: PortalAccountDocument,
    eventSlug?: string,
    scope: 'overall' | 'weekly' = 'overall',
    page = 1,
  ) {
    const { event, registration } = await this.resolveLearner(
      account,
      eventSlug,
    );
    if (!this.canViewLeaderboard(account.email)) {
      throw new ForbiddenException(
        'The leaderboard is not available for your account yet.',
      );
    }
    const safeScope = scope === 'weekly' ? 'weekly' : 'overall';

    // Cold start: populate on first ever view for this event.
    const any = await this.leaderboardModel.exists({ event: event._id });
    if (!any) await this.recomputeLeaderboard(String(event._id));

    const PAGE_SIZE = 25;
    const PUBLIC_CAP = 100;
    const safePage = Math.max(1, Math.min(4, Number(page) || 1));
    const skip = (safePage - 1) * PAGE_SIZE;
    const remainingCap = Math.max(0, PUBLIC_CAP - skip);
    const take = Math.min(PAGE_SIZE, remainingCap);

    const [rankedTotal, entries, mine] = await Promise.all([
      this.leaderboardModel.countDocuments({
        event: event._id,
        scope: safeScope,
      }),
      take > 0
        ? this.leaderboardModel
            .find({ event: event._id, scope: safeScope })
            .sort({ rank: 1 })
            .skip(skip)
            .limit(take)
            .lean()
        : Promise.resolve([]),
      this.leaderboardModel
        .findOne({
          event: event._id,
          scope: safeScope,
          registration: registration._id,
        })
        .lean(),
    ]);

    const shownTotal = Math.min(rankedTotal, PUBLIC_CAP);
    return {
      scope: safeScope,
      page: safePage,
      pageSize: PAGE_SIZE,
      total: shownTotal,
      totalRanked: rankedTotal,
      totalPages: Math.max(1, Math.ceil(shownTotal / PAGE_SIZE)),
      weekStart: safeScope === 'weekly' ? this.currentWeekStart() : undefined,
      entries: entries.map((e) => ({
        ...this.shapeEntry(e),
        isMe: mine ? String(e.registration) === String(registration._id) : false,
      })),
      me: mine
        ? { ...this.shapeEntry(mine), inTop100: mine.rank <= PUBLIC_CAP }
        : {
            rank: null,
            points: 0,
            breakdown: { lessons: 0, modules: 0, quizzes: 0, summaries: 0, streak: 0 },
            streakWeeks: 0,
            inTop100: false,
          },
    };
  }

  /** Facilitator board: the FULL ranked list, paginated, no top-100 cap. */
  async getLeaderboardForFacilitator(
    eventId: string,
    opts: { scope?: 'overall' | 'weekly'; page?: number; limit?: number } = {},
  ) {
    await this.assertEvent(eventId);
    const eventOid = new Types.ObjectId(eventId);
    const scope = opts.scope === 'weekly' ? 'weekly' : 'overall';
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(opts.limit) || 25));

    const any = await this.leaderboardModel.exists({ event: eventOid });
    if (!any) await this.recomputeLeaderboard(eventId);

    const [total, entries, sample] = await Promise.all([
      this.leaderboardModel.countDocuments({ event: eventOid, scope }),
      this.leaderboardModel
        .find({ event: eventOid, scope })
        .sort({ rank: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.leaderboardModel
        .findOne({ event: eventOid, scope })
        .select('computedAt')
        .lean(),
    ]);

    return {
      scope,
      page,
      pageSize: limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      computedAt: sample?.computedAt || null,
      entries: entries.map((e) => this.shapeEntry(e)),
    };
  }

  async getLeaderboardWeights(eventId: string) {
    await this.assertEvent(eventId);
    const w = await this.getOrCreateWeights(new Types.ObjectId(eventId));
    return {
      perLesson: w.perLesson,
      perModule: w.perModule,
      quizMax: w.quizMax,
      summaryMax: w.summaryMax,
      streakBonusPerWeek: w.streakBonusPerWeek,
      excludedEmails: w.excludedEmails || [],
    };
  }

  async updateLeaderboardWeights(
    eventId: string,
    dto: {
      perLesson?: number;
      perModule?: number;
      quizMax?: number;
      summaryMax?: number;
      streakBonusPerWeek?: number;
      excludedEmails?: string[];
    },
  ) {
    await this.assertEvent(eventId);
    const eventOid = new Types.ObjectId(eventId);
    const w = await this.getOrCreateWeights(eventOid);
    const num = (v: any, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    };
    if (dto.perLesson !== undefined) w.perLesson = num(dto.perLesson, w.perLesson);
    if (dto.perModule !== undefined) w.perModule = num(dto.perModule, w.perModule);
    if (dto.quizMax !== undefined) w.quizMax = num(dto.quizMax, w.quizMax);
    if (dto.summaryMax !== undefined)
      w.summaryMax = num(dto.summaryMax, w.summaryMax);
    if (dto.streakBonusPerWeek !== undefined)
      w.streakBonusPerWeek = num(dto.streakBonusPerWeek, w.streakBonusPerWeek);
    if (Array.isArray(dto.excludedEmails))
      w.excludedEmails = dto.excludedEmails
        .map((e) => String(e).trim().toLowerCase())
        .filter(Boolean);
    await w.save();
    // Reflect new weights immediately.
    await this.recomputeLeaderboard(eventId);
    return this.getLeaderboardWeights(eventId);
  }
}
