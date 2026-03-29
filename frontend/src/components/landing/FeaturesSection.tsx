export function FeaturesSection() {
  const features = [
    {
      title: "Адаптивные карточки",
      description: "Алгоритм SM-2 подстраивает интервалы повторения под вас",
    },
    {
      title: "Когнитивная энергия",
      description: "Учёт нагрузки на внимание при планировании сессий",
    },
    {
      title: "Уровень знаний",
      description:
        "Понятный балл из 100: насколько ты готов к экзамену с учётом тем, стабильности и практики",
    },
  ];

  return (
    <section className="border-t border-zinc-200 px-4 py-16 dark:border-zinc-800">
      <h2 className="mb-12 text-center text-2xl font-semibold">
        Возможности платформы
      </h2>
      <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
          >
            <h3 className="mb-2 font-medium">{feature.title}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
