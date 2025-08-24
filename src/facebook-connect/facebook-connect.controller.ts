import {
  Controller,
  Get,
  Post,
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
  Body,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { FacebookConnectService } from './facebook-connect.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request, Response } from 'express';
import { FacebookCallbackDto } from './dto/facebook-callback.dto';
import { AuthUrlDto } from './dto/auth-url.dto';
import { CreateConnectedPageDto } from './dto/create-connected-page.dto';
import { ConnectedPage } from './entities/connected-page.entity';
import { PendingPagesDto } from './dto/pending-pages.dto';

// Định nghĩa một interface cho Request đã được xác thực
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class FacebookConnectController {
  private readonly logger = new Logger(FacebookConnectController.name);

  constructor(
    private readonly facebookConnectService: FacebookConnectService
  ) {}

  @Get('facebook/connect/auth-url')
  initiateConnection(@Req() req: AuthenticatedRequest): AuthUrlDto {
    const userId = req.user.id;
    const authorizationUrl =
      this.facebookConnectService.initiateConnection(userId);
    return { authUrl: authorizationUrl };
  }

  @Get('facebook/connect/callback')
  async handleCallback(
    @Query(new ValidationPipe()) query: FacebookCallbackDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const userId = req.user.id;
    this.logger.log(`Handling Facebook callback for user ${userId}`);
    await this.facebookConnectService.handleCallback(
      userId,
      query.code,
      query.state
    );

    const frontendUrl = this.facebookConnectService.getFrontendSelectPageUrl();
    res.redirect(frontendUrl);
  }

  @Get('facebook/connect/pending-pages')
  getPendingPages(@Req() req: AuthenticatedRequest): PendingPagesDto {
    const userId = req.user.id;
    return this.facebookConnectService.getPendingPages(userId);
  }

  @Post('connected-pages')
  @HttpCode(HttpStatus.CREATED)
  async connectPage(
    @Req() req: AuthenticatedRequest,
    @Body(new ValidationPipe()) createDto: CreateConnectedPageDto
  ): Promise<Omit<ConnectedPage, 'encryptedPageAccessToken'>> {
    const userId = req.user.id;
    this.logger.log(
      `User ${userId} connecting page ${createDto.facebookPageId}`
    );
    const connectedPage = await this.facebookConnectService.saveConnectedPage(
      userId,
      createDto
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedPageAccessToken, ...result } = connectedPage;
    return result;
  }

  @Get('connected-pages')
  listConnectedPages(
    @Req() req: AuthenticatedRequest
  ): Promise<ConnectedPage[]> {
    const userId = req.user.id;
    return this.facebookConnectService.listConnectedPages(userId);
  }

  @Delete('connected-pages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnectPage(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    const userId = req.user.id;
    this.logger.log(`User ${userId} disconnecting page ${id}`);
    await this.facebookConnectService.disconnectPage(userId, id);
  }
}
