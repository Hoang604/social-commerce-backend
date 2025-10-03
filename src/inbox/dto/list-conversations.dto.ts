import { IsNotEmpty } from 'class-validator';

export class ListConversationsDto {
  @IsNotEmpty()
  projectId: number;
  status?: 'open' | 'closed';
  page?: number;
  limit?: number;
}
