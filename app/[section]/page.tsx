import { notFound } from "next/navigation";
import DashboardApp from "@/components/dashboard-app";

export const instant = false;

const sections = new Set([
  "dividend-calendar",
  "dividend-screener",
  "all-companies",
  "company-analysis",
  "dividend-calculator",
  "compare-companies",
  "my-portfolio",
  "watchlist",
  "corporate-actions",
  "manual-dividends",
  "reports",
  "settings",
  "owner",
]);

export function generateStaticParams() {
  return Array.from(sections, (section) => ({ section }));
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  return <DashboardApp section={section} />;
}
