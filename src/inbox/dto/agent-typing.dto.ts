// src/inbox/dto/agent-typing.dto.ts
import { IsBoolean } from 'class-validator';

export class AgentTypingDto {
  @IsBoolean()
  isTyping: boolean;
}
