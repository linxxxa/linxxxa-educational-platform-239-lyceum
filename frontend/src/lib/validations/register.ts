import { z } from "zod";
import {
  displayLoginSchema,
  emailFieldSchema,
  passwordFieldSchema,
} from "./common";

export const registerSchema = z
  .object({
    login: displayLoginSchema,
    email: emailFieldSchema,
    password: passwordFieldSchema,
    confirmPassword: z.string(),
    deck_share_token: z.string().max(96).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
