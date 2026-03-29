export interface Card {
  card_id: number;
  question_text: string;
  answer_text: string;
  card_type: "понятие" | "формула" | "задача";
  /** Могут отсутствовать в ответе API — SessionProgress подставляет пустую подпись */
  topic_title?: string | null;
  subject?: string | null;
}

export interface SessionState {
  energy: number;
  cards_done: number;
  cards_total: number;
}
