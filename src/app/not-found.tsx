import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import Lost404 from "@/components/vps/Lost404";

export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false },
};

/**
 * 404 — корпус Atlas Secure VPS. Разворот «текст слева, объёмные цифры
 * справа» (владелец, 19.09.2026, с референсом-заставкой). Сама сцена и
 * решения по ней — `Lost404.tsx`: там же написано, что взято у
 * референса, а что намеренно нет.
 *
 * Страница остаётся серверной ради metadata; клиентская часть — только
 * сцена, которой нужен курсор.
 */
export default function NotFound() {
  return (
    <VShell>
      <Lost404 />
    </VShell>
  );
}
