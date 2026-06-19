import {
  BadRequestException,
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
  EventSession,
  EventSessionDocument,
} from '../events/schemas/event-session.schema';
import {
  SessionAttendance,
  SessionAttendanceDocument,
} from '../events/schemas/session-attendance.schema';
import { PortalAccountDocument } from '../portal/schemas/portal-account.schema';
import { AiService } from '../ai/ai.service';
import { ZoomService } from '../zoom/zoom.service';
import {
  CreateAssignmentDto,
  CreateLessonDto,
  CreateModuleDto,
  UpdateAssignmentDto,
  UpdateLessonDto,
  UpdateModuleDto,
  UpsertQuizDto,
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
    @InjectModel(Quiz.name)
    private readonly quizModel: Model<QuizDocument>,
    @InjectModel(QuizAttempt.name)
    private readonly quizAttemptModel: Model<QuizAttemptDocument>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
    private readonly aiService: AiService,
    private readonly zoomService: ZoomService,
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
        correctIndex: type === 'checkboxes' ? 0 : q.correctIndex ?? 0,
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
          ? q.options?.[resp] ?? '—'
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
    const completedAt = times.length ? new Date(Math.max(...times)) : new Date();

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

  // ===================== FACILITATOR: Zoom auto-attendance =====================

  private parseZoomMeetingId(url?: string): string | null {
    if (!url) return null;
    // e.g. https://us02web.zoom.us/j/1234567890?pwd=...
    const m = url.match(/\/j\/(\d+)/);
    return m ? m[1] : null;
  }

  /**
   * Pull a session's Zoom meeting participants (report API) and mark attendance
   * for matched (by email) accepted registrants. present if >= 5 min, else late.
   */
  async syncZoomAttendance(eventId: string, sessionId: string) {
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      event: new Types.ObjectId(eventId),
    });
    if (!session) throw new NotFoundException('Session not found');

    const meetingId = this.parseZoomMeetingId(session.location?.virtualLink);
    if (!meetingId) {
      throw new BadRequestException(
        'This session has no standard Zoom meeting link (https://zoom.us/j/<id>). Set one, then sync.',
      );
    }

    const participants =
      await this.zoomService.getPastMeetingParticipants(meetingId);

    const regs = await this.registrationModel
      .find({ event: session.event, admissionStatus: 'accepted' })
      .select('attendeeInfo')
      .lean();
    const byEmail = new Map<string, Types.ObjectId>();
    for (const r of regs) {
      const e = (r.attendeeInfo?.email || '').toLowerCase();
      if (e) byEmail.set(e, r._id);
    }

    // Aggregate total duration + earliest join per participant email.
    const durBySec: Record<string, number> = {};
    const earliestJoin: Record<string, string> = {};
    for (const p of participants) {
      const e = (p.user_email || '').toLowerCase();
      if (!e) continue;
      durBySec[e] = (durBySec[e] || 0) + (p.duration || 0);
      if (p.join_time && (!earliestJoin[e] || p.join_time < earliestJoin[e])) {
        earliestJoin[e] = p.join_time;
      }
    }

    const PRESENT_THRESHOLD_SEC = 5 * 60;
    let marked = 0;
    const matched = new Set<string>();
    const unmatched: Array<{ email: string; minutes: number }> = [];

    for (const [email, sec] of Object.entries(durBySec)) {
      const regId = byEmail.get(email);
      if (!regId) {
        unmatched.push({ email, minutes: Math.round(sec / 60) });
        continue;
      }
      matched.add(email);
      const status = sec >= PRESENT_THRESHOLD_SEC ? 'present' : 'late';
      await this.attendanceModel.updateOne(
        { session: session._id, registration: regId },
        {
          $set: {
            event: session.event,
            status,
            checkInTime: earliestJoin[email]
              ? new Date(earliestJoin[email])
              : new Date(),
          },
          $setOnInsert: { session: session._id, registration: regId },
        },
        { upsert: true },
      );
      marked += 1;
    }

    return {
      meetingId,
      totalParticipants: participants.length,
      matched: matched.size,
      marked,
      unmatched,
    };
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
        avgProgress: acceptedCount ? Math.round(progressSum / acceptedCount) : 0,
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
        graded: submissions.filter((s) => s.grade !== null && s.grade !== undefined)
          .length,
      },
      reflections: reflectionsTotal,
      acceptedCount,
    };
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
