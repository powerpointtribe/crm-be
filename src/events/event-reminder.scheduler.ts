import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventsService } from './events.service';
import { QueueName, JobType } from '../common/interfaces/queue-job.interface';
import { RegistrationStatus } from './schemas/event-registration.schema';

@Injectable()
export class EventReminderScheduler {
  private readonly logger = new Logger(EventReminderScheduler.name);

  constructor(
    private eventsService: EventsService,
    @InjectQueue(QueueName.EMAIL_NOTIFICATIONS)
    private emailQueue: Queue,
  ) {
    this.logger.log('EventReminderScheduler initialized');
  }

  /**
   * Send event reminders daily at 9:00 AM
   * Checks for events happening in 7, 3, or 1 days
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendEventReminders() {
    this.logger.log('Starting event reminder check...');

    try {
      // Find events with start dates in 7, 3, or 1 days
      const upcomingEvents = await this.eventsService.findUpcomingEvents([7, 3, 1]);

      if (upcomingEvents.length === 0) {
        this.logger.log('No events requiring reminders today');
        return;
      }

      this.logger.log(
        `Found ${upcomingEvents.length} event(s) requiring reminders`,
      );

      let totalRemindersQueued = 0;

      for (const event of upcomingEvents) {
        // Calculate days until event
        const daysUntil = Math.ceil(
          (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        this.logger.log(
          `Processing reminders for event "${event.title}" (T-${daysUntil})`,
        );

        // Get confirmed registrations only
        const registrations = await this.eventsService.getConfirmedRegistrations(
          event._id,
        );

        if (registrations.length === 0) {
          this.logger.log(
            `No confirmed registrations for event "${event.title}"`,
          );
          continue;
        }

        // Queue reminder for each confirmed registrant
        for (const registration of registrations) {
          // Skip if no email
          if (!registration.attendeeInfo.email) {
            continue;
          }

          await this.emailQueue.add(JobType.EVENT_REMINDER, {
            registrationId: registration._id.toString(),
            email: registration.attendeeInfo.email,
            firstName: registration.attendeeInfo.firstName,
            lastName: registration.attendeeInfo.lastName,
            eventTitle: event.title,
            eventDate: event.startDate,
            eventLocation: event.location,
            checkInCode: registration.checkInCode,
            daysUntil,
            senderEmail: event.registrationSettings?.senderEmail,
            senderName: event.registrationSettings?.senderName,
          });

          totalRemindersQueued++;
        }

        this.logger.log(
          `Queued ${registrations.length} reminder(s) for event "${event.title}"`,
        );
      }

      this.logger.log(
        `Event reminder check completed. Total reminders queued: ${totalRemindersQueued}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process event reminders: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Calculate days between two dates
   */
  private calculateDaysUntil(targetDate: Date): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Manual trigger for testing (can be called via admin endpoint)
   */
  async triggerRemindersManually(eventId: string, daysUntil: number): Promise<number> {
    this.logger.log(
      `Manually triggering reminders for event ${eventId} (T-${daysUntil})`,
    );

    try {
      const event = await this.eventsService.findById(eventId);

      const registrations = await this.eventsService.getConfirmedRegistrations(
        event._id,
      );

      let queuedCount = 0;

      for (const registration of registrations) {
        if (!registration.attendeeInfo.email) {
          continue;
        }

        await this.emailQueue.add(JobType.EVENT_REMINDER, {
          registrationId: registration._id.toString(),
          email: registration.attendeeInfo.email,
          firstName: registration.attendeeInfo.firstName,
          lastName: registration.attendeeInfo.lastName,
          eventTitle: event.title,
          eventDate: event.startDate,
          eventLocation: event.location,
          checkInCode: registration.checkInCode,
          daysUntil,
          senderEmail: event.registrationSettings?.senderEmail,
          senderName: event.registrationSettings?.senderName,
        });

        queuedCount++;
      }

      this.logger.log(
        `Manually queued ${queuedCount} reminder(s) for event "${event.title}"`,
      );

      return queuedCount;
    } catch (error) {
      this.logger.error(
        `Failed to manually trigger reminders: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
