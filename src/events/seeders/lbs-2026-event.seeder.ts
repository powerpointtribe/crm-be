import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event } from '../schemas/event.schema';

@Injectable()
export class LBS2026EventSeeder {
  private readonly logger = new Logger(LBS2026EventSeeder.name);

  constructor(
    @InjectModel(Event.name) private eventModel: Model<Event>,
  ) {}

  async seed() {
    this.logger.log('Starting LBS 2026 event seeding...');

    // Check if event already exists
    const existingEvent = await this.eventModel.findOne({
      registrationSlug: 'lbs-2026',
    });

    if (existingEvent) {
      this.logger.warn('LBS 2026 event already exists. Skipping...');
      return existingEvent;
    }

    const lbsEvent = {
      // Basic Information
      title: 'Leadership & Business Summit 2026',
      registrationSlug: 'lbs-2026',
      description: 'Join the most impactful leadership and business summit of 2026! Equip yourself with cutting-edge strategies, network with 500+ professionals, and choose between Professional or Entrepreneur track.',

      // Global Event (Available to all branches)
      isGlobal: true,

      // Event Type
      type: 'conference',
      tags: ['leadership', 'business', 'summit', 'networking', 'professional-development', 'entrepreneurship'],

      // Date & Time
      startDate: new Date('2026-05-01T11:00:00'),
      endDate: new Date('2026-05-01T15:00:00'),
      startTime: '11:00',
      endTime: '15:00',

      // Location
      location: {
        name: '300, Ikorodu Road, Anthony Bus Stop',
        address: '300, Ikorodu Road, Anthony Bus Stop, Lagos',
        city: 'Lagos',
        state: 'Lagos',
        isVirtual: false,
      },

      // Status
      status: 'published',

      // Additional Details
      bannerImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop',
      contactEmail: 'lbs@powerpointtribe.org',
      contactPhone: '+234-XXX-XXXX-XXX',
      websiteUrl: 'https://lbs.powerpointtribe.org',

      // Registration Settings
      registrationSettings: {
        isOpen: true,
        maxAttendees: 500,
        deadline: new Date('2026-04-28T23:59:59'),
        requireApproval: false,
        allowWaitlist: true,
        qrCodeEnabled: true,

        // Custom Form Fields
        customFields: [
          // 1. Track Selection (Required for all)
          {
            id: 'track',
            label: 'Select Your Track',
            type: 'radio',
            required: true,
            order: 1,
            options: ['Professional Track', 'Entrepreneur Track'],
            placeholder: '',
            helpText: 'Choose the track that best fits your current journey. Professional Track is for career-focused individuals, while Entrepreneur Track is for business owners and startup founders.',
          },

          // PROFESSIONAL TRACK FIELDS (2-7)

          // 2. Job Title (Professional only)
          {
            id: 'jobTitle',
            label: 'Job Title',
            type: 'text',
            required: true,
            order: 2,
            placeholder: 'e.g., Senior Marketing Manager',
            helpText: 'Your current job title or position',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Professional Track',
                },
              ],
            },
          },

          // 3. Company Name (Professional only)
          {
            id: 'companyName',
            label: 'Company Name',
            type: 'text',
            required: true,
            order: 3,
            placeholder: 'e.g., Acme Corporation',
            helpText: 'Name of the organization you work for',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Professional Track',
                },
              ],
            },
          },

          // 4. Career Level (Professional only)
          {
            id: 'careerLevel',
            label: 'Career Level',
            type: 'select',
            required: true,
            order: 4,
            options: [
              'Entry Level (0-2 years)',
              'Mid Level (3-5 years)',
              'Senior Level (6-10 years)',
              'Executive/Leadership (10+ years)',
            ],
            placeholder: 'Select your career level',
            helpText: 'Choose the option that best describes your current career stage',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Professional Track',
                },
              ],
            },
          },

          // 5. Social Media Platform (Professional only)
          {
            id: 'socialPlatformPro',
            label: 'Primary Social Media Platform',
            type: 'select',
            required: false,
            order: 5,
            options: ['LinkedIn', 'Twitter/X', 'Instagram', 'Facebook', 'Other'],
            placeholder: 'Select platform',
            helpText: 'Where can we connect with you professionally?',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Professional Track',
                },
              ],
            },
          },

          // 6. Social Media Handle (Professional only)
          {
            id: 'socialHandlePro',
            label: 'Social Media Handle',
            type: 'text',
            required: false,
            order: 6,
            placeholder: '@yourhandle',
            helpText: 'Your handle on the selected platform (optional)',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Professional Track',
                },
              ],
            },
          },

          // 7. What do you hope to gain? (Professional only)
          {
            id: 'expectationPro',
            label: 'What do you hope to gain from LBS 2026?',
            type: 'textarea',
            required: true,
            order: 7,
            placeholder: 'Share your expectations and goals for attending this summit...',
            helpText: 'Tell us what you\'re looking forward to learning or achieving',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Professional Track',
                },
              ],
            },
          },

          // ENTREPRENEUR TRACK FIELDS (8-14)

          // 8. Business Name (Entrepreneur only)
          {
            id: 'businessName',
            label: 'Business Name',
            type: 'text',
            required: true,
            order: 8,
            placeholder: 'e.g., Tech Innovations Ltd',
            helpText: 'Name of your business or startup',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Entrepreneur Track',
                },
              ],
            },
          },

          // 9. Your Title in Business (Entrepreneur only)
          {
            id: 'businessTitle',
            label: 'Your Title/Role in the Business',
            type: 'text',
            required: true,
            order: 9,
            placeholder: 'e.g., Founder & CEO',
            helpText: 'Your role or position in the business',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Entrepreneur Track',
                },
              ],
            },
          },

          // 10. CAC Registered (Entrepreneur only)
          {
            id: 'cacRegistered',
            label: 'Is your business CAC registered?',
            type: 'radio',
            required: true,
            order: 10,
            options: ['Yes', 'No', 'In Progress'],
            placeholder: '',
            helpText: 'Corporate Affairs Commission registration status',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Entrepreneur Track',
                },
              ],
            },
          },

          // 11. Business Website (Entrepreneur only)
          {
            id: 'businessWebsite',
            label: 'Business Website/Online Presence',
            type: 'text',
            required: false,
            order: 11,
            placeholder: 'https://www.yourbusiness.com',
            helpText: 'Your business website or online portfolio (optional)',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Entrepreneur Track',
                },
              ],
            },
          },

          // 12. Social Media Platform (Entrepreneur only)
          {
            id: 'socialPlatformEnt',
            label: 'Primary Social Media Platform',
            type: 'select',
            required: false,
            order: 12,
            options: ['LinkedIn', 'Twitter/X', 'Instagram', 'Facebook', 'Other'],
            placeholder: 'Select platform',
            helpText: 'Where is your business most active?',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Entrepreneur Track',
                },
              ],
            },
          },

          // 13. Social Media Handle (Entrepreneur only)
          {
            id: 'socialHandleEnt',
            label: 'Social Media Handle',
            type: 'text',
            required: false,
            order: 13,
            placeholder: '@yourbusiness',
            helpText: 'Your business handle on the selected platform (optional)',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Entrepreneur Track',
                },
              ],
            },
          },

          // 14. What do you hope to gain? (Entrepreneur only)
          {
            id: 'expectationEnt',
            label: 'What do you hope to gain from LBS 2026?',
            type: 'textarea',
            required: true,
            order: 14,
            placeholder: 'Share your expectations and goals for attending this summit...',
            helpText: 'Tell us what you\'re looking forward to learning or achieving',
            conditionalLogic: {
              enabled: true,
              action: 'show',
              logicType: 'all',
              rules: [
                {
                  fieldId: 'track',
                  operator: 'equals',
                  value: 'Entrepreneur Track',
                },
              ],
            },
          },

          // 15. Dietary Restrictions (All tracks)
          {
            id: 'dietaryRestrictions',
            label: 'Dietary Restrictions',
            type: 'text',
            required: false,
            order: 15,
            placeholder: 'e.g., Vegetarian, Halal, None',
            helpText: 'Let us know if you have any dietary restrictions for catering purposes (optional)',
          },
        ],
      },
    };

    try {
      const createdEvent = await this.eventModel.create(lbsEvent);
      const eventObj = createdEvent.toObject();

      this.logger.log(`✅ LBS 2026 event created successfully with ID: ${createdEvent._id}`);
      this.logger.log(`   Slug: ${eventObj.registrationSlug}`);
      this.logger.log(`   Title: ${eventObj.title}`);
      this.logger.log(`   Date: ${eventObj.startDate}`);
      this.logger.log(`   Capacity: ${eventObj.registrationSettings?.maxAttendees || 0}`);
      this.logger.log(`   Custom Fields: ${eventObj.registrationSettings?.customFields?.length || 0}`);
      this.logger.log(`   Global Event: ${eventObj.isGlobal}`);

      return createdEvent;
    } catch (error) {
      this.logger.error('Failed to create LBS 2026 event:', error);
      throw error;
    }
  }

  async remove() {
    this.logger.log('Removing LBS 2026 event...');

    const result = await this.eventModel.deleteOne({ registrationSlug: 'lbs-2026' });

    if (result.deletedCount > 0) {
      this.logger.log('✅ LBS 2026 event removed successfully');
    } else {
      this.logger.warn('LBS 2026 event not found');
    }

    return result;
  }
}
