import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private resend: Resend;
  private emailProvider: 'resend' | 'sendgrid';

  constructor(private configService: ConfigService) {
    this.emailProvider = this.configService.get<string>('EMAIL_PROVIDER') as 'resend' | 'sendgrid' || 'resend';

    if (this.emailProvider === 'sendgrid') {
      this.initializeSendGrid();
    } else {
      this.initializeResend();
    }
  }

  private initializeResend() {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      this.logger.error('RESEND_API_KEY is not configured in environment variables');
      throw new Error('RESEND_API_KEY is required for email service');
    }

    this.logger.log('Initializing Resend email service...');
    this.resend = new Resend(apiKey);
    this.logger.log('Resend email service initialized successfully');
  }

  private initializeSendGrid() {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');

    if (!apiKey) {
      this.logger.error('SENDGRID_API_KEY is not configured in environment variables');
      throw new Error('SENDGRID_API_KEY is required for SendGrid service');
    }

    this.logger.log('Initializing SendGrid email service...');
    sgMail.setApiKey(apiKey);
    this.logger.log('SendGrid email service initialized successfully');
  }

  async sendEmail(options: {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
  }): Promise<any> {
    if (this.emailProvider === 'sendgrid') {
      return this.sendEmailWithSendGrid(options);
    } else {
      return this.sendEmailWithResend(options);
    }
  }

  private async sendEmailWithResend(options: {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
  }): Promise<any> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const fromEmail = options.from || 'Church Management System <onboarding@resend.dev>';

    this.logger.log(`[Resend] Attempting to send email to: ${recipients.join(', ')}`);
    this.logger.log(`Subject: ${options.subject}`);
    this.logger.log(`From: ${fromEmail}`);

    try {
      const emailData = {
        from: fromEmail,
        to: recipients,
        subject: options.subject,
        html: options.html,
      };

      this.logger.debug('Email payload:', JSON.stringify(emailData, null, 2));

      const result = await this.resend.emails.send(emailData);

      this.logger.log(`Email sent successfully! ID: ${result.data?.id || 'unknown'}`);
      this.logger.log(`Email result:`, JSON.stringify(result, null, 2));

      return result;
    } catch (error) {
      this.logger.error(`Email sending failed:`, error);
      this.logger.error(`Error details:`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data || error.response,
        status: error.response?.status,
      });

      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  private async sendEmailWithSendGrid(options: {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
  }): Promise<any> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const defaultSender = this.configService.get<string>('SENDER_EMAIL') || 'hello@comtrova.com';
    const fromEmail = options.from || `Church Management System <${defaultSender}>`;

    this.logger.log(`[SendGrid] Attempting to send email to: ${recipients.join(', ')}`);
    this.logger.log(`Subject: ${options.subject}`);
    this.logger.log(`From: ${fromEmail}`);

    try {
      const emailData = {
        to: recipients,
        from: fromEmail,
        subject: options.subject,
        html: options.html,
      };

      this.logger.debug('SendGrid email payload:', JSON.stringify(emailData, null, 2));

      const result = await sgMail.send(emailData);

      this.logger.log(`SendGrid email sent successfully!`);
      this.logger.log(`SendGrid result:`, JSON.stringify(result, null, 2));

      return result;
    } catch (error) {
      this.logger.error(`SendGrid email sending failed:`, error);
      this.logger.error(`SendGrid error details:`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.body || error.response,
        status: error.response?.status,
      });

      throw new Error(`SendGrid email sending failed: ${error.message}`);
    }
  }

  async sendBulkEmail(options: {
    recipients: Array<{ email: string; name?: string }>;
    subject: string;
    html: string;
    from?: string;
  }): Promise<any> {
    if (this.emailProvider === 'sendgrid') {
      return this.sendBulkEmailWithSendGrid(options);
    } else {
      return this.sendBulkEmailWithResend(options);
    }
  }

  private async sendBulkEmailWithResend(options: {
    recipients: Array<{ email: string; name?: string }>;
    subject: string;
    html: string;
    from?: string;
  }): Promise<any> {
    const emails = options.recipients.map((recipient) => ({
      from: options.from || 'Church Management System <onboarding@resend.dev>',
      to: [recipient.email],
      subject: options.subject,
      html: options.html.replace('{{name}}', recipient.name || 'Member'),
    }));

    try {
      const result = await this.resend.batch.send(emails);
      return result;
    } catch (error) {
      throw new Error(`Bulk email sending failed: ${error.message}`);
    }
  }

  private async sendBulkEmailWithSendGrid(options: {
    recipients: Array<{ email: string; name?: string }>;
    subject: string;
    html: string;
    from?: string;
  }): Promise<any> {
    const defaultSender = this.configService.get<string>('SENDER_EMAIL') || 'hello@comtrova.com';
    const fromEmail = options.from || `Church Management System <${defaultSender}>`;

    const emails = options.recipients.map((recipient) => ({
      to: recipient.email,
      from: fromEmail,
      subject: options.subject,
      html: options.html.replace('{{name}}', recipient.name || 'Member'),
    }));

    try {
      this.logger.log(`[SendGrid] Sending bulk email to ${emails.length} recipients`);
      const result = await sgMail.send(emails);
      this.logger.log(`SendGrid bulk email sent successfully to ${emails.length} recipients`);
      return result;
    } catch (error) {
      this.logger.error(`SendGrid bulk email sending failed:`, error);
      throw new Error(`SendGrid bulk email sending failed: ${error.message}`);
    }
  }
}
