import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  Req,
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
import { AgentTypingDto } from './dto/agent-typing.dto';
import { RolesGuard } from 'src/rbac/roles.guard';
import { Roles } from 'src/rbac/roles.decorator';
import { Role } from 'src/rbac/roles.enum';

@Controller('inbox')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.AGENT)
export class InboxController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService
  ) {}

  @Get('conversations')
  listConversations(
    @GetCurrentUser() user: User,
    @Query() query: ListConversationsDto
  ) {
    return this.conversationService.listByProject(user, query);
  }

  @Post('conversations/:id/messages')
  sendReply(
    @GetCurrentUser() user: User,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() body: SendReplyDto
  ) {
    return this.messageService.sendAgentReply(user, conversationId, body.text);
  }

  @Patch('conversations/:id')
  updateConversation(
    @GetCurrentUser() user: User,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() body: UpdateConversationDto
  ) {
    const userId = user.id;
    if (body.status) {
      return this.conversationService.updateStatus(
        userId,
        conversationId,
        body.status
      );
    }
    if (body.read === true) {
      return this.conversationService.markAsRead(userId, conversationId);
    }
  }

  @Get('conversations/:id/messages')
  listMessages(
    @GetCurrentUser() user: User,
    @Param('id', ParseIntPipe) conversationId: number,
    @Query() query: ListMessagesDto
  ) {
    return this.messageService.listByConversation(user, conversationId, query);
  }
  @Post('conversations/:id/typing')
  @HttpCode(204) // No Content
  async handleAgentTyping(
    @GetCurrentUser() user: User,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() body: AgentTypingDto
  ) {
    await this.conversationService.handleAgentTyping(
      user,
      conversationId,
      body.isTyping
    );
  }
}
