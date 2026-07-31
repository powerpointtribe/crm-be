import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event } from '../schemas/event.schema';

@Injectable()
export class Juba2026EventSeeder {
  private readonly logger = new Logger(Juba2026EventSeeder.name);

  constructor(
    @InjectModel(Event.name) private eventModel: Model<Event>,
  ) {}

  async seed() {
    this.logger.log('Starting JÚBÀ 2026 event seeding...');

    const existingEvent = await this.eventModel.findOne({
      registrationSlug: 'juba-2026',
    });

    if (existingEvent) {
      this.logger.warn('JÚBÀ 2026 event already exists. Skipping...');
      return existingEvent;
    }

    const jubaEvent = {
      title: 'JÚBÀ — A Worship Experience',
      registrationSlug: 'juba-2026',
      description:
        'JÚBÀ is a worship experience curated by PowerPoint Tribe — an evening set apart to honour God through music, praise, and unified worship. The name "Júbà" is a Yoruba expression meaning "to pay homage" or "to bow in reverence."',

      isGlobal: true,
      type: 'celebration',
      tags: ['worship', 'juba', 'music', 'praise', 'free-entry'],

      startDate: new Date('2026-06-27T17:00:00+01:00'),
      endDate: new Date('2026-06-27T22:00:00+01:00'),
      startTime: '17:00',
      endTime: '22:00',

      location: {
        name: 'The Garrison',
        address: '300 Ikorodu-Ososun Rd, Anthony, Lagos, Nigeria',
        city: 'Lagos',
        state: 'Lagos',
        isVirtual: false,
      },

      status: 'published',

      checkInCodePrefix: 'JUBA',

      contactEmail: 'info@powerpointtribe.org',
      websiteUrl: 'https://juba.powerpointtribe.org',

      registrationSettings: {
        isOpen: true,
        maxAttendees: 1000,
        deadline: new Date('2026-06-27T15:00:00+01:00'),
        requireApproval: false,
        allowWaitlist: true,
        qrCodeEnabled: true,
        formLayout: 'single-page',
        formStatus: 'live',
        integrationMode: 'embedded',

        formHeader: {
          title: 'Register for JÚBÀ',
          description: 'Secure your spot at JÚBÀ — Saturday, 27th June 2026',
        },

        successMessage: {
          title: "You're Registered for JÚBÀ!",
          message:
            'Check your email for confirmation details. See you June 27th!',
          showCheckInQR: true,
        },

        customFields: [
          {
            id: 'isMember',
            label: 'Are you a member of PowerPoint Tribe?',
            type: 'select',
            required: false,
            order: 1,
            options: ['Yes', 'No'],
            placeholder: 'Select',
            helpText: '',
          },
          {
            id: 'howDidYouHear',
            label: 'How did you hear about JÚBÀ?',
            type: 'select',
            required: false,
            order: 2,
            options: [
              'Instagram',
              'Twitter / X',
              'Friend',
              'Church announcement',
              'Other',
            ],
            placeholder: 'Select',
            helpText: '',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'isMember',
                  operator: 'equals',
                  value: 'No',
                },
              ],
            },
          },
        ],
      },
    };

    try {
      const createdEvent = await this.eventModel.create(jubaEvent);
      const eventObj = createdEvent.toObject();

      this.logger.log(
        `✅ JÚBÀ 2026 event created successfully with ID: ${createdEvent._id}`,
      );
      this.logger.log(`   Slug: ${eventObj.registrationSlug}`);
      this.logger.log(`   Title: ${eventObj.title}`);
      this.logger.log(`   Date: ${eventObj.startDate}`);
      this.logger.log(
        `   Capacity: ${eventObj.registrationSettings?.maxAttendees || 0}`,
      );
      this.logger.log(
        `   Custom Fields: ${eventObj.registrationSettings?.customFields?.length || 0}`,
      );

      return createdEvent;
    } catch (error) {
      this.logger.error('Failed to create JÚBÀ 2026 event:', error);
      throw error;
    }
  }

  async remove() {
    this.logger.log('Removing JÚBÀ 2026 event...');

    const result = await this.eventModel.deleteOne({
      registrationSlug: 'juba-2026',
    });

    if (result.deletedCount > 0) {
      this.logger.log('✅ JÚBÀ 2026 event removed successfully');
    } else {
      this.logger.warn('JÚBÀ 2026 event not found');
    }

    return result;
  }
}
