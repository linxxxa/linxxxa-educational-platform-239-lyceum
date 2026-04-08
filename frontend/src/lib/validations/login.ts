import { z } from "zod";
import { emailFieldSchema } from "./common";

export const loginSchema = z.object({
  email: emailFieldSchema,
  password: z
    .string()
    .min(1, "Введите пароль")
    .max(100, "Пароль не более 100 символов"),
});

export type LoginInput = z.infer<typeof loginSchema>;
