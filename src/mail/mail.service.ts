// src/mail/mail.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    // Create a transporter object using the SMTP transport
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', // Gmail SMTP server
      port: 465, // Port for SSL
      secure: true, // Use SSL
      auth: {
        user: this.configService.get<string>('MAIL_USER'), // Your Gmail address from .env
        pass: this.configService.get<string>('MAIL_APP_PASSWORD'), // Your App Password from .env
      },
    });
  }

  /**
   * Sends an email.
   * @param to The recipient's email address.
   * @param subject The subject of the email.
   * @param html The HTML content of the email.
   */
  async sendMail(to: string, subject: string, html: string): Promise<void> {
    const mailOptions = {
      from: `"Social Commerce" <${this.configService.get<string>('MAIL_USER')}>`, // sender address
      to: to, // list of receivers
      subject: subject, // Subject line
      html: html, // html body
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Message sent: %s', info.messageId);
    } catch (error) {
      console.error('Error sending email:', error);
      // Depending on your app's needs, you might want to throw the error
      // or handle it gracefully.
      throw new Error('Could not send email.');
    }
  }
}
