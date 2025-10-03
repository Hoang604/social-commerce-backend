export class VisitorMessageReceivedEvent {
  tempId: string;
  content: string;
  visitorUid: string;
  projectId: number;
  socketId: string;
}

export class VisitorIdentifiedEvent {
  projectId: number;
  visitorUid: string;
  socketId: string;
}

export class VisitorTypingEvent {
  isTyping: boolean;
  projectId: number;
  conversationId: number;
}

export class VisitorContextUpdatedEvent {
  currentUrl: string;
  projectId: number;
  conversationId: number;
}
