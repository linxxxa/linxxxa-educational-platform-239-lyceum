export interface LearningCard {
  card_unique_identifier: number;
  card_question_text_payload: string;
  card_answer_text_payload: string;
}

export interface UserAnswerSubmission {
  target_card_unique_identifier: number;
  submitted_user_answer_is_correct: boolean;
  user_subjective_confidence_score: number;
  response_thinking_time_seconds?: number;
  response_thinking_time_ms?: number;
}
