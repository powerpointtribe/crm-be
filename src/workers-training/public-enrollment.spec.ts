import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { autoMock } from '../test-utils/auto-mock-spec';
import { PUBLIC_ENROLLMENT_MAX_TRAINEES } from './dto/public-enrollment.dto';
import { WorkerTraineeController } from './worker-trainee.controller';
import { WorkerTraineeService } from './worker-trainee.service';

const COHORT = '64b0000000000000000000aa';
const person = {
  firstName: 'Ada',
  lastName: 'Obi',
  email: 'ada@example.com',
  phone: '+2348030000000',
};

describe('POST /workers-training/trainees/public-enrollment', () => {
  let app: INestApplication;
  const bulkEnrollFromForm = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkerTraineeController],
      providers: [
        { provide: WorkerTraineeService, useValue: { bulkEnrollFromForm } },
      ],
    })
      .useMocker(autoMock)
      .compile();
    app = moduleRef.createNestApplication();
    // Same pipe options as main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    bulkEnrollFromForm
      .mockReset()
      .mockResolvedValue({ successful: [], failed: [], total: 1 });
  });

  afterAll(() => app.close());

  const post = (body: unknown) =>
    request(app.getHttpServer())
      .post('/workers-training/trainees/public-enrollment')
      .send(body as object);

  it('still accepts a valid enrolment without a token', async () => {
    await post({ cohortId: COHORT, trainees: [person] }).expect(201);
    expect(bulkEnrollFromForm).toHaveBeenCalledWith({
      cohortId: COHORT,
      trainees: [person],
    });
  });

  it('keeps the optional fields it knows about', async () => {
    const full = {
      ...person,
      emergencyContact: 'Mum',
      emergencyPhone: '0803',
      medicalNotes: 'none',
      dietaryRestrictions: 'none',
      hasTransportation: true,
      needsAccommodation: false,
      accommodationDetails: '',
    };
    await post({ cohortId: COHORT, trainees: [full] }).expect(201);
    expect(bulkEnrollFromForm).toHaveBeenCalledWith({
      cohortId: COHORT,
      trainees: [full],
    });
  });

  it('strips fields that are not part of the form (e.g. status, member)', async () => {
    await post({
      cohortId: COHORT,
      status: 'completed',
      trainees: [
        { ...person, member: '64b0000000000000000000bb', role: 'admin' },
      ],
    }).expect(201);
    expect(bulkEnrollFromForm).toHaveBeenCalledWith({
      cohortId: COHORT,
      trainees: [person],
    });
  });

  it.each([
    ['no body', {}],
    [
      'a malformed cohortId (was a 500 CastError)',
      { cohortId: 'x', trainees: [person] },
    ],
    ['no trainees', { cohortId: COHORT, trainees: [] }],
    ['trainees not an array', { cohortId: COHORT, trainees: person }],
    [
      'a bad email',
      { cohortId: COHORT, trainees: [{ ...person, email: 'nope' }] },
    ],
    [
      'a missing phone',
      { cohortId: COHORT, trainees: [{ ...person, phone: undefined }] },
    ],
    [
      'an empty first name',
      { cohortId: COHORT, trainees: [{ ...person, firstName: '' }] },
    ],
    [
      'an over-long note',
      {
        cohortId: COHORT,
        trainees: [{ ...person, medicalNotes: 'x'.repeat(1001) }],
      },
    ],
  ])('400 for %s, without calling the service', async (_label, body) => {
    await post(body).expect(400);
    expect(bulkEnrollFromForm).not.toHaveBeenCalled();
  });

  it('never passes a query object through to the service (operator injection)', async () => {
    // main.ts uses enableImplicitConversion, so a value in a string field is
    // coerced to a string rather than rejected. Either way no object gets through.
    await post({
      cohortId: COHORT,
      trainees: [{ ...person, lastName: { $gt: '' } }],
    }).expect(201);
    const [arg] = bulkEnrollFromForm.mock.calls[0] as [
      { trainees: { lastName: unknown }[] },
    ];
    expect(typeof arg.trainees[0].lastName).toBe('string');
  });

  it(`400 for more than ${PUBLIC_ENROLLMENT_MAX_TRAINEES} trainees in one request`, async () => {
    const many = Array.from(
      { length: PUBLIC_ENROLLMENT_MAX_TRAINEES + 1 },
      () => person,
    );
    await post({ cohortId: COHORT, trainees: many }).expect(400);
    const max = Array.from(
      { length: PUBLIC_ENROLLMENT_MAX_TRAINEES },
      () => person,
    );
    await post({ cohortId: COHORT, trainees: max }).expect(201);
  });
});
