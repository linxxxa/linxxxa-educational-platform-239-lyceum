import { z } from "zod";

export const registerSchema = z
  .object({
    login: z
      .string()
      .min(1, "Логин обязателен")
      .max(100, "Логин не более 100 символов")
      .regex(
        /^[\p{L}\p{N}\s_-]+$/u,
        "Только буквы, цифры, пробелы, дефис и подчёркивание"
      ),

    email: z
      .string()
      .email("Некорректный email")
      .max(255, "Email не более 255 символов"),

    password: z
      .string()
      .min(8, "Пароль минимум 8 символов")
      .max(100, "Пароль не более 100 символов"),

    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
