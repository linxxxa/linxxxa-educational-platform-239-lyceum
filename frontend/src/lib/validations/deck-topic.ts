import { z } from "zod";
import { safeDescriptionOptionalSchema, safeTitleSchema } from "./common";

/** Шаг создания колоды: название и описание темы. */
export const deckTopicFieldsSchema = z.object({
  topicTitle: safeTitleSchema,
  topicDesc: safeDescriptionOptionalSchema,
});

export type DeckTopicFieldsInput = z.infer<typeof deckTopicFieldsSchema>;
