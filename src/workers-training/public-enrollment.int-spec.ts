import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import * as request from 'supertest';
import {
  CohortStatus,
  CohortType,
} from '../common/enums/workers-training.enum';
import { configureLikeMain } from '../test-utils/app-spec';
import { autoMock } from '../test-utils/auto-mock-spec';
import { openTestDb } from '../test-utils/mongo-spec';
import { CohortService } from './cohort.service';
import { Cohort, CohortSchema } from './schemas/cohort.schema';
import {
  WorkerTrainee,
  WorkerTraineeSchema,
} from './schemas/worker-trainee.schema';
import { WorkerTraineeController } from './worker-trainee.controller';
import { WorkerTraineeService } from './worker-trainee.service';

describe('Workers training public enrolment (integration)', () => {
  let db: Awaited<ReturnType<typeof openTestDb>>;
  let app: INestApplication;
  let cohorts: Model<any>;
  let trainees: Model<any>;

  const person = (n: number) => ({
    firstName: `Ada${n}`,
    lastName: 'Obi',
    email: `Ada${n}@Example.com`,
    phone: '+2348030000000',
    medicalNotes: 'asthma',
  });

  const newCohort = (extra: Record<string, unknown> = {}) =>
    cohorts.create({
      name: 'DC 2026',
      code: `DC-${new Types.ObjectId()}`,
      type: Object.values(CohortType)[0],
      status: CohortStatus.REGISTRATION_OPEN,
      startDate: new Date(Date.now() + 86_400_000),
      endDate: new Date(Date.now() + 30 * 86_400_000),
      createdBy: new Types.ObjectId(),
      ...extra,
    });

  const participants = async (id: unknown) =>
    ((await cohorts.findById(id).lean()) as any)?.currentParticipants;

  const enrol = (cohortId: unknown, list: unknown[]) =>
    request(app.getHttpServer())
      .post('/workers-training/trainees/public-enrollment')
      .send({ cohortId: String(cohortId), trainees: list });

  beforeAll(async () => {
    db = await openTestDb('workers_training');
    cohorts = db.connection.model(Cohort.name, CohortSchema);
    trainees = db.connection.model(WorkerTrainee.name, WorkerTraineeSchema);
    await db.ready();

    const moduleRef = await Test.createTestingModule({
      controllers: [WorkerTraineeController],
      providers: [
        WorkerTraineeService,
        CohortService,
        { provide: getModelToken(Cohort.name), useValue: cohorts },
        { provide: getModelToken(WorkerTrainee.name), useValue: trainees },
      ],
    })
      .useMocker(autoMock)
      .compile();
    app = configureLikeMain(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  it('saves every applicant with their contact details', async () => {
    const cohort = await newCohort();
    const res = await enrol(cohort._id, [person(1), person(2)]).expect(201);

    expect(res.body.failed).toEqual([]);
    expect(res.body.successful).toHaveLength(2);
    const saved = await trainees
      .find({ cohort: cohort._id })
      .sort({ 'applicant.firstName': 1 })
      .lean();
    expect(saved.map((t: any) => t.applicant)).toEqual([
      expect.objectContaining({
        firstName: 'Ada1',
        lastName: 'Obi',
        email: 'ada1@example.com',
        phone: '+2348030000000',
      }),
      expect.objectContaining({ firstName: 'Ada2', email: 'ada2@example.com' }),
    ]);
    expect(saved[0].medicalNotes).toBe('asthma');
    expect(saved[0].member).toBeUndefined();
    expect(await participants(cohort._id)).toBe(2);
  });

  it('does not echo sensitive fields back', async () => {
    const cohort = await newCohort();
    const res = await enrol(cohort._id, [person(1)]).expect(201);
    expect(res.body.successful[0]).toEqual({
      firstName: 'Ada1',
      lastName: 'Obi',
      email: 'ada1@example.com',
      traineeId: expect.any(String),
    });
  });

  it('reports a repeat email in the same cohort as failed, not a new record', async () => {
    const cohort = await newCohort();
    await enrol(cohort._id, [person(1)]).expect(201);
    const res = await enrol(cohort._id, [
      { ...person(1), email: 'ADA1@example.com' },
    ]).expect(201);

    expect(res.body.successful).toEqual([]);
    expect(res.body.failed).toEqual([
      expect.objectContaining({
        email: 'ada1@example.com',
        error: 'Already enrolled in this cohort',
      }),
    ]);
    expect(await trainees.countDocuments({ cohort: cohort._id })).toBe(1);
    expect(await participants(cohort._id)).toBe(1);
  });

  it('lets the same person enrol in a different cohort', async () => {
    const [a, b] = [await newCohort(), await newCohort()];
    await enrol(a._id, [person(1)]).expect(201);
    const res = await enrol(b._id, [person(1)]).expect(201);
    expect(res.body.successful).toHaveLength(1);
  });

  it('rejects a batch that would exceed capacity', async () => {
    const cohort = await newCohort({
      maxParticipants: 2,
      currentParticipants: 1,
    });
    await enrol(cohort._id, [person(1), person(2)]).expect(400);
    expect(await trainees.countDocuments({ cohort: cohort._id })).toBe(0);
  });

  it('rejects after the registration end date', async () => {
    const cohort = await newCohort({
      registrationEndDate: new Date(Date.now() - 1000),
    });
    await enrol(cohort._id, [person(1)]).expect(400);
  });

  it('rejects a cohort that is not open', async () => {
    const cohort = await newCohort({ status: CohortStatus.PLANNING });
    await enrol(cohort._id, [person(1)]).expect(400);
  });

  it('still requires member and enrolledBy on staff enrolments', async () => {
    const cohort = await newCohort();
    await expect(trainees.create({ cohort: cohort._id })).rejects.toThrow(
      /member.*required|enrolledBy.*required/,
    );
  });

  it('still blocks enrolling the same member twice', async () => {
    const cohort = await newCohort();
    const member = new Types.ObjectId();
    await trainees.create({ cohort: cohort._id, member, enrolledBy: member });
    await expect(
      trainees.create({ cohort: cohort._id, member, enrolledBy: member }),
    ).rejects.toThrow(/E11000/);
  });
});
