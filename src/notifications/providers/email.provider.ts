import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailProvider {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
  }

  async sendEmail(options: {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
  }): Promise<any> {
    try {
      const result = await this.resend.emails.send({
        from:
          options.from || 'Church Management System <noreply@yourchurch.com>',
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
      });

      return result;
    } catch (error) {
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  async sendBulkEmail(options: {
    recipients: Array<{ email: string; name?: string }>;
    subject: string;
    html: string;
    from?: string;
  }): Promise<any> {
    const emails = options.recipients.map((recipient) => ({
      from: options.from || 'Church Management System <noreply@yourchurch.com>',
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
}
