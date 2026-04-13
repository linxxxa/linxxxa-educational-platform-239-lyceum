import type { Metadata } from "next";
import { HowItWorks } from "@/components/how-it-works/HowItWorks";

export const metadata: Metadata = {
  title: "Как это работает — EduLab",
  description:
    "Когнитивные режимы, интервальные повторения SM-2, аналитика и шеринг колод в EduLab.",
};

export default function HowItWorksPage() {
  return (
    <article>
      <HowItWorks />
    </article>
  );
}
