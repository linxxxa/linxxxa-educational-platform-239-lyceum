export interface Card {
  card_id: number;
  question_text: string;
  answer_text: string;
  card_type: "понятие" | "формула" | "задача";
  topic_title: string;
  subject: string;
}

export interface SessionState {
  energy: number;
  cards_done: number;
  cards_total: number;
}
