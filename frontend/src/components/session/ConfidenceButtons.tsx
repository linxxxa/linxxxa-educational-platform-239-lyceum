interface Props {
  onSelect: (c: "легко" | "средне" | "тяжело") => void;
}

export default function ConfidenceButtons({ onSelect }: Props) {
  return (
    <div>
      <p className="mb-3 text-center text-[11px] text-neutral-400">
        Насколько легко вы вспомнили?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSelect("тяжело")}
          className="flex-1 rounded-md border border-neutral-200 py-2 text-[13px] text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Сложно
        </button>
        <button
          type="button"
          onClick={() => onSelect("средне")}
          className="flex-1 rounded-md border border-neutral-200 py-2 text-[13px] text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Средне
        </button>
        <button
          type="button"
          onClick={() => onSelect("легко")}
          className="flex-1 rounded-md bg-[#2F3437] py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-[0.85]"
        >
          Легко ✓
        </button>
      </div>
    </div>
  );
}
