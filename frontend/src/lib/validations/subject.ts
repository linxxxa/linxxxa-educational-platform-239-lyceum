import { z } from "zod";
import { safeDescriptionOptionalSchema, safeTitleSchema } from "./common";

export const addSubjectFormSchema = z.object({
  subject_display_name: safeTitleSchema,
  subject_description_text: safeDescriptionOptionalSchema,
});

export type AddSubjectFormInput = z.infer<typeof addSubjectFormSchema>;
