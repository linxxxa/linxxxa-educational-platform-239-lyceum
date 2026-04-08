import { z } from "zod";

/** Слишком предсказуемые пароли (брутфорс / спам). */
const WEAK_PASSWORDS = new Set(
  [
    "12345678",
    "123456789",
    "1234567890",
    "11111111",
    "87654321",
    "password",
    "password123",
    "qwerty123",
    "admin123",
    "letmein",
    "welcome1",
  ].map((s) => s.toLowerCase())
);

/**
 * Email: trim, длина 5–100, формат почты, без угловых скобок (XSS).
 */
export const emailFieldSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(5, "Email слишком короткий (минимум 5 символов)")
      .max(100, "Email не длиннее 100 символов")
      .email("Неверный формат почты")
      .refine(
        (s) => !/[<>]/.test(s),
        "Упс! В поле «Email» есть запрещённые символы"
      )
  );

/**
 * Пароль: 8–100 символов, не из списка слабых.
 */
export const passwordFieldSchema = z
  .string()
  .min(8, "Пароль должен быть не менее 8 символов")
  .max(100, "Пароль не более 100 символов")
  .refine(
    (p) => !WEAK_PASSWORDS.has(p.toLowerCase()),
    "Пароль слишком простой — выберите другой"
  );

/**
 * Имя пользователя / логин: буквы, цифры, пробелы, дефис, подчёркивание; без <>.
 */
export const displayLoginSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(1, "Логин обязателен")
      .max(100, "Логин не более 100 символов")
      .regex(
        /^[\p{L}\p{N}\s_-]+$/u,
        "Только буквы, цифры, пробелы, дефис и подчёркивание"
      )
      .refine(
        (s) => !/[<>]/.test(s),
        "Упс! В логине есть запрещённые символы"
      )
  );

/**
 * Название темы, предмета, коротких полей: макс. 100, без HTML-подобных вставок.
 */
export const safeTitleSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(1, "Укажите название")
      .max(100, "Слишком длинное название (макс. 100 симв.)")
      .refine((s) => !/[<>]/.test(s), "Упс! Есть запрещённые символы (< и >)")
  );

/** Описание темы / предмета: до 2000 символов, без угловых скобок; пустая строка допустима. */
export const safeDescriptionOptionalSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z.union([
      z.literal(""),
      z
        .string()
        .min(1)
        .max(2000, "Описание не длиннее 2000 символов")
        .refine(
          (s) => !/[<>]/.test(s),
          "Упс! В описании есть запрещённые символы (< и >)"
        ),
    ])
  );

export type EmailField = z.infer<typeof emailFieldSchema>;
export type PasswordField = z.infer<typeof passwordFieldSchema>;
