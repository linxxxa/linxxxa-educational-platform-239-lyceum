import { redirect } from "next/navigation";

/** Список тем / колод — основная страница управления темами. */
export default function DashboardDecksPage() {
  redirect("/dashboard/topics");
}
