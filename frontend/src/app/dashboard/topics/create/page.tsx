import { DeckCreateForm } from "@/components/content/DeckCreateForm";

export default function CreateTopicDeckPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 dark:bg-neutral-950">
      <div className="mx-auto max-w-[880px]">
        <h1 className="mb-2 text-[22px] font-medium text-neutral-900 dark:text-neutral-100">
          Новая колода
        </h1>
        <p className="mb-8 text-[13px] text-neutral-500">
          Выберите предмет, задайте название темы и добавьте карточки с LaTeX.
        </p>
        <DeckCreateForm />
      </div>
    </main>
  );
}
