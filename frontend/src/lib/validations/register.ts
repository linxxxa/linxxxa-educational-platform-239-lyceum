import { z } from "zod";
import {
  displayLoginSchema,
  emailFieldSchema,
  passwordFieldSchema,
} from "./common";

const registerObjectSchema = z.object({
  login: displayLoginSchema,
  email: emailFieldSchema,
  password: passwordFieldSchema,
  confirmPassword: z.string(),
  /** null из JSON не ломает safeParse */
  deck_share_token: z.string().max(96).nullish(),
});

/** Для формы: без deck_share_token (токен берётся из URL). */
export const registerFormSchema = registerObjectSchema
  .omit({ deck_share_token: true })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

/** Для API: полное тело запроса. */
export const registerSchema = registerObjectSchema.refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  }
);

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormInput = z.infer<typeof registerFormSchema>;
