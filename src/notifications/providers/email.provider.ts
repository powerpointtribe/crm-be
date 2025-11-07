import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as sgMail from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private resend: Resend;
  private nodemailerTransporter: Transporter;
  private emailProvider: 'resend' | 'sendgrid' | 'nodemailer';

  constructor(private configService: ConfigService) {
    this.emailProvider = this.configService.get<string>('EMAIL_PROVIDER') as 'resend' | 'sendgrid' | 'nodemailer' || 'nodemailer';

    if (this.emailProvider === 'sendgrid') {
      this.initializeSendGrid();
    } else if (this.emailProvider === 'resend') {
      this.initializeResend();
    } else {
      this.initializeNodemailer();
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

  private initializeNodemailer() {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const smtpHost = this.configService.get<string>('SMTP_HOST') || 'smtp.sendgrid.net';
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    const smtpUser = this.configService.get<string>('SMTP_USER') || 'apikey';

    if (!apiKey) {
      this.logger.error('SENDGRID_API_KEY is not configured in environment variables');
      throw new Error('SENDGRID_API_KEY is required for Nodemailer with SendGrid SMTP');
    }

    this.logger.log('Initializing Nodemailer with SendGrid SMTP...');

    this.nodemailerTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: true,
      auth: {
        user: smtpUser,
        pass: apiKey, // SendGrid API key as password
      },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    });

    // Verify connection configuration
    this.nodemailerTransporter.verify((error, success) => {
      if (error) {
        this.logger.error('Nodemailer SendGrid SMTP verification failed:', error);
      } else {
        this.logger.log('Nodemailer SendGrid SMTP server is ready to take our messages');
      }
    });

    this.logger.log('Nodemailer with SendGrid SMTP initialized successfully');
  }

  async sendEmail(options: {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
  }): Promise<any> {
    if (this.emailProvider === 'sendgrid') {
      return this.sendEmailWithSendGrid(options);
    } else if (this.emailProvider === 'nodemailer') {
      return this.sendEmailWithNodemailer(options);
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

  private async sendEmailWithNodemailer(options: {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
  }): Promise<any> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const defaultSender = this.configService.get<string>('SENDER_EMAIL') || 'hello@comtrova.com';
    const fromEmail = options.from || `Church Management System <${defaultSender}>`;

    this.logger.log(`[Nodemailer] Attempting to send email to: ${recipients.join(', ')}`);
    this.logger.log(`Subject: ${options.subject}`);
    this.logger.log(`From: ${fromEmail}`);

    try {
      const mailOptions = {
        from: fromEmail,
        to: recipients.join(', '),
        subject: options.subject,
        html: options.html,
      };

      this.logger.debug('Nodemailer email payload:', JSON.stringify(mailOptions, null, 2));

      const result = await this.nodemailerTransporter.sendMail(mailOptions);

      this.logger.log(`Nodemailer email sent successfully!`);
      this.logger.log(`Message ID: ${result.messageId}`);
      this.logger.log(`Nodemailer result:`, JSON.stringify(result, null, 2));

      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
        envelope: result.envelope
      };
    } catch (error) {
      this.logger.error(`Nodemailer email sending failed:`, error);
      this.logger.error(`Nodemailer error details:`, {
        message: error.message,
        stack: error.stack,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
      });

      throw new Error(`Nodemailer email sending failed: ${error.message}`);
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
    } else if (this.emailProvider === 'nodemailer') {
      return this.sendBulkEmailWithNodemailer(options);
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

  private async sendBulkEmailWithNodemailer(options: {
    recipients: Array<{ email: string; name?: string }>;
    subject: string;
    html: string;
    from?: string;
  }): Promise<any> {
    const defaultSender = this.configService.get<string>('SENDER_EMAIL') || 'hello@comtrova.com';
    const fromEmail = options.from || `Church Management System <${defaultSender}>`;

    this.logger.log(`[Nodemailer] Sending bulk email to ${options.recipients.length} recipients`);

    const results: Array<{ email: string; messageId: string; success: boolean }> = [];
    const errors: Array<{ email: string; error: string; success: boolean }> = [];

    // Send emails one by one (for better error handling and delivery tracking)
    for (const recipient of options.recipients) {
      try {
        const mailOptions = {
          from: fromEmail,
          to: recipient.email,
          subject: options.subject,
          html: options.html.replace('{{name}}', recipient.name || 'Member'),
        };

        const result = await this.nodemailerTransporter.sendMail(mailOptions);
        results.push({
          email: recipient.email,
          messageId: result.messageId,
          success: true
        });

        this.logger.log(`Email sent to ${recipient.email} - Message ID: ${result.messageId}`);
      } catch (error) {
        this.logger.error(`Failed to send email to ${recipient.email}:`, error.message);
        errors.push({
          email: recipient.email,
          error: error.message,
          success: false
        });
      }
    }

    this.logger.log(`Nodemailer bulk email completed: ${results.length} successful, ${errors.length} failed`);

    if (errors.length > 0) {
      this.logger.warn(`Some emails failed to send:`, errors);
    }

    return {
      success: true,
      totalSent: results.length,
      totalFailed: errors.length,
      results,
      errors
    };
  }
}
