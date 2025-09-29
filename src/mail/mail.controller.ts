// src/mail/mail.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('test-send')
  async sendTestEmail(@Body('to') to: string) {
    const subject = 'Email kiểm tra từ NestJS';
    const html =
      '<h1>Đây là email được gửi từ MailService!</h1><p>Nếu bạn nhận được email này, mọi thứ đã hoạt động thành công.</p>';

    await this.mailService.sendMail(to, subject, html);

    return {
      message: `Đã gửi email kiểm tra tới ${to}`,
    };
  }
}
