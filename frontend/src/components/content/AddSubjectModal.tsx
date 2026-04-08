"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { SubjectMetadataTransferObject } from "@/types/learning";
import {
  addSubjectFormSchema,
  type AddSubjectFormInput,
} from "@/lib/validations/subject";

interface AddSubjectModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: SubjectMetadataTransferObject) => Promise<void>;
}

/**
 * Модальное окно уровня 1: создание предмета (learning_subjects).
 */
export function AddSubjectModal({ open, onClose, onSave }: AddSubjectModalProps) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddSubjectFormInput>({
    resolver: zodResolver(addSubjectFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      subject_display_name: "",
      subject_description_text: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    reset({
      subject_display_name: "",
      subject_description_text: "",
    });
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onSubmit = handleSubmit(async (data) => {
    setSaveError(null);
    try {
      await onSave({
        subject_display_name: data.subject_display_name,
        subject_description_text: data.subject_description_text || null,
      });
      onClose();
    } catch (er) {
      setSaveError(
        er instanceof Error ? er.message : "Не удалось создать предмет"
      );
    }
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-subject-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        onMouseDown={(e) => e.stopPropagation()}
        noValidate
      >
        <h2
          id="add-subject-title"
          className="mb-4 text-[16px] font-semibold text-neutral-900 dark:text-neutral-100"
        >
          Новый предмет
        </h2>
        {saveError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {saveError}
          </div>
        )}
        <label
          htmlFor="subject_display_name"
          className="mb-1 block text-[12px] font-medium text-neutral-700 dark:text-neutral-300"
        >
          Название предмета
        </label>
        <input
          id="subject_display_name"
          autoFocus
          {...register("subject_display_name")}
          className={`mb-1 h-10 w-full rounded-md border px-3 text-[13px] outline-none focus:border-neutral-400 dark:bg-neutral-950 ${
            errors.subject_display_name
              ? "border-red-400 dark:border-red-600"
              : "border-neutral-200 dark:border-neutral-700"
          }`}
          placeholder="Например: Физика"
        />
        {errors.subject_display_name?.message ? (
          <p className="mb-4 text-[11px] text-red-500">
            {errors.subject_display_name.message}
          </p>
        ) : (
          <div className="mb-4" />
        )}
        <label
          htmlFor="subject_description_text"
          className="mb-1 block text-[12px] font-medium text-neutral-700 dark:text-neutral-300"
        >
          Описание (необязательно)
        </label>
        <textarea
          id="subject_description_text"
          rows={3}
          {...register("subject_description_text")}
          className={`mb-1 w-full resize-y rounded-md border px-3 py-2 text-[13px] outline-none focus:border-neutral-400 dark:bg-neutral-950 ${
            errors.subject_description_text
              ? "border-red-400 dark:border-red-600"
              : "border-neutral-200 dark:border-neutral-700"
          }`}
          placeholder="Курс подготовки к олимпиадам"
        />
        {errors.subject_description_text?.message ? (
          <p className="mb-4 text-[11px] text-red-500">
            {errors.subject_description_text.message}
          </p>
        ) : (
          <div className="mb-4" />
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-neutral-200 px-4 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-[#2F3437] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "Создание…" : "Создать предмет"}
          </button>
        </div>
      </form>
    </div>
  );
}
