import { IsNotEmpty } from 'class-validator';

export class ListConversationsDto {
  @IsNotEmpty()
  projectId: number; // Thay vì connectedPageId
  status?: 'open' | 'closed';
  page?: number;
  limit?: number;
}
