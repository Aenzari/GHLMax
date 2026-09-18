export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TutorContext {
  /** What page/lesson/challenge the learner is currently viewing, for grounding — never include answer keys here. */
  pageType: 'lesson' | 'challenge' | 'canvas' | 'general';
  title?: string;
  /** Short excerpt only — never the full expected_solution or answer key. */
  contextSnippet?: string;
}

export interface TutorRequestBody {
  messages: TutorMessage[];
  context?: TutorContext;
}

export interface TutorResponseBody {
  reply: string;
}
