import { notFound } from "next/navigation";
import DashboardApp from "@/components/dashboard-app";
import { companies } from "@/data/demo";

export const instant = false;

export function generateStaticParams() {
  return companies.map((company) => ({ symbol: company.symbol }));
}

export default async function CompanyPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  if (!companies.some((company) => company.symbol === symbol)) notFound();
  return <DashboardApp section="company-detail" selectedSymbol={symbol} />;
}
