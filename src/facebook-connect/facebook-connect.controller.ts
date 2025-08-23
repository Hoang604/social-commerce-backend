import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
  Delete,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FacebookConnectService } from './facebook-connect.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request, Response } from 'express';
import { FacebookCallbackDto } from './dto/facebook-callback.dto';

@Controller('api/facebook-connect')
@UseGuards(JwtAuthGuard)
export class FacebookConnectController {
  constructor(
    private readonly facebookConnectService: FacebookConnectService
  ) {}

  @Get('initiate')
  initiateConnection(@Req() req: Request) {
    if (!req.user || !req.user['id']) {
      throw new Error('User information is missing in the request.');
    }
    const userId = req.user['id'];
    const authorizationUrl =
      this.facebookConnectService.initiateConnection(userId);
    return { authorizationUrl };
  }

  @Get('callback')
  async handleCallback(
    @Query(new ValidationPipe()) query: FacebookCallbackDto,
    @Res() res: Response
  ) {
    await this.facebookConnectService.handleCallback(query.code, query.state);
    // Chuyển hướng người dùng về trang cài đặt trên frontend
    // Bạn nên thay đổi URL này thành URL của ứng dụng frontend của bạn
    res.redirect('http://localhost:3001/settings/connections?status=success');
  }

  @Get('pages')
  listConnectedPages(@Req() req: Request) {
    if (!req.user || !req.user['id']) {
      throw new Error('User information is missing in the request.');
    }
    const userId = req.user['id'];
    return this.facebookConnectService.listConnectedPages(userId);
  }

  @Delete('pages/:pageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnectPage(
    @Req() req: Request,
    @Param('pageId', ParseUUIDPipe) pageId: string
  ) {
    if (!req.user || !req.user['id']) {
      throw new Error('User information is missing in the request.');
    }
    const userId = req.user['id'];
    await this.facebookConnectService.disconnectPage(userId, pageId);
  }
}
