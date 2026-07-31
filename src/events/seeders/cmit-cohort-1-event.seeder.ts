import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event } from '../schemas/event.schema';

/**
 * Seeder for the first CMIT (Campus Ministers in Training) cohort.
 * Mirrors the LBS 2026 seeder pattern:
 *   - Single global event (isGlobal: true)
 *   - Public registration via slug
 *   - Dynamic customFields define the registration form
 *
 * Run with:  npm run seed:cmit-cohort-1
 * Remove with: npm run seed:cmit-cohort-1:remove
 */
@Injectable()
export class CmitCohort1EventSeeder {
  private readonly logger = new Logger(CmitCohort1EventSeeder.name);
  private readonly slug = 'cmit-cohort-1';

  constructor(
    @InjectModel(Event.name) private eventModel: Model<Event>,
  ) {}

  async seed() {
    this.logger.log('Starting CMIT Cohort 1 event seeding...');

    const existingEvent = await this.eventModel.findOne({
      registrationSlug: this.slug,
    });

    if (existingEvent) {
      this.logger.warn('CMIT Cohort 1 event already exists. Skipping...');
      return existingEvent;
    }

    const cmitEvent = {
      // Basic Information
      title: 'CMIT — Campus Ministers in Training (Cohort 01)',
      registrationSlug: this.slug,
      description:
        'A national, interdenominational online discipleship and leadership program raising spiritually grounded, ministry-competent campus leaders. Five weekly Saturday sessions, beginning 1 August 2026.',

      // Global Event (available to all branches)
      isGlobal: true,

      // Event Type
      type: 'training',
      tags: [
        'cmit',
        'campus-ministry',
        'discipleship',
        'leadership',
        'training',
        'cohort-1',
      ],

      // Date & Time — cohort start session (1 Aug 2026, Saturday 10:00 WAT).
      // Subsequent weekly sessions are managed via the training-session config below.
      startDate: new Date('2026-08-01T10:00:00.000Z'),
      endDate: new Date('2026-08-29T13:00:00.000Z'),
      startTime: '10:00',
      endTime: '13:00',

      // Location — fully online
      location: {
        name: 'Online (Zoom — link shared on confirmation)',
        address: 'Online',
        city: '',
        state: '',
        isVirtual: true,
        virtualLink: '',
      },

      // Status
      status: 'published',

      // Check-in code prefix — CMIT registrations get codes like CMIT-001
      // (defaults to 'LBS' on the schema if unset).
      checkInCodePrefix: 'CMIT',

      // Additional Details
      contactEmail: 'info@cmithub.org',
      contactPhone: '',
      websiteUrl: 'https://cmithub.org',

      // Training-specific configuration (mirrors fields the events module supports)
      hasMultipleSessions: true,
      totalSessions: 5,
      requireAllSessions: false,
      minimumAttendancePercentage: 80,
      hasCertification: true,
      passingScore: 70,
      allowRetakes: false,

      // Registration Settings
      registrationSettings: {
        isOpen: true,
        maxAttendees: 1000,
        deadline: new Date('2026-07-29T23:59:59.000Z'),
        requireApproval: false,
        allowWaitlist: true,
        qrCodeEnabled: true,
        formLayout: 'single-page',

        // CMIT sends from its own domain, not the platform default.
        // The cmithub.org domain must be a verified sender on the email provider.
        senderEmail: 'info@cmithub.org',
        senderName: 'CMIT — Campus Ministers in Training',

        // Base URL where the per-registrant application one-pager is hosted.
        // The welcome email builds each applicant's link as
        // `${applicationBaseUrl}/apply/${token}`. For local testing, point this
        // at the cmit dev server (e.g. http://localhost:5173).
        applicationBaseUrl: 'https://cmithub.org',

        formHeader:
          'Register for CMIT — Cohort 01. A few quick questions; takes about 3 minutes.',
        successMessage:
          "You're registered! We'll reach out by email with everything you need to get started.",

        // Custom Form Fields. firstName/lastName/email/phone/gender are top-level
        // fields on the public registration DTO and are not duplicated here.
        customFields: [
          {
            id: 'university',
            label: 'University / Institution',
            type: 'text',
            required: true,
            order: 1,
            placeholder: 'e.g. University of Lagos',
            helpText: 'Where are you currently studying?',
          },
          {
            id: 'level',
            label: 'Level / Year of study',
            type: 'select',
            required: true,
            order: 2,
            options: [
              '100 Level',
              '200 Level',
              '300 Level',
              '400 Level',
              '500 Level',
              '600 Level',
              'Postgraduate',
              'Recent graduate',
            ],
            placeholder: 'Select your level',
            helpText: 'Pick the option that best matches where you are now.',
          },
          {
            id: 'role',
            label: 'Role in your fellowship',
            type: 'select',
            required: true,
            order: 3,
            options: [
              'Member',
              'Workforce / Team member',
              'Exco',
              'Leader / President',
              'Not currently in a fellowship',
            ],
            placeholder: 'Select your role',
            helpText: 'Pick the option that best describes you.',
          },
          {
            id: 'fellowship',
            label: 'Current fellowship or ministry',
            type: 'text',
            required: false,
            order: 4,
            placeholder: 'e.g. NIFES, FCS, Chapel of choice…',
            helpText: 'Optional — leave blank if you’re not part of one yet.',
          },
          {
            id: 'motivation',
            label: 'Why do you want to join CMIT?',
            type: 'textarea',
            required: true,
            order: 5,
            placeholder: 'A few sentences is plenty.',
            helpText: 'Share what draws you to campus ministry training.',
            validation: {
              minLength: 20,
              maxLength: 800,
            },
          },
          {
            id: 'heardAbout',
            label: 'How did you hear about CMIT?',
            type: 'select',
            required: true,
            order: 6,
            options: [
              'A friend / classmate',
              'My fellowship leader',
              'Dami Oguntunde Teaching Ministries',
              'Instagram',
              'WhatsApp',
              'X (Twitter)',
              'Other',
            ],
            placeholder: 'Select one',
            helpText: '',
          },
        ],
      },
    };

    try {
      const createdEvent = await this.eventModel.create(cmitEvent);
      const eventObj = createdEvent.toObject();

      this.logger.log(
        `✅ CMIT Cohort 1 event created successfully with ID: ${createdEvent._id}`,
      );
      this.logger.log(`   Slug: ${eventObj.registrationSlug}`);
      this.logger.log(`   Title: ${eventObj.title}`);
      this.logger.log(`   Start: ${eventObj.startDate}`);
      this.logger.log(
        `   Capacity: ${eventObj.registrationSettings?.maxAttendees || 0}`,
      );
      this.logger.log(
        `   Custom Fields: ${eventObj.registrationSettings?.customFields?.length || 0}`,
      );
      this.logger.log(`   Global Event: ${eventObj.isGlobal}`);
      this.logger.log(
        `   Public URL: GET /api/v1/events/public/${eventObj.registrationSlug}`,
      );

      return createdEvent;
    } catch (error) {
      this.logger.error('Failed to create CMIT Cohort 1 event:', error);
      throw error;
    }
  }

  async remove() {
    this.logger.log('Removing CMIT Cohort 1 event...');

    const result = await this.eventModel.deleteOne({
      registrationSlug: this.slug,
    });

    if (result.deletedCount > 0) {
      this.logger.log('✅ CMIT Cohort 1 event removed successfully');
    } else {
      this.logger.warn('CMIT Cohort 1 event not found');
    }

    return result;
  }
}
