import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ConversationStatus } from '../entities/conversation.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListConversationsDto extends PaginationDto {
  @IsString()
  connectedPageId: string;

  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;
}
