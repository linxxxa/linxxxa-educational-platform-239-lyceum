import { z } from "zod";
import { emailFieldSchema } from "./common";

/** Email получателя для «Поделиться колодой». */
export const shareDeckEmailSchema = z.object({
  email: emailFieldSchema,
});

export type ShareDeckEmailInput = z.infer<typeof shareDeckEmailSchema>;
