import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
// Главная — «Атлас-издание» (ребрендинг 2027,
// docs/rebrand-2027/SCREEN_SCORE.md). Прежняя главная «Гратикул»
// осталась в components/graticule/Home.tsx: её шапка и футер ещё
// обслуживают непереведённые страницы.
import HomeView from "@/components/vps/Home";

interface PageProps {
  searchParams: Promise<{ step?: string; ref?: string }>;
}

export default async function IndexRoute({ searchParams }: PageProps) {
  const params = await searchParams;

  // Вошедший человек на витрине не задерживается. Проверяется живая
  // сессия, а не наличие куки: устаревшая кука не должна гонять
  // человека между главной и входом.
  if (await getSessionUser()) {
    redirect("/dashboard");
  }

  // Середина входа по коду живёт на своей странице.
  if (params.step === "code") {
    const url = `/auth?step=code${params.ref ? `&ref=${encodeURIComponent(params.ref)}` : ""}`;
    redirect(url);
  }

  return <HomeView referralCode={params.ref} />;
}
