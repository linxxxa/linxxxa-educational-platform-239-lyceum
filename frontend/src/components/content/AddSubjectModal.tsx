"use client";

import { useEffect, useState } from "react";
import type { SubjectMetadataTransferObject } from "@/types/learning";

interface AddSubjectModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: SubjectMetadataTransferObject) => Promise<void>;
}

/**
 * Модальное окно уровня 1: создание предмета (learning_subjects).
 */
export function AddSubjectModal({ open, onClose, onSave }: AddSubjectModalProps) {
  const [subject_display_name, setSubjectDisplayName] = useState("");
  const [subject_description_text, setSubjectDescriptionText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubjectDisplayName("");
    setSubjectDescriptionText("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = subject_display_name.trim();
    if (!name) {
      setError("Введите название предмета");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        subject_display_name: name,
        subject_description_text: subject_description_text.trim() || null,
      });
      onClose();
    } catch (er) {
      setError(er instanceof Error ? er.message : "Не удалось создать предмет");
    } finally {
      setBusy(false);
    }
  };

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
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="add-subject-title"
          className="mb-4 text-[16px] font-semibold text-neutral-900 dark:text-neutral-100"
        >
          Новый предмет
        </h2>
        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}
        <label className="mb-1 block text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
          Название предмета
        </label>
        <input
          autoFocus
          value={subject_display_name}
          onChange={(e) => setSubjectDisplayName(e.target.value)}
          className="mb-4 h-10 w-full rounded-md border border-neutral-200 px-3 text-[13px] outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950"
          placeholder="Например: Физика"
        />
        <label className="mb-1 block text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
          Описание (необязательно)
        </label>
        <textarea
          value={subject_description_text}
          onChange={(e) => setSubjectDescriptionText(e.target.value)}
          rows={3}
          className="mb-4 w-full resize-y rounded-md border border-neutral-200 px-3 py-2 text-[13px] outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950"
          placeholder="Курс подготовки к олимпиадам"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-neutral-200 px-4 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-[#2F3437] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Создание…" : "Создать предмет"}
          </button>
        </div>
      </form>
    </div>
  );
}
