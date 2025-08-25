import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { ListConversationsDto } from './dto/list-conversations.dto';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.interface';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { SendReplyDto } from './dto/send-reply.dto';
import { ListMessagesDto } from './dto/list-messages.dto';

@Controller('api/v1/inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService
  ) {}

  @Get('conversations')
  listConversations(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListConversationsDto
  ) {
    return this.conversationService.listByPage(req.user.id, query);
  }

  @Post('conversations/:id/messages')
  sendReply(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() body: SendReplyDto
  ) {
    return this.messageService.sendReply(
      req.user.id,
      conversationId,
      body.text
    );
  }

  @Patch('conversations/:id')
  updateConversation(
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() body: UpdateConversationDto
  ) {
    if (body.status) {
      return this.conversationService.updateStatus(conversationId, body.status);
    }
    if (body.read === true) {
      return this.conversationService.markAsRead(conversationId);
    }
  }

  @Get('conversations/:id/messages')
  listMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) conversationId: number,
    @Query() query: ListMessagesDto
  ) {
    return this.messageService.listByConversation(
      req.user.id,
      conversationId,
      query
    );
  }
}
