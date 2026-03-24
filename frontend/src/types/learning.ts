/**
 * 239 Protocol — типы сущностей контента (Subjects, Topics, Cards).
 * ID — number, в БД Integer (согласовано с progress / study).
 */

export interface SubjectMetadataTransferObject {
  subject_display_name: string;
  subject_description_text?: string | null;
}

export interface LearningSubjectRecord {
  subject_unique_identifier: number;
  subject_display_name: string;
  subject_description_text: string | null;
  created_by_user_id: number;
}

export type CardTypeCategoryProtocol = "CONCEPT" | "FORMULA" | "TASK";

export interface CardPayloadItem {
  card_content_question_latex: string;
  card_content_answer_latex: string;
  card_difficulty_level_coefficient: number;
  card_type_category: CardTypeCategoryProtocol;
}

export interface DeckBatchSaveRequest {
  parent_subject_reference_id: number;
  topic_title_name: string;
  topic_description_text?: string | null;
  is_public_visibility: boolean;
  new_card_payload_collection: CardPayloadItem[];
}

export interface TopicListItem {
  topic_unique_identifier: number;
  topic_display_name: string;
  topic_description_text: string | null;
  parent_subject_reference_id: number | null;
  is_public_visibility: boolean;
  related_topics_count: number;
}
