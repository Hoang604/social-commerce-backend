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
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { SendReplyDto } from './dto/send-reply.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { GetCurrentUser } from '../common/decorators/get-current-user.decorator';
import { User } from '../user/entities/user.entity';

@Controller('api/v1/inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService
  ) {}

  @Get('conversations')
  listConversations(
    @GetCurrentUser() user: User,
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListConversationsDto
  ) {
    // SỬA LỖI: Gọi đúng phương thức `listByProject`
    return this.conversationService.listByProject(user, projectId, query);
  }

  @Post('conversations/:id/messages')
  sendReply(
    @GetCurrentUser() user: User,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() body: SendReplyDto
  ) {
    // SỬA LỖI: Gọi đúng phương thức `sendAgentReply` và truyền đủ tham số
    return this.messageService.sendAgentReply(
      user,
      conversationId,
      body.text,
      body.visitorId // Truyền visitorId từ body
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
    @GetCurrentUser() user: User,
    @Param('id', ParseIntPipe) conversationId: number,
    @Query() query: ListMessagesDto
  ) {
    // SỬA LỖI: Gọi phương thức đã được bổ sung
    return this.messageService.listByConversation(user, conversationId, query);
  }
}
