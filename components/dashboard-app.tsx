"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Activity, ArrowDown, ArrowDownRight, ArrowUpRight, Bell, CalendarDays, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Download, FileBarChart2,
  LayoutDashboard, LineChart, ListFilter, Menu, Moon, MoreHorizontal,
  Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Sun, Wallet,
  X, Zap, Building2, Calculator, CircleDollarSign, ClipboardList,
  GitCompareArrows, Landmark, PieChart, Star, TrendingUp, Pencil, LockKeyhole, LogOut,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart as RechartsLineChart,
  Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  companies, dividendHistory, marketIndices, monthlyDistribution,
  reportTotals,
  sectorDistribution, type DividendCompany,
} from "@/data/demo";

type Theme = "dark" | "light";
type Holding = { symbol: string; quantity: number; price: number };
type Profile = { name: string; email: string };
const defaultProfile: Profile = { name: "Aditya Sharma", email: "aditya@example.com" };
const CompaniesContext = createContext<{ companies: DividendCompany[]; setCompanies: (companies: DividendCompany[]) => void }>({
  companies,
  setCompanies: () => undefined,
});
const useCompanies = () => useContext(CompaniesContext).companies;
type AutoDividendState = { configured: boolean; events: DividendCompany[]; lastSyncedAt: string | null };
const AutoDividendContext = createContext<AutoDividendState>({ configured: false, events: [], lastSyncedAt: null });
const useAutoDividends = () => useContext(AutoDividendContext);
type SectionKey =
  | "dashboard" | "dividend-calendar" | "dividend-screener" | "all-companies"
  | "company-analysis" | "dividend-calculator" | "compare-companies" | "my-portfolio"
  | "watchlist" | "corporate-actions" | "manual-dividends" | "reports" | "settings" | "owner";

const navigation: { key: SectionKey; label: string; icon: typeof LayoutDashboard; group: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { key: "dividend-calendar", label: "Dividend Calendar", icon: CalendarDays, group: "Research" },
  { key: "dividend-screener", label: "Dividend Screener", icon: ListFilter, group: "Research" },
  { key: "all-companies", label: "All Companies", icon: Building2, group: "Research" },
  { key: "company-analysis", label: "Company Analysis", icon: LineChart, group: "Research" },
  { key: "manual-dividends", label: "Manual Dividends", icon: Pencil, group: "Manual Data" },
  { key: "dividend-calculator", label: "Dividend Calculator", icon: Calculator, group: "Tools" },
  { key: "compare-companies", label: "Compare Companies", icon: GitCompareArrows, group: "Tools" },
  { key: "my-portfolio", label: "My Portfolio", icon: Wallet, group: "My workspace" },
  { key: "watchlist", label: "Watchlist", icon: Star, group: "My workspace" },
  { key: "corporate-actions", label: "Corporate Actions", icon: ClipboardList, group: "My workspace" },
  { key: "reports", label: "Reports", icon: FileBarChart2, group: "My workspace" },
  { key: "settings", label: "Settings", icon: Settings, group: "Preferences" },
];

const subscribeToClock = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
};
function getTodayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function useTodayKey() {
  return useSyncExternalStore(subscribeToClock, getTodayKey, () => "");
}
function getIndiaClockKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
function useIndiaClockKey() {
  return useSyncExternalStore(subscribeToClock, getIndiaClockKey, () => "");
}
function monthDate(key: string) {
  if (!key) return null;
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}
function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function moveMonth(key: string, offset: number) {
  const date = monthDate(key);
  return date ? monthKey(new Date(date.getFullYear(), date.getMonth() + offset, 1)) : key;
}
function parseDemoDate(value: string) {
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (isoDate) return new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
  const displayDate = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(value.trim());
  if (displayDate) {
    const monthIndex = new Date(`${displayDate[2]} 1, 2000`).getMonth();
    return new Date(Number(displayDate[3]), monthIndex, Number(displayDate[1]));
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function dayOffsetFromToday(value: string, todayKey: string) {
  const date = parseDemoDate(value);
  const today = parseDemoDate(todayKey);
  if (!date || !today) return null;
  const dateNumber = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const todayNumber = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((dateNumber - todayNumber) / 86_400_000);
}

function formatManualUpdateDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(date);
}

function ManualUpdateBadge() {
  return <span className="manual-update-badge" title="Manually entered; not independently verified">MANUAL</span>;
}

function ManualUpdateNote({ company }: { company: DividendCompany }) {
  if (!company.manualUpdateAt) return null;
  return <div className="manual-update-note"><ShieldCheck size={14} /><span>Dividend details manually entered on {formatManualUpdateDate(company.manualUpdateAt)}; not independently verified by DNX.{company.manualSourceUrl && <> <a href={company.manualSourceUrl} target="_blank" rel="noopener noreferrer">View provided source</a>.</>}</span></div>;
}

function CompanyDataSource({ company, subtle = false }: { company: DividendCompany; subtle?: boolean }) {
  if (company.manualUpdateAt) return <ManualUpdateBadge />;
  if (company.sourceProvider) return <span className="status-pill">AUTO SYNC · {company.sourceExchange ?? "EXCHANGE"}</span>;
  if (company.sourceExchange) return <span className="status-pill">{company.sourceExchange} CSV</span>;
  return <DemoTag subtle={subtle} />;
}

function OfficialSourceNote({ company }: { company: DividendCompany }) {
  if (!company.sourceExchange || !company.sourceUpdatedAt) return null;
  return <div className="manual-update-note"><ShieldCheck size={14} /><span>
    {company.sourceProvider
      ? `Automatically synchronized from ${company.sourceProvider} for ${company.sourceExchange} on ${formatManualUpdateDate(company.sourceUpdatedAt)}. Verify the announcement with the exchange before acting.`
      : `Imported from the official ${company.sourceExchange} corporate-actions CSV on ${formatManualUpdateDate(company.sourceUpdatedAt)}. Missing fields are shown as unavailable.`}
    {company.sourceUrl && <> <a href={company.sourceUrl} target="_blank" rel="noopener noreferrer">Open source disclosure</a>.</>}
  </span></div>;
}

function YieldSourceNote({ company }: { company: DividendCompany }) {
  if (!company.yieldAsOf || !company.yieldPriceExchange) return null;
  const period = company.yieldPeriodStart
    ? ` from ${formatManualUpdateDate(company.yieldPeriodStart)} through ${formatManualUpdateDate(company.yieldAsOf)}`
    : "";
  const crossListedNote = company.sourceExchange === "NSE" && company.yieldPriceExchange === "BSE"
    ? " BSE close is used as the available cross-listed price for this NSE listing."
    : "";
  return <div className="manual-update-note"><ShieldCheck size={14} /><span>
    Trailing dividend yield uses official dividend ex-dates{period}, divided by the official {company.yieldPriceExchange} closing price as of {formatManualUpdateDate(company.yieldAsOf)}. This is not live market data.{crossListedNote}
  </span></div>;
}

const currency = (amount: number | null, digits = 2) =>
  amount === null ? "—" : `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const compactCurrency = (amount: number | null) =>
  amount === null ? "—" : `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const companyExchangeSymbol = (company: DividendCompany) =>
  company.exchangeSymbol ? `${company.sourceExchange ?? ""} ${company.exchangeSymbol}`.trim() : company.symbol;
function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const contents = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function useLocalValue<T>(key: string, fallback: T): [T, (value: T) => void] {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("dnx-storage", onStoreChange);
    window.addEventListener("storage", onStoreChange);
    return () => {
      window.removeEventListener("dnx-storage", onStoreChange);
      window.removeEventListener("storage", onStoreChange);
    };
  }, []);
  const getSnapshot = useCallback(() => window.localStorage.getItem(key), [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const value = useMemo(() => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      console.error(`Could not parse saved ${key} preferences.`, error);
      return fallback;
    }
  }, [raw, fallback, key]);
  const setValue = useCallback((nextValue: T) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(nextValue));
      window.dispatchEvent(new Event("dnx-storage"));
    } catch (error) {
      console.error(`Could not save ${key} preferences.`, error);
    }
  }, [key]);
  return [value, setValue];
}
const groupNames = ["Overview", "Research", "Manual Data", "Tools", "My workspace", "Preferences"];

function Logo() {
  return <div className="brand-lockup">
    <div className="brand-mark"><span>D</span><span>N</span><span>X</span></div>
    <div><div className="brand-name">DNX <b>INDICATES</b></div><div className="brand-tagline">Every Dividend. Every Opportunity. One Platform.</div></div>
  </div>;
}

function DemoTag({ subtle = false }: { subtle?: boolean }) {
  return <span className={`demo-tag${subtle ? " demo-tag-subtle" : ""}`}><span />DEMO DATA</span>;
}

function DashboardApp({ section, selectedSymbol }: { section: string; selectedSymbol?: string }) {
  const activeSection = navigation.some((item) => item.key === section) ? section as SectionKey : "dashboard";
  const [theme, setTheme] = useLocalValue<Theme>("dnx-theme", "dark");
  const [companyList, setCompanyList] = useState(companies);
  const [autoDividendState, setAutoDividendState] = useState<AutoDividendState>({ configured: false, events: [], lastSyncedAt: null });
  const [companyLoadError, setCompanyLoadError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [watchlist, setWatchlist] = useLocalValue<string[]>("dnx-watchlist", []);
  const [holdings, setHoldings] = useLocalValue<Holding[]>("dnx-holdings", []);
  const [profile, setProfile] = useLocalValue<Profile>("dnx-profile", defaultProfile);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    let cancelled = false;
    async function loadCompanies() {
      try {
        const response = await fetch("/api/owner/data", { cache: "no-store" });
        if (!response.ok) throw new Error(`Company data request failed (${response.status}).`);
        const result = await response.json() as { companies: DividendCompany[] };
        if (!cancelled) {
          setCompanyList(result.companies);
          setCompanyLoadError("");
        }
      } catch (error) {
        console.error("Could not load the saved company data.", error);
        if (!cancelled) setCompanyLoadError("Saved company data could not be loaded. Showing the bundled demo dataset.");
      }
    }
    void loadCompanies();
    const timer = window.setInterval(() => { void loadCompanies(); }, 60_000);
    window.addEventListener("focus", loadCompanies);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", loadCompanies);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAutoDividends() {
      try {
        const response = await fetch("/api/dividends/upcoming", { cache: "no-store" });
        if (!response.ok) throw new Error(`Automatic dividend request failed (${response.status}).`);
        const result = await response.json() as AutoDividendState;
        if (!cancelled) setAutoDividendState(result);
      } catch (error) {
        console.error("Could not load automatically synchronized dividends.", error);
      }
    }
    void loadAutoDividends();
    const timer = window.setInterval(() => { void loadAutoDividends(); }, 5 * 60_000);
    window.addEventListener("focus", loadAutoDividends);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", loadAutoDividends);
    };
  }, []);
  const visibleNav = navigation.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()));
  const pageTitle = section === "company-detail"
    ? companyList.find((company) => company.symbol === selectedSymbol)?.name ?? "Company Analysis"
    : navigation.find((item) => item.key === activeSection)?.label ?? "Dashboard";

  return <CompaniesContext.Provider value={{ companies: companyList, setCompanies: setCompanyList }}><AutoDividendContext.Provider value={autoDividendState}><div className="app-frame">
    {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar${mobileOpen ? " sidebar-open" : ""}`}>
      <div className="sidebar-brand"><Link href="/" onClick={() => setMobileOpen(false)}><Logo /></Link><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-switch"><span className="workspace-icon">D</span><span><b>DNX Research</b><small>Personal workspace</small></span><ChevronDown size={14} /></div>
      <div className="nav-scroll">
        {groupNames.map((group) => {
          const items = visibleNav.filter((item) => item.group === group);
          if (!items.length) return null;
          return <div className="nav-group" key={group}><div className="nav-caption">{group}</div>{items.map(({ key, label, icon: Icon }) =>
            <Link key={key} href={key === "dashboard" ? "/" : key === "owner" ? "/developer/login" : `/${key}`} onClick={() => setMobileOpen(false)} className={`nav-link${activeSection === key ? " active" : ""}`}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{key === "dividend-calendar" && <span className="nav-count">8</span>}
            </Link>)}</div>;
        })}
        {!visibleNav.length && <div className="empty-sidebar">No matching sections</div>}
      </div>
      <div className="sidebar-bottom">
        <div className="pro-card"><div className="pro-icon"><Sparkles size={15} /></div><b>Smarter income insights</b><p>Explore dividend opportunities across the market.</p><Link href="/dividend-screener">Open screener <ArrowUpRight size={13} /></Link></div>
        <Link href="/settings" className="profile-row" aria-label="Open profile settings"><div className="avatar">{profile.name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U"}</div><div><b>{profile.name || "Your profile"}</b><small>{profile.email || "Add your email"} · Edit profile</small></div><MoreHorizontal size={17} className="profile-more" /></Link>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={19} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={13} /><b>{pageTitle}</b></div></div>
        <div className="topbar-actions"><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pages..." /><kbd>⌘ K</kbd></label><div className="market-open demo-mode-status" title="Market prices are demo data; manual dividend entries are not independently verified"><span />Demo mode</div><button className="icon-button top-icon" aria-label="Notifications"><Bell size={18} /><i /></button><button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button></div>
      </header>
      <div className="page-content">
        {companyLoadError && <div className="inline-error" role="status">{companyLoadError}</div>}
        <Routes section={section} selectedSymbol={selectedSymbol} theme={theme} setTheme={setTheme}
          watchlist={watchlist} setWatchlist={setWatchlist} holdings={holdings} setHoldings={setHoldings}
          profile={profile} setProfile={setProfile} />
        <footer className="page-footer"><span>© 2026 DNX INDICATES</span><span id="disclaimer"><ShieldCheck size={13} /> Demo information for illustration only</span><a href="#disclaimer">Data disclaimer</a></footer>
      </div>
    </main>
  </div></AutoDividendContext.Provider></CompaniesContext.Provider>;
}

function Routes(props: {
  section: string; selectedSymbol?: string; theme: Theme; setTheme: (theme: Theme) => void;
  watchlist: string[]; setWatchlist: (symbols: string[]) => void;
  holdings: Holding[]; setHoldings: (items: Holding[]) => void;
  profile: Profile; setProfile: (profile: Profile) => void;
}) {
  switch (props.section) {
    case "dashboard": return <Dashboard profile={props.profile} />;
    case "dividend-calendar": return <CalendarPage />;
    case "dividend-screener": return <CompaniesPage screener />;
    case "all-companies": return <CompaniesPage />;
    case "company-analysis": return <AnalysisPage symbol={props.selectedSymbol} />;
    case "company-detail": return <AnalysisPage symbol={props.selectedSymbol} />;
    case "dividend-calculator": return <CalculatorPage />;
    case "compare-companies": return <ComparePage />;
    case "my-portfolio": return <PortfolioPage holdings={props.holdings} setHoldings={props.setHoldings} />;
    case "watchlist": return <WatchlistPage symbols={props.watchlist} setSymbols={props.setWatchlist} />;
    case "corporate-actions": return <CorporateActionsPage />;
    case "manual-dividends": return <ManualDividendsPage />;
    case "reports": return <ReportsPage />;
    case "settings": return <SettingsPage theme={props.theme} setTheme={props.setTheme} profile={props.profile} setProfile={props.setProfile} />;
    case "owner": return <OwnerPage />;
    default: return <Dashboard profile={props.profile} />;
  }
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}

function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}

function MetricCard({ label, value, note, icon: Icon, tone = "green", trend }: {
  label: string; value: string; note: string; icon: typeof Activity; tone?: string; trend?: string;
}) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} /></span></div><div className="metric-value">{value}</div><div className="metric-note">{trend && <b className={tone === "red" ? "negative" : "positive"}>{trend}</b>}<span>{note}</span></div></div>;
}

function MarketCard({ index }: { index: typeof marketIndices[number] }) {
  const color = index.up ? "#80d9a3" : "#f18486";
  const chartData = index.points.map((value, i) => ({ i, value }));
  return <div className="market-card"><div className="market-card-top"><div className="market-card-heading"><span>{index.name}</span><DemoTag subtle /></div><span className="market-card-icon"><Activity size={15} /></span></div><div className="market-price">{index.value}</div><div className="market-card-bottom"><span className={index.up ? "positive" : "negative"}>{index.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{index.change}</span><span className="market-label">Today</span></div><div className="sparkline"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id={`fill-${index.name.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.19} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.7} fill={`url(#fill-${index.name.replace(/\s/g, "")})`} /></AreaChart></ResponsiveContainer></div></div>;
}

function Dashboard({ profile }: { profile: Profile }) {
  const todayKey = useTodayKey();
  const clockKey = useIndiaClockKey();
  const availableCompanies = useCompanies();
  const autoDividendState = useAutoDividends();
  const dividendCompanies = autoDividendState.configured ? autoDividendState.events : availableCompanies;
  const firstName = profile.name.trim().split(/\s+/)[0] || "there";
  const indiaHour = Number(clockKey.slice(11, 13));
  const greeting = !clockKey ? "Welcome" : indiaHour < 12 ? "Good morning" : indiaHour < 17 ? "Good afternoon" : "Good evening";
  const localToday = todayKey ? new Date(`${todayKey}T12:00:00+05:30`) : null;
  const eyebrow = localToday ? new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(localToday).toUpperCase() : "UPDATING DATE";
  const weekday = localToday?.toLocaleString("en-US", { weekday: "short", timeZone: "Asia/Kolkata" });
  const indiaMinute = Number(clockKey.slice(14, 16));
  const marketIsOpen = Boolean(clockKey) && weekday !== "Sun" && weekday !== "Sat"
    && (indiaHour > 9 || (indiaHour === 9 && indiaMinute >= 15))
    && (indiaHour < 15 || (indiaHour === 15 && indiaMinute < 30));
  const exDateOffsets = dividendCompanies.map((company) => ({
    company,
    days: dayOffsetFromToday(company.exDate, todayKey),
  }));
  const upcomingCount = exDateOffsets.filter(({ days }) => days !== null && days >= 0 && days <= 30).length;
  const exDatesToday = exDateOffsets.filter(({ days }) => days === 0).length;
  const exDatesThisWeek = exDateOffsets.filter(({ days }) => days !== null && days >= 0 && days <= 6).length;
  const highestDividend = dividendCompanies.filter((company) => company.dividend !== null)
    .sort((a, b) => (b.dividend ?? 0) - (a.dividend ?? 0))[0];
  const highestYield = dividendCompanies.filter((company) => company.yield !== null)
    .sort((a, b) => (b.yield ?? 0) - (a.yield ?? 0))[0];
  const upcomingCompanies = exDateOffsets
    .filter(({ days }) => days !== null && days >= 0)
    .sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity))
    .slice(0, 6)
    .map(({ company }) => company);
  return <><PageHeading eyebrow={eyebrow} title={`${greeting}, ${firstName}`} description="Your dividend intelligence, all in one place." action={<button className="button button-secondary" onClick={() => downloadCsv("dnx-overview-demo.csv", ["Market index", "Sample value", "Change"], marketIndices.map((item) => [item.name, item.value, item.change]))}><Download size={15} /> Export overview</button>} />
    <div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div><b>{autoDividendState.configured ? "Automatic dividend feed connected" : "Automatic dividend feed not configured"}</b><span> {autoDividendState.configured ? "Upcoming dividend events below are loaded from the synchronized provider feed. Market prices and historical charts remain sample data." : "Upcoming dividend figures currently fall back to the saved demo/CSV dataset. Connect PostgreSQL and an authorized dividend feed to publish automatic updates."}</span></div><span className="status-pill">{autoDividendState.configured ? "AUTO SYNC" : "DEMO DATA"}</span></div>
    <Panel title="Manual Dividends" subtitle="A separate public area for dividend information entered by the DNX team." action={<Link className="panel-link" href="/manual-dividends">Open manual dividends <ArrowUpRight size={13} /></Link>}>
      <div className="announcement-item"><div className="announcement-icon amber"><Pencil size={16} /></div><div className="announcement-copy"><b>Manually maintained dividend records</b><span>View dividend per share, announcement date, ex-date, record date, payment date and provided source links.</span><small>Manual entries are clearly labelled and should be verified with the company or exchange.</small></div><Link className="panel-link" href="/manual-dividends">View records <ArrowUpRight size={13} /></Link></div>
    </Panel>
    <div className="section-title-row"><div><h2>Market overview</h2><p>Indian indices at a glance</p></div><div className="market-status"><span />Indicative session <b>{marketIsOpen ? "Open" : "Closed"}</b><span className="divider">·</span><span className="market-time">Weekdays 09:15–15:30 IST · DEMO</span></div></div>
    <div className="market-grid">{marketIndices.map((index) => <MarketCard key={index.name} index={index} />)}</div>
    <div className="section-title-row stats-title"><div><h2>Dividend snapshot</h2><p>Upcoming opportunities in your watchlist universe</p></div><Link className="text-link" href="/dividend-screener">View screener <ArrowUpRight size={14} /></Link></div>
    <div className="metric-grid">
      <MetricCard label="Upcoming dividends" value={String(upcomingCount).padStart(2, "0")} note="Next 30 days · based on available dates" icon={CalendarDays} tone="green" />
      <MetricCard label="Ex-dates today" value={String(exDatesToday).padStart(2, "0")} note="Based on available dates" icon={Zap} tone="amber" />
      <MetricCard label="Ex-dates this week" value={String(exDatesThisWeek).padStart(2, "0")} note="Today and next 6 days" icon={Activity} tone="blue" />
      <MetricCard label="Highest dividend / share" value={currency(highestDividend?.dividend ?? null)} note={highestDividend ? `${highestDividend.name} · available record` : "No amount available"} icon={CircleDollarSign} tone="purple" />
      <MetricCard label="Highest dividend yield" value={highestYield?.yield === null || !highestYield ? "—" : `${highestYield.yield.toFixed(2)}%`} note={highestYield?.name ?? "No yield available"} icon={TrendingUp} tone="rose" />
    </div>
    <div className="content-grid dashboard-row"><Panel title="Upcoming dividends" subtitle={autoDividendState.configured ? `Authorized feed · last sync ${autoDividendState.lastSyncedAt ? formatManualUpdateDate(autoDividendState.lastSyncedAt) : "not yet completed"}` : "Demo/CSV records · automatic feed not configured"} action={<Link className="panel-link" href="/dividend-calendar">Full calendar <ArrowUpRight size={13} /></Link>} className="table-panel"><DividendTable rows={upcomingCompanies} /></Panel>
      <Panel title="Dividend calendar" subtitle={`${localToday ? localToday.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) : "Current month"} · all available sources`} action={<Link className="panel-link" href="/dividend-calendar">Open calendar <ArrowUpRight size={13} /></Link>}><MiniCalendar /></Panel></div>
    <div className="content-grid lower-grid"><Panel title="Dividend history" subtitle="Illustrative annual dividend distribution" action={<button className="select-button">8 years <ChevronDown size={13} /></button>}><DividendHistoryChart /></Panel>
      <Panel title="Sector distribution" subtitle="Illustrative share of dividend universe"><SectorChart /></Panel>
      <Panel title="Latest announcements" subtitle="Announcement date shown when provided"><Announcements /></Panel></div>
    <div className="content-grid final-grid"><Panel title="Monthly dividend distribution" subtitle="Sample dividend activity through the year"><MonthlyChart /></Panel><Panel title="Top dividend companies" subtitle="Ranked by available yield · entered or demo values" action={<Link className="panel-link" href="/dividend-screener">See all <ArrowUpRight size={13} /></Link>}><TopCompanies /></Panel></div>
  </>;
}

function DividendTable({ rows }: { rows: DividendCompany[] }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"company" | "dividend" | "exDate">("exDate");
  const [ascending, setAscending] = useState(true);
  const visibleRows = useMemo(() => rows
    .filter((company) => `${company.name} ${company.symbol}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const comparison = sortBy === "company" ? a.name.localeCompare(b.name)
        : sortBy === "dividend" ? (a.dividend ?? -Infinity) - (b.dividend ?? -Infinity)
        : Date.parse(a.exDate) - Date.parse(b.exDate);
      return ascending ? comparison : -comparison;
    }), [rows, query, sortBy, ascending]);
  return <>
    <div className="dividend-table-tools"><label className="filter-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter companies" /></label><label>Sort by<select value={sortBy} onChange={(event) => setSortBy(event.target.value as "company" | "dividend" | "exDate")}><option value="exDate">Ex-date</option><option value="dividend">Dividend amount</option><option value="company">Company name</option></select></label><button className="icon-button" aria-label="Toggle table sort direction" onClick={() => setAscending(!ascending)}>{ascending ? <ArrowDown size={14} /> : <ArrowUpRight size={14} />}</button></div>
    <div className="table-scroll"><table className="data-table"><thead><tr><th>Company</th><th>Exchange symbol</th><th>Dividend / share</th><th>Type</th><th>Announced</th><th>Ex-date</th><th>Record date</th><th>Payment date</th></tr></thead><tbody>{visibleRows.map((company) => <tr key={company.eventId ?? `${company.symbol}-${company.exDate}`}><td><Link className="company-cell" href={`/company-analysis/${company.symbol}`}><span className="company-logo">{company.symbol.slice(0, 2)}</span><b>{company.name}</b></Link><CompanyDataSource company={company} subtle /></td><td><span className="symbol">{companyExchangeSymbol(company)}</span></td><td className="amount-cell">{currency(company.dividend)}</td><td><span className={`type-pill ${company.type.toLowerCase()}`}>{company.type}</span></td><td>{company.announcement || "—"}</td><td><b className="date-emphasis">{company.exDate || "—"}</b></td><td>{company.recordDate || "—"}</td><td>{company.paymentDate || "—"}</td></tr>)}</tbody></table>{!visibleRows.length && <div className="table-empty">No dividend events match your filter.</div>}</div>
  </>;
}

function DividendHistoryChart() {
  return <div className="chart-wrap chart-history"><ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={dividendHistory} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickFormatter={(value: number) => `₹${value}k`} /><Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)" }} formatter={(value) => [`₹${value}k`, "Dividend"]} /><Line type="monotone" dataKey="income" stroke="#82d8a4" strokeWidth={2.2} dot={{ r: 3, fill: "#82d8a4", stroke: "var(--panel)", strokeWidth: 2 }} activeDot={{ r: 5 }} /></RechartsLineChart></ResponsiveContainer></div>;
}

function SectorChart() {
  return <div className="sector-chart"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><RechartsPieChart><Pie data={sectorDistribution} dataKey="value" nameKey="name" innerRadius={56} outerRadius={76} paddingAngle={4} stroke="none">{sectorDistribution.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)" }} formatter={(value) => [`${value}%`, "Share"]} /></RechartsPieChart></ResponsiveContainer><div className="donut-center"><b>100%</b><span>DEMO</span></div></div><div className="legend-list">{sectorDistribution.map((sector) => <div key={sector.name}><span><i style={{ background: sector.color }} />{sector.name}</span><b>{sector.value}%</b></div>)}</div></div>;
}

function MonthlyChart() {
  return <div className="chart-wrap chart-monthly"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyDistribution} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickFormatter={(value: number) => `₹${value}k`} /><Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)" }} formatter={(value) => [`₹${value}k`, "Dividend"]} /><Bar dataKey="amount" fill="#82d8a4" radius={[4, 4, 0, 0]} maxBarSize={24} /></BarChart></ResponsiveContainer></div>;
}

function Announcements() {
  const availableCompanies = useCompanies();
  const tones = ["mint", "blue", "amber"];
  const latest = [...availableCompanies]
    .sort((a, b) => (parseDemoDate(b.announcement || b.exDate)?.getTime() ?? 0) - (parseDemoDate(a.announcement || a.exDate)?.getTime() ?? 0))
    .slice(0, 3);
  return <div className="announcement-list">{latest.map((company, index) => <div className="announcement-item" key={company.symbol}><div className={`announcement-icon ${tones[index % tones.length]}`}>{company.symbol.slice(0, 2)}</div><div className="announcement-copy"><b>{company.name}</b><span>{company.type} dividend</span><small>{company.announcement || `Ex-date ${company.exDate || "not provided"}`}</small></div><div className="announcement-amount">{currency(company.dividend)} / share <CompanyDataSource company={company} subtle /></div></div>)}</div>;
}

function TopCompanies() {
  const availableCompanies = useCompanies();
  const rankedCompanies = [...availableCompanies].filter((company) => company.yield !== null)
    .sort((a, b) => (b.yield ?? 0) - (a.yield ?? 0)).slice(0, 4);
  return <div className="top-company-list">{rankedCompanies.length ? rankedCompanies.map((company, index) => <Link className="top-company" key={company.symbol} href={`/company-analysis/${company.symbol}`}><span className="rank-number">0{index + 1}</span><span className="company-logo">{company.symbol.slice(0, 2)}</span><span className="top-company-name"><b>{company.name}</b><small>{company.exchangeSymbol ?? company.symbol}</small></span><span className="yield-value">{company.yield?.toFixed(2)}%</span><ArrowUpRight size={14} className="row-arrow" /></Link>) : <div className="table-empty">Yield data is not available.</div>}</div>;
}

function MiniCalendar() {
  const todayKey = useTodayKey();
  const autoDividendState = useAutoDividends();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const viewKey = selectedMonth ?? todayKey.slice(0, 7);
  const viewDate = monthDate(viewKey);
  const year = viewDate?.getFullYear() ?? 0;
  const month = viewDate?.getMonth() ?? 0;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const availableCompanies = useCompanies();
  const calendarCompanies = autoDividendState.configured ? autoDividendState.events : availableCompanies;
  const eventDays = new Set(calendarCompanies.flatMap((company) => {
    const date = parseDemoDate(company.exDate);
    return date && monthKey(date) === viewKey ? [date.getDate()] : [];
  }));
  const todayDate = todayKey ? Number(todayKey.slice(-2)) : -1;
  if (!viewDate) return <div className="mini-calendar"><div className="calendar-month"><b>Loading calendar…</b><DemoTag subtle /></div></div>;
  return <div className="mini-calendar"><div className="calendar-month"><div><b>{viewDate.toLocaleString("en-US", { month: "long", year: "numeric" })}</b><span className="status-pill">ALL SOURCES</span></div><span><button aria-label="Previous month" onClick={() => setSelectedMonth(moveMonth(viewKey, -1))}><ChevronLeft size={15} /></button><button aria-label="Next month" onClick={() => setSelectedMonth(moveMonth(viewKey, 1))}><ChevronRight size={15} /></button></span></div><div className="calendar-grid calendar-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: firstDay }, (_, i) => <span className="calendar-empty" key={`e-${i}`} />)}{Array.from({ length: daysInMonth }, (_, i) => { const day = i + 1; return <span key={day} className={`calendar-day${eventDays.has(day) ? " has-event" : ""}${day === todayDate && viewKey === todayKey.slice(0, 7) ? " today" : ""}`} title={eventDays.has(day) ? "Dividend event" : undefined}>{day}{eventDays.has(day) && <i />}</span>; })}</div><div className="calendar-legend"><span><i />Dividend entry</span><span>{eventDays.size} dates · all sources</span></div></div>;
}

function CalendarPage() {
  const todayKey = useTodayKey();
  const availableCompanies = useCompanies();
  const autoDividendState = useAutoDividends();
  const calendarCompanies = autoDividendState.configured ? autoDividendState.events : availableCompanies;
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const viewKey = selectedMonth ?? todayKey.slice(0, 7);
  const viewDate = monthDate(viewKey);
  const year = viewDate?.getFullYear() ?? 0;
  const month = viewDate?.getMonth() ?? 0;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEvents = calendarCompanies.flatMap((company) => {
    const date = parseDemoDate(company.exDate);
    return date && monthKey(date) === viewKey ? [{ company, date }] : [];
  });
  if (!viewDate) return <><PageHeading eyebrow="EVENT TRACKER" title="Dividend calendar" description="Stay ahead of upcoming ex-dates, record dates and payment dates." /><Panel title="Monthly calendar" subtitle="Loading current date…"><div className="owner-loading">Calendar is loading the current India date.</div></Panel></>;
  const eventsByDay = monthEvents.reduce((events, { company, date }) => {
    const day = date.getDate();
    events.set(day, [...(events.get(day) ?? []), company]);
    return events;
  }, new Map<number, DividendCompany[]>());
  const todayDate = todayKey ? Number(todayKey.slice(-2)) : -1;
  return <><PageHeading eyebrow="EVENT TRACKER" title="Dividend calendar" description="Stay ahead of upcoming ex-dates, record dates and payment dates." />
    <div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div>{autoDividendState.configured ? "Upcoming calendar entries are automatically synchronized from the configured dividend feed. Check the source disclosure before making investment decisions." : "Automatic synchronization is not configured yet. This calendar currently shows saved demo and CSV records; manual entries remain separate and unverified."}</div><span className="status-pill">{autoDividendState.configured ? "AUTO SYNC" : "SOURCES LABELLED"}</span></div>
    <div className="calendar-page-layout"><Panel title="Monthly calendar" subtitle={autoDividendState.configured ? "Automatically synchronized upcoming dividend events" : "Saved demo and exchange CSV dividend events"} action={<button className="button button-secondary button-small" onClick={() => downloadCsv("dnx-calendar-entries.csv", ["Company", "Exchange symbol", "Dividend per share", "Announcement date", "Ex-date", "Record date", "Payment date"], calendarCompanies.map((company) => [company.name, companyExchangeSymbol(company), company.dividend, company.announcement, company.exDate, company.recordDate, company.paymentDate]))}><Download size={13} /> Export</button>} className="large-calendar-panel"><div className="calendar-month calendar-month-large"><div><b>{viewDate.toLocaleString("en-US", { month: "long", year: "numeric" })}</b><span className="status-pill">ALL SOURCES</span></div><span><button className="icon-button" aria-label="Previous month" onClick={() => setSelectedMonth(moveMonth(viewKey, -1))}><ChevronLeft size={17} /></button><button className="icon-button" aria-label="Next month" onClick={() => setSelectedMonth(moveMonth(viewKey, 1))}><ChevronRight size={17} /></button></span></div><div className="calendar-grid calendar-weekdays">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid calendar-grid-large">{Array.from({ length: firstDay }, (_, i) => <div key={`blank-${i}`} className="large-calendar-day muted" />)}{Array.from({ length: daysInMonth }, (_, i) => { const day = i + 1; const dayCompanies = eventsByDay.get(day) ?? []; return <div key={day} className={`large-calendar-day${dayCompanies.length ? " event-day" : ""}${day === todayDate && viewKey === todayKey.slice(0, 7) ? " today" : ""}`}><span>{day}</span>{dayCompanies.map((company) => <small key={company.eventId ?? `${company.symbol}-${company.exDate}`}>{company.name}<CompanyDataSource company={company} subtle /></small>)}</div>; })}</div><div className="calendar-legend"><span><i />Dividend event</span><span>{monthEvents.length} entries · all sources</span></div></Panel>
      <Panel title="Upcoming events" subtitle={`${viewDate.toLocaleString("en-US", { month: "long" })} · all available sources`}><div className="event-list">{monthEvents.length ? monthEvents.sort((a, b) => a.date.getTime() - b.date.getTime()).map(({ company, date }) => <div className="event-item" key={company.eventId ?? `${company.symbol}-${company.exDate}`}><div className="event-date"><b>{String(date.getDate()).padStart(2, "0")}</b><span>{date.toLocaleString("en-US", { month: "short" }).toUpperCase()}</span></div><div><Link href={`/company-analysis/${company.symbol}`}><b>{company.name}</b></Link><small>{companyExchangeSymbol(company)} · {company.type} dividend</small></div><strong>{currency(company.dividend)}</strong></div>) : <div className="table-empty">No dividend events for this month.</div>}</div></Panel></div></>;
}

function CompaniesPage({ screener = false }: { screener?: boolean }) {
  const availableCompanies = useCompanies();
  const yieldSource = availableCompanies.find((company) => company.yieldAsOf && company.yieldPriceExchange);
  const yieldAsOf = yieldSource?.yieldAsOf;
  const yieldPeriodStart = yieldSource?.yieldPeriodStart ?? yieldAsOf;
  const yieldPriceExchange = yieldSource?.yieldPriceExchange;
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All sectors");
  const [type, setType] = useState("All types");
  const [minYield, setMinYield] = useState("");
  const [minDividend, setMinDividend] = useState("");
  const [sortBy, setSortBy] = useState<"yield" | "dividend">("yield");
  const [direction, setDirection] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const sectors = ["All sectors", ...Array.from(new Set(availableCompanies.map((company) => company.sector)))];
  const rows = useMemo(() => availableCompanies.filter((company) =>
    `${company.name} ${company.symbol} ${company.exchangeSymbol ?? ""}`.toLowerCase().includes(query.toLowerCase())
    && (sector === "All sectors" || company.sector === sector)
    && (type === "All types" || company.type === type)
    && (!minYield || (company.yield !== null && company.yield >= Number(minYield)))
    && (!minDividend || (company.dividend !== null && company.dividend >= Number(minDividend)))
  ).sort((a, b) => {
    const left = a[sortBy];
    const right = b[sortBy];
    if (left === null) return 1;
    if (right === null) return -1;
    return (direction === "desc" ? -1 : 1) * (left - right);
  }), [availableCompanies, query, sector, type, minYield, minDividend, sortBy, direction]);
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <><PageHeading eyebrow={screener ? "DISCOVER INCOME" : "LISTED UNIVERSE"} title={screener ? "Dividend screener" : "All companies"} description={screener ? "Find dividend opportunities using your preferred income criteria." : "Search Indian listed companies with dividend records in the imported period."} action={<span className="status-pill">MIXED SOURCES</span>} />
    <div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div>
      Exchange imports show only fields present in official exports. Missing market capitalization, yield, and payout data remain unavailable, not zero. Bundled records are labelled demo.
      {yieldAsOf && yieldPeriodStart && yieldPriceExchange && <> Trailing yields use dividend ex-dates from {formatManualUpdateDate(yieldPeriodStart)} through {formatManualUpdateDate(yieldAsOf)} and official {yieldPriceExchange} closing prices; values are not live. BSE closes are used as cross-listed price proxies for NSE listings.</>}
    </div></div>
    <Panel title={screener ? "Screen companies" : "Company directory"} subtitle={`${rows.length} records · ${pageCount} pages`} action={<button className="button button-secondary button-small" onClick={() => { setQuery(""); setSector("All sectors"); setType("All types"); setMinYield(""); setMinDividend(""); }}><X size={13} /> Clear filters</button>}>
      <div className="filter-toolbar"><label className="filter-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by company or exchange symbol" /></label><label className="filter-control"><span>Min yield</span><input type="number" min="0" max="100" step="0.1" value={minYield} onChange={(event) => setMinYield(event.target.value)} placeholder="0.0%" /></label><label className="filter-control"><span>Min dividend / share</span><input type="number" min="0" step="0.01" value={minDividend} onChange={(event) => setMinDividend(event.target.value)} placeholder="₹0.00" /></label><label className="filter-control"><span>Sector</span><select value={sector} onChange={(event) => setSector(event.target.value)}>{sectors.map((item) => <option key={item}>{item}</option>)}</select></label><label className="filter-control"><span>Dividend type</span><select value={type} onChange={(event) => setType(event.target.value)}>{["All types", "Interim", "Final", "Special", "Dividend"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="filter-control sort-control"><span>Sort by</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as "yield" | "dividend")}><option value="yield">Dividend yield</option><option value="dividend">Dividend amount</option></select><button className="sort-direction" onClick={() => setDirection(direction === "desc" ? "asc" : "desc")} aria-label="Toggle sort direction">{direction === "desc" ? <ArrowDown size={14} /> : <ArrowUpRight size={14} />}</button></label></div>
      {rows.length ? <><div className="table-scroll"><table className="data-table company-directory"><thead><tr><th>Company</th><th>Exchange symbol</th><th>Sector</th><th>Market cap</th><th>Dividend yield</th><th>Latest dividend</th><th>Type</th><th /></tr></thead><tbody>{visibleRows.map((company) => <tr key={company.eventId ?? `${company.symbol}-${company.exDate}`}><td><Link className="company-cell" href={`/company-analysis/${company.symbol}`}><span className="company-logo">{company.symbol.slice(0, 2)}</span><b>{company.name}</b></Link><CompanyDataSource company={company} subtle /></td><td><span className="symbol">{companyExchangeSymbol(company)}</span></td><td>{company.sector}</td><td>{company.marketCap === null ? "—" : `${compactCurrency(company.marketCap)} Cr`}</td><td><span className="yield-value">{company.yield === null ? "—" : `${company.yield.toFixed(2)}%`}</span></td><td className="amount-cell">{currency(company.dividend)}</td><td><span className={`type-pill ${company.type.toLowerCase()}`}>{company.type}</span></td><td><Link className="icon-button row-open" href={`/company-analysis/${company.symbol}`} aria-label={`View ${company.name}`}><ArrowUpRight size={15} /></Link></td></tr>)}</tbody></table></div><div className="developer-edit-actions"><span>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, rows.length)} of {rows.length}</span><button className="button button-secondary button-small" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><button className="button button-secondary button-small" disabled={currentPage >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></> : <div className="empty-state"><Search size={20} /><b>No companies match those filters</b><span>Try adjusting your search or dividend criteria.</span></div>}
    </Panel></>;
}

function AnalysisPage({ symbol }: { symbol?: string }) {
  const router = useRouter();
  const availableCompanies = useCompanies();
  const [selected, setSelected] = useState(symbol ?? companies[0].symbol);
  const company = availableCompanies.find((item) => item.symbol === (symbol ?? selected)) ?? availableCompanies[0] ?? companies[0];
  const companyHistory = dividendHistory.map((item, index) => ({ ...item, income: Math.round(item.income * (0.6 + (availableCompanies.indexOf(company) + 1) * 0.045) + index * 3) }));
  const companyTrend = companyHistory.map((item, index) => ({
    year: item.year,
    yield: company.yield === null ? null : Number((company.yield * (0.72 + index * 0.04)).toFixed(2)),
  }));
  return <><PageHeading eyebrow="COMPANY INTELLIGENCE" title={symbol ? `${company.name} analysis` : "Company analysis"} description="Explore dividend profile, illustrative financial trends and corporate actions." action={<DemoTag />} />
    <div className="company-select-row"><label className="company-select"><Search size={15} /><select value={company.symbol} onChange={(event) => symbol ? router.push(`/company-analysis/${event.target.value}`) : setSelected(event.target.value)}>{availableCompanies.map((item) => <option value={item.symbol} key={item.symbol}>{item.name} ({companyExchangeSymbol(item)})</option>)}</select><ChevronDown size={15} /></label><span className="detail-sector">{company.sector}</span><span className="detail-symbol">{companyExchangeSymbol(company)} · {company.sourceExchange ?? "NSE demo"}</span></div>
    <ManualUpdateNote company={company} />
    <OfficialSourceNote company={company} />
    <YieldSourceNote company={company} />
    <div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div>Exchange-imported dividend records are attributed below. Historical charts and illustrative actions are sample values; manual entries are unverified and this page is not investment advice.</div><DemoTag /></div>
    <div className="company-summary"><div className="company-summary-main"><div className="company-logo company-logo-large">{(company.exchangeSymbol ?? company.symbol).slice(0, 2)}</div><div><h2>{company.name}</h2><span>{companyExchangeSymbol(company)} <i /> {company.sector} <i /> {company.sourceExchange ? `${company.sourceExchange} CSV import` : "NSE demo"}</span></div><Link className="button button-secondary button-small" href="/dividend-screener">View in screener <ArrowUpRight size={13} /></Link></div><div className="company-metrics"><div><small>Dividend yield</small><b className="yield-value">{company.yield === null ? "—" : `${company.yield.toFixed(2)}%`}</b></div><div><small>Latest dividend / share</small><b>{currency(company.dividend)}</b></div><div><small>Payout ratio</small><b>{company.payout === null ? "—" : `${company.payout}%`}</b></div><div><small>Market capitalization</small><b>{company.marketCap === null ? "—" : `${compactCurrency(company.marketCap)} Cr`}</b></div></div></div>
    <div className="analysis-grid"><Panel title="Dividend history" subtitle="Illustrative annual dividend per share · DEMO DATA" action={<button className="select-button">Annual <ChevronDown size={13} /></button>}><div className="chart-wrap chart-analysis"><ResponsiveContainer width="100%" height="100%"><BarChart data={companyHistory} margin={{ top: 12, right: 10, bottom: 0, left: -15 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} /><Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)" }} /><Bar dataKey="income" name="Dividend / share (₹)" fill="#82d8a4" radius={[5, 5, 0, 0]} maxBarSize={36} /></BarChart></ResponsiveContainer></div></Panel><Panel title="Company overview" subtitle="Source fields and availability"><div className="overview-list"><div><span>Company</span><b>{company.name}</b></div><div><span>Sector</span><b>{company.sector}</b></div><div><span>Dividend type</span><b>{company.type}</b></div><div><span>Dividend payout ratio</span><b>{company.payout === null ? "—" : `${company.payout}%`} <i className="info-dot">i</i></b></div><div><span>Announcement date</span><b>{company.announcement || "Not provided by source"}</b></div><div><span>Latest ex-date</span><b>{company.exDate || "—"}</b></div><div><span>Record date</span><b>{company.recordDate || "Not provided by source"}</b></div></div></Panel></div>
    <Panel title="Dividend yield trend" subtitle="Illustrative annual yield profile · DEMO DATA"><div className="chart-wrap chart-analysis"><ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={companyTrend} margin={{ top: 12, right: 10, bottom: 0, left: -15 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickFormatter={(value: number) => `${value}%`} /><Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)" }} formatter={(value) => [`${value}%`, "Dividend yield"]} /><Line type="monotone" dataKey="yield" stroke="#78a8ff" strokeWidth={2.2} dot={{ r: 3, fill: "#78a8ff", stroke: "var(--panel)", strokeWidth: 2 }} /></RechartsLineChart></ResponsiveContainer></div></Panel>
    <Panel title="Recent corporate actions" subtitle="Latest dividend entry and illustrative history"><div className="table-scroll"><table className="data-table"><thead><tr><th>Action</th><th>Announcement date</th><th>Ex-date</th><th>Details</th><th>Status</th></tr></thead><tbody><tr><td><span className="type-pill interim">{company.type} dividend</span></td><td>{company.announcement || "—"}</td><td>{company.exDate || "—"}</td><td>{currency(company.dividend)} per share</td><td><span className="status-pill">{company.manualUpdateAt ? "Manual · unverified" : company.sourceExchange ? `${company.sourceExchange} CSV` : "Sample · demo"}</span></td></tr><tr><td><span className="type-pill final">Final dividend</span></td><td>12 Jun 2026</td><td>28 Jun 2026</td><td>Illustrative previous action</td><td><span className="status-pill muted-status">Past · demo</span></td></tr></tbody></table></div></Panel>
  </>;
}

function CalculatorPage() {
  const availableCompanies = useCompanies();
  const defaultCompany = availableCompanies[0] ?? companies[0];
  const [companySymbol, setCompanySymbol] = useState(defaultCompany.symbol);
  const [shares, setShares] = useState("100");
  const [dividend, setDividend] = useState(defaultCompany.dividend?.toString() ?? "");
  const [price, setPrice] = useState("");
  const company = availableCompanies.find((item) => item.symbol === companySymbol) ?? defaultCompany;
  const quantity = Math.max(0, Number(shares) || 0);
  const perShare = Math.max(0, Number(dividend) || 0);
  const investment = quantity * Math.max(0, Number(price) || 0);
  const income = quantity * perShare;
  const hasDividendInput = dividend.trim() !== "" && Number.isFinite(Number(dividend));
  const yieldPercent = investment && hasDividendInput ? income / investment * 100 : 0;
  return <><PageHeading eyebrow="INCOME PLANNER" title="Dividend calculator" description="Estimate dividend income from a shareholding. Enter any values to model a scenario." action={<DemoTag />} /><div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div>Calculator outputs are estimates based only on the values you enter. They do not predict or guarantee actual dividend payments.</div><DemoTag /></div>
    <div className="calculator-layout"><Panel title="Your inputs" subtitle="Adjust values to explore a dividend scenario"><div className="calculator-fields"><label>Company<select value={companySymbol} onChange={(event) => { const found = availableCompanies.find((item) => item.symbol === event.target.value); setCompanySymbol(event.target.value); if (found) setDividend(found.dividend?.toString() ?? ""); }}>{availableCompanies.map((item) => <option key={item.symbol} value={item.symbol}>{item.name} ({companyExchangeSymbol(item)})</option>)}</select></label><label>Number of shares<input type="number" min="0" value={shares} onChange={(event) => setShares(event.target.value)} placeholder="e.g. 100" /></label><label>Dividend per share<input type="number" min="0" step="0.01" value={dividend} onChange={(event) => setDividend(event.target.value)} placeholder="Enter amount if not available" /></label><label>Purchase price per share <span className="optional-label">Optional</span><input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Enter purchase price to calculate yield" /></label></div><div className="calculator-note"><CircleHelp size={15} /><span>Enter the dividend amount announced per share. Tax, fees and future dividend changes are not included.</span></div></Panel>
      <div className="calculator-results"><div className="result-card result-primary"><span>Estimated dividend income</span><b>{hasDividendInput ? currency(income) : "—"}</b><small>{hasDividendInput ? `${quantity.toLocaleString("en-IN")} shares × ${currency(perShare)} / share` : "Enter an announced dividend amount to calculate"}</small></div><div className="result-card"><span>Total investment</span><b>{price && Number(price) > 0 ? currency(investment) : "—"}</b><small>{price && Number(price) > 0 ? "Shares × purchase price" : "Add purchase price to estimate"}</small></div><div className="result-card"><span>Estimated dividend yield</span><b>{investment && hasDividendInput ? `${yieldPercent.toFixed(2)}%` : "—"}</b><small>{investment && hasDividendInput ? "Estimated income ÷ investment" : "Requires a dividend amount and purchase price"}</small></div><Link href={`/company-analysis/${company.symbol}`} className="result-company"><span className="company-logo">{company.symbol.slice(0, 2)}</span><span><b>{company.name}</b><small>Selected listing · {companyExchangeSymbol(company)}</small></span><ArrowUpRight size={15} /></Link></div></div>
    <Panel title="How to use the calculator" subtitle="A transparent estimate, based on simple inputs"><div className="calculator-steps"><div><span>01</span><b>Choose a company</b><p>Use a sample value or type in a dividend amount for your own scenario.</p></div><div><span>02</span><b>Enter your share quantity</b><p>Provide the number of shares you own or plan to model.</p></div><div><span>03</span><b>Review your estimate</b><p>Add an optional purchase price to calculate investment value and indicative yield.</p></div></div></Panel>
  </>;
}

function ComparePage() {
  const availableCompanies = useCompanies();
  const [selected, setSelected] = useState<string[]>(companies.slice(0, 3).map((company) => company.symbol));
  const chosen = availableCompanies.filter((company) => selected.includes(company.symbol));
  function toggle(symbol: string) { setSelected((current) => current.includes(symbol) ? current.filter((value) => value !== symbol) : current.length < 4 ? [...current, symbol] : current); }
  return <><PageHeading eyebrow="SIDE-BY-SIDE RESEARCH" title="Compare companies" description="Compare dividend profiles and sample fundamentals across up to four companies." action={<DemoTag />} /><div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div>All financial values below are illustrative sample data and are not verified current market figures.</div><DemoTag /></div>
    <Panel title="Choose companies" subtitle="Select up to four sample companies"><div className="compare-picker">{availableCompanies.map((company) => <button key={company.symbol} className={`compare-choice${selected.includes(company.symbol) ? " selected" : ""}`} onClick={() => toggle(company.symbol)}><span className="company-logo">{company.symbol.slice(0, 2)}</span><span><b>{company.name}</b><small>{company.symbol} · {company.sector}</small></span><span className="choice-check">{selected.includes(company.symbol) && <Check size={13} />}</span></button>)}</div><div className="compare-hint">{selected.length} of 4 selected <span>Choose up to four companies</span></div></Panel>
    <Panel title="Dividend comparison" subtitle="Unavailable values are not estimated"><div className="table-scroll"><table className="data-table compare-table"><thead><tr><th>Metric</th>{chosen.map((company) => <th key={company.symbol}><span className="compare-head">{company.name}<small>{companyExchangeSymbol(company)}</small></span></th>)}</tr></thead><tbody><tr><td>Dividend yield</td>{chosen.map((company) => <td key={company.symbol} className="yield-value">{company.yield === null ? "—" : `${company.yield.toFixed(2)}%`}</td>)}</tr><tr><td>Dividend per share</td>{chosen.map((company) => <td key={company.symbol} className="amount-cell">{currency(company.dividend)}</td>)}</tr><tr><td>Dividend type</td>{chosen.map((company) => <td key={company.symbol}><span className={`type-pill ${company.type.toLowerCase()}`}>{company.type}</span></td>)}</tr><tr><td>Payout ratio</td>{chosen.map((company) => <td key={company.symbol}>{company.payout === null ? "—" : `${company.payout}%`}</td>)}</tr><tr><td>Sector</td>{chosen.map((company) => <td key={company.symbol}>{company.sector}</td>)}</tr><tr><td>Market cap</td>{chosen.map((company) => <td key={company.symbol}>{company.marketCap === null ? "—" : `${compactCurrency(company.marketCap)} Cr`}</td>)}</tr></tbody></table></div></Panel>
    <Panel title="Dividend history comparison" subtitle="Illustrative annual trend · ₹ / share"><div className="chart-wrap chart-analysis"><ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={dividendHistory} margin={{ top: 10, right: 12, bottom: 0, left: -14 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} /><Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)" }} />{chosen.map((company, index) => <Line key={company.symbol} type="monotone" dataKey="income" name={company.symbol} data={dividendHistory.map((item, i) => ({ ...item, income: Math.round(item.income * (0.5 + index * 0.22) + i * (index + 2)) }))} stroke={["#80d9a3", "#78a8ff", "#d0a6ff", "#f0bf72"][index]} strokeWidth={2} dot={false} />)}</RechartsLineChart></ResponsiveContainer></div></Panel>
  </>;
}

function PortfolioPage({ holdings, setHoldings }: { holdings: Holding[]; setHoldings: (items: Holding[]) => void }) {
  const availableCompanies = useCompanies();
  const [symbol, setSymbol] = useState(companies[0].symbol);
  const [quantity, setQuantity] = useState("10");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const positions = holdings.map((holding) => ({ ...holding, company: availableCompanies.find((item) => item.symbol === holding.symbol) ?? companies[0] }));
  const totalInvested = positions.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const hasMissingDividend = positions.some((item) => item.company.dividend === null);
  const expectedIncome = positions.reduce((sum, item) => sum + item.quantity * (item.company.dividend ?? 0), 0);
  function addHolding() {
    const qty = Number(quantity);
    const purchase = Number(price);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(purchase) || purchase <= 0) { setMessage("Enter a quantity and purchase price greater than zero."); return; }
    const existing = holdings.find((item) => item.symbol === symbol);
    setHoldings(existing ? holdings.map((item) => item.symbol === symbol ? { ...item, quantity: item.quantity + qty } : item) : [...holdings, { symbol, quantity: qty, price: purchase }]);
    setMessage(`${availableCompanies.find((item) => item.symbol === symbol)?.name ?? symbol} added to your portfolio.`);
  }
  return <><PageHeading eyebrow="YOUR INVESTMENTS" title="My portfolio" description="Track dividend income alongside your own share quantities and purchase prices." action={<DemoTag />} /><div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div>Holdings are saved in this browser only. Projections use demo or manually entered dividend values, are not independently verified, and are not guaranteed.</div><DemoTag /></div>
    <div className="metric-grid portfolio-metrics"><MetricCard label="Portfolio investment" value={compactCurrency(totalInvested)} note="Based on your purchase prices" icon={Wallet} tone="blue" /><MetricCard label="Estimated annual income" value={hasMissingDividend ? "—" : currency(expectedIncome)} note={hasMissingDividend ? "Some dividend amounts are unavailable" : "Based on available dividend amounts"} icon={CircleDollarSign} tone="green" /><MetricCard label="Portfolio positions" value={String(holdings.length).padStart(2, "0")} note="Stored in this browser" icon={PieChart} tone="purple" /></div>
    <div className="portfolio-layout"><Panel title="Add a holding" subtitle="Your portfolio remains private in local browser storage"><div className="holding-form"><label>Company<select value={symbol} onChange={(event) => setSymbol(event.target.value)}>{availableCompanies.map((company) => <option key={company.symbol} value={company.symbol}>{company.name} ({company.symbol})</option>)}</select></label><label>Quantity<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Purchase price / share<input type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="₹ purchase price" /></label><button className="button button-primary" onClick={addHolding}><Plus size={15} /> Add holding</button></div>{message && <div className={`form-message${message.includes("greater") ? " error" : ""}`}>{message}</div>}</Panel>
      <Panel title="Portfolio allocation" subtitle="By invested amount · DEMO DIVIDEND VALUES"><div className="allocation-list">{positions.length ? positions.map((item) => { const value = item.quantity * item.price; const allocation = totalInvested ? value / totalInvested * 100 : 0; return <div className="allocation-row" key={item.symbol}><div><span className="company-logo">{item.symbol.slice(0, 2)}</span><span><b>{item.company.name}</b><small>{item.company.sector}</small></span><strong>{allocation.toFixed(1)}%</strong></div><div className="allocation-track"><i style={{ width: `${allocation}%` }} /></div></div>; }) : <div className="empty-state"><PieChart size={20} /><b>Your allocation will appear here</b><span>Add a holding to see portfolio distribution.</span></div>}</div></Panel></div>
    <Panel title="Your holdings" subtitle={`${positions.length} positions · income shown only when dividend amounts are available`}><div className="table-scroll"><table className="data-table"><thead><tr><th>Company</th><th>Quantity</th><th>Purchase price</th><th>Investment value</th><th>Dividend / share</th><th>Estimated income</th><th /></tr></thead><tbody>{positions.map((item) => <tr key={item.symbol}><td><Link className="company-cell" href={`/company-analysis/${item.symbol}`}><span className="company-logo">{item.symbol.slice(0, 2)}</span><b>{item.company.name}</b></Link></td><td>{item.quantity.toLocaleString("en-IN")}</td><td>{currency(item.price)}</td><td>{currency(item.price * item.quantity)}</td><td>{currency(item.company.dividend)}</td><td className="amount-cell">{currency(item.company.dividend === null ? null : item.company.dividend * item.quantity)}</td><td><button className="icon-button remove-button" aria-label={`Remove ${item.company.name}`} onClick={() => setHoldings(holdings.filter((holding) => holding.symbol !== item.symbol))}><X size={15} /></button></td></tr>)}</tbody></table>{!positions.length && <div className="table-empty">No holdings yet. Add a company above to begin.</div>}</div></Panel>
  </>;
}

function WatchlistPage({ symbols, setSymbols }: { symbols: string[]; setSymbols: (symbols: string[]) => void }) {
  const availableCompanies = useCompanies();
  const [query, setQuery] = useState("");
  const [candidate, setCandidate] = useState(companies[0].symbol);
  const [message, setMessage] = useState("");
  const items = availableCompanies.filter((company) => symbols.includes(company.symbol));
  const results = availableCompanies.filter((company) => !symbols.includes(company.symbol) && `${company.name} ${company.symbol}`.toLowerCase().includes(query.toLowerCase()));
  function add() { if (symbols.includes(candidate)) { setMessage("That company is already on your watchlist."); return; } setSymbols([...symbols, candidate]); setMessage(`${candidate} added to your watchlist.`); }
  return <><PageHeading eyebrow="SAVED COMPANIES" title="Watchlist" description="Keep an eye on dividend dates and company metrics that matter to you." action={<DemoTag />} /><div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div>Sample dividend metrics are illustrative only. Your watchlist is stored locally in this browser.</div><DemoTag /></div>
    <Panel title="Add to your watchlist" subtitle="Search our sample company universe"><div className="watchlist-add"><label className="filter-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a company to add" /></label><select value={candidate} onChange={(event) => setCandidate(event.target.value)}>{results.map((company) => <option key={company.symbol} value={company.symbol}>{company.name} ({company.symbol})</option>)}</select><button className="button button-primary" onClick={add}><Plus size={15} /> Add company</button></div>{message && <div className="form-message">{message}</div>}</Panel>
    <Panel title="Your watchlist" subtitle={`${items.length} saved companies · mixed demo, manual, and exchange-source data`} action={<div className="panel-count">{items.length} companies</div>}>{items.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Company</th><th>Exchange symbol</th><th>Sector</th><th>Dividend yield</th><th>Latest dividend</th><th>Ex-date</th><th /></tr></thead><tbody>{items.map((company) => <tr key={company.symbol}><td><Link className="company-cell" href={`/company-analysis/${company.symbol}`}><span className="company-logo">{company.symbol.slice(0, 2)}</span><b>{company.name}</b></Link><CompanyDataSource company={company} subtle /></td><td><span className="symbol">{companyExchangeSymbol(company)}</span></td><td>{company.sector}</td><td className="yield-value">{company.yield === null ? "—" : `${company.yield.toFixed(2)}%`}</td><td className="amount-cell">{currency(company.dividend)}</td><td>{company.exDate || "—"}</td><td><button className="icon-button remove-button" aria-label={`Remove ${company.name}`} onClick={() => setSymbols(symbols.filter((item) => item !== company.symbol))}><X size={15} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state"><Star size={20} /><b>Your watchlist is ready</b><span>Add a company above to follow its dividend profile here.</span><Link className="button button-secondary button-small" href="/dividend-screener">Browse the screener</Link></div>}</Panel>
  </>;
}

function CorporateActionsPage() {
  const availableCompanies = useCompanies();
  const autoDividendState = useAutoDividends();
  const dividendCompanies = autoDividendState.configured ? autoDividendState.events : availableCompanies;
  const [active, setActive] = useState("Dividends");
  const sections = ["Dividends", "Bonus shares", "Stock splits", "Rights issues"];
  const dividendRows = [...dividendCompanies]
    .sort((a, b) => (parseDemoDate(b.exDate)?.getTime() ?? 0) - (parseDemoDate(a.exDate)?.getTime() ?? 0))
    .slice(0, 50);
  const sampleRows = availableCompanies.filter((company) => !company.sourceExchange).slice(0, 4);
  const rows = active === "Dividends" ? dividendRows : sampleRows;
  return <><PageHeading eyebrow="COMPANY EVENTS" title="Corporate actions" description="Explore dividend entries and sample capital-action notices across listed companies." action={<DemoTag />} /><div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div>Dividend details may be manually entered and are not independently verified. Bonus, split, and rights-issue examples remain sample entries. Confirm all actions with official disclosures.</div><DemoTag /></div>
    <div className="action-tabs">{sections.map((item) => <button className={active === item ? "active" : ""} key={item} onClick={() => setActive(item)}>{item}<span>{item === "Dividends" ? availableCompanies.length : item === "Bonus shares" ? "3" : item === "Stock splits" ? "2" : "1"}</span></button>)}</div>
    <Panel title={`${active} announced`} subtitle={active === "Dividends" ? `${availableCompanies.length} current listing records · latest ex-dates first` : "Other action types are illustrative sample information"}><div className="table-scroll"><table className="data-table"><thead><tr><th>Company</th><th>Action</th><th>Announcement date</th><th>Ex-date</th><th>Record date</th><th>Details</th><th>Status</th></tr></thead><tbody>{rows.map((company, index) => <tr key={company.symbol}><td><Link className="company-cell" href={`/company-analysis/${company.symbol}`}><span className="company-logo">{company.symbol.slice(0, 2)}</span><b>{company.name}</b></Link><CompanyDataSource company={company} subtle /></td><td><span className={`type-pill ${company.type.toLowerCase()}`}>{active === "Dividends" ? `${company.type} dividend` : active}</span></td><td>{company.announcement || "—"}</td><td>{company.exDate || "—"}</td><td>{company.recordDate || "—"}</td><td>{active === "Dividends" ? `${currency(company.dividend)} / share` : active === "Bonus shares" ? "1:1 illustrative ratio" : active === "Stock splits" ? "Face value ₹10 to ₹5" : "1:4 illustrative ratio"}</td><td><span className={`status-pill${index > 5 ? " muted-status" : ""}`}>{company.manualUpdateAt ? "Manual · unverified" : company.sourceExchange ? `${company.sourceExchange} CSV` : index > 5 ? "Completed · demo" : "Upcoming · demo"}</span></td></tr>)}</tbody></table></div></Panel>
  </>;
}

function ManualDividendsPage() {
  const availableCompanies = useCompanies();
  const todayKey = useTodayKey();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All types");
  const [sortBy, setSortBy] = useState<"updated" | "exDate" | "dividend">("updated");
  const [dateStatus, setDateStatus] = useState("All dates");
  const [sourceStatus, setSourceStatus] = useState("All sources");
  const manualRows = useMemo(() => availableCompanies.filter((company) => company.manualUpdateAt), [availableCompanies]);
  const rows = useMemo(() => manualRows
    .filter((company) => {
      const matchesQuery = `${company.name} ${company.symbol} ${company.exchangeSymbol ?? ""}`.toLowerCase().includes(query.toLowerCase());
      const matchesType = type === "All types" || company.type === type;
      const daysToExDate = dayOffsetFromToday(company.exDate, todayKey);
      const matchesDate = dateStatus === "All dates"
        || (dateStatus === "Upcoming" && daysToExDate !== null && daysToExDate >= 0)
        || (dateStatus === "Past" && daysToExDate !== null && daysToExDate < 0);
      const hasSource = Boolean(company.manualSourceUrl?.trim());
      const matchesSource = sourceStatus === "All sources"
        || (sourceStatus === "Source provided" && hasSource)
        || (sourceStatus === "No source link" && !hasSource);
      return matchesQuery && matchesType && matchesDate && matchesSource;
    })
    .sort((a, b) => {
      if (sortBy === "dividend") return (b.dividend ?? -1) - (a.dividend ?? -1);
      if (sortBy === "exDate") return (parseDemoDate(b.exDate)?.getTime() ?? 0) - (parseDemoDate(a.exDate)?.getTime() ?? 0);
      return (Date.parse(b.manualUpdateAt ?? "") || 0) - (Date.parse(a.manualUpdateAt ?? "") || 0);
    }), [manualRows, query, type, sortBy, dateStatus, sourceStatus, todayKey]);
  const latestUpdate = manualRows.reduce<string | null>((latest, company) =>
    !latest || (Date.parse(company.manualUpdateAt ?? "") || 0) > (Date.parse(latest) || 0) ? company.manualUpdateAt ?? latest : latest, null);
  const upcomingCount = manualRows.filter((company) => {
    const days = dayOffsetFromToday(company.exDate, todayKey);
    return days !== null && days >= 0;
  }).length;
  const highest = manualRows.filter((company) => company.dividend !== null)
    .sort((a, b) => (b.dividend ?? 0) - (a.dividend ?? 0))[0];
  return <><PageHeading eyebrow="MANUALLY MAINTAINED" title="Manual dividend updates" description="Dividend details entered by hand by the DNX team. Each entry shows when it was updated and, where provided, the source it came from."
    action={<button className="button button-secondary" disabled={!rows.length} onClick={() => downloadCsv("dnx-manual-dividends.csv",
      ["Company", "Symbol", "Dividend per share", "Type", "Announcement date", "Ex-date", "Record date", "Payment date", "Last updated", "Source link"],
      rows.map((company) => [company.name, companyExchangeSymbol(company), company.dividend ?? "", company.type, company.announcement, company.exDate, company.recordDate, company.paymentDate, company.manualUpdateAt ? formatManualUpdateDate(company.manualUpdateAt) : "", company.manualSourceUrl ?? ""]))}><Download size={15} /> Export CSV</button>} />
    <div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div><b>Manually entered, not independently verified.</b> These figures are typed in by the DNX team and may lag official announcements. Always confirm with the company or the exchange before making decisions.</div><span className="demo-tag"><span />MANUAL</span></div>
    <div className="metric-grid">
      <MetricCard label="Manual entries" value={String(manualRows.length).padStart(2, "0")} note="Companies with hand-entered dividends" icon={Pencil} tone="amber" />
      <MetricCard label="Last updated" value={latestUpdate ? formatManualUpdateDate(latestUpdate) : "—"} note="Most recent manual edit" icon={CalendarDays} tone="blue" />
      <MetricCard label="Upcoming ex-dates" value={String(upcomingCount).padStart(2, "0")} note="Today or later, manual entries only" icon={Zap} tone="green" />
      <MetricCard label="Highest dividend / share" value={currency(highest?.dividend ?? null)} note={highest?.name ?? "No amount available"} icon={CircleDollarSign} tone="purple" />
    </div>
    <Panel title="Manual dividend entries" subtitle={`${rows.length} of ${manualRows.length} entries`} className="table-panel">
      {manualRows.length ? <>
        <div className="dividend-table-tools"><label className="filter-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company or symbol" /></label>
          <label>Type<select value={type} onChange={(event) => setType(event.target.value)}>{["All types", "Interim", "Final", "Special", "Dividend"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Ex-date<select value={dateStatus} onChange={(event) => setDateStatus(event.target.value)}><option>All dates</option><option>Upcoming</option><option>Past</option></select></label>
          <label>Source<select value={sourceStatus} onChange={(event) => setSourceStatus(event.target.value)}><option>All sources</option><option>Source provided</option><option>No source link</option></select></label>
          <label>Sort by<select value={sortBy} onChange={(event) => setSortBy(event.target.value as "updated" | "exDate" | "dividend")}><option value="updated">Recently updated</option><option value="exDate">Ex-date</option><option value="dividend">Dividend amount</option></select></label></div>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Company</th><th>Dividend / share</th><th>Type</th><th>Announced</th><th>Ex-date</th><th>Record date</th><th>Payment date</th><th>Updated</th><th>Source</th><th>Ex-date status</th></tr></thead><tbody>{rows.map((company) => <tr key={company.symbol}>
          <td><Link className="company-cell" href={`/company-analysis/${company.symbol}`}><span className="company-logo">{company.symbol.slice(0, 2)}</span><b>{company.name}</b></Link><ManualUpdateBadge /></td>
          <td className="amount-cell">{currency(company.dividend)}</td>
          <td><span className={`type-pill ${company.type.toLowerCase()}`}>{company.type}</span></td>
          <td>{company.announcement || "—"}</td>
          <td><b className="date-emphasis">{company.exDate || "—"}</b></td>
          <td>{company.recordDate || "—"}</td>
          <td>{company.paymentDate || "—"}</td>
          <td>{company.manualUpdateAt ? formatManualUpdateDate(company.manualUpdateAt) : "—"}</td>
          <td>{company.manualSourceUrl?.trim() ? <a className="panel-link" href={company.manualSourceUrl} target="_blank" rel="noopener noreferrer">View source <ArrowUpRight size={12} /></a> : <span className="muted-text">Not provided</span>}</td>
          <td>{(() => { const days = dayOffsetFromToday(company.exDate, todayKey); return days === null ? <span className="muted-text">Date unavailable</span> : days < 0 ? <span className="muted-text">Past</span> : days === 0 ? <span className="type-pill interim">Today</span> : <span className="type-pill final">In {days} days</span>; })()}</td>
        </tr>)}</tbody></table>{!rows.length && <div className="table-empty">No manual entries match your filters.</div>}</div>
      </> : <div className="empty-state"><Pencil size={20} /><b>No manual updates yet</b><span>Dividend entries added from the developer console will appear here.</span></div>}
    </Panel>
  </>;
}

function dateToInput(value: string) {
  const parsed = parseDemoDate(value);
  return parsed ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}` : "";
}

function dateFromInput(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function OwnerPage() {
  const { companies: availableCompanies, setCompanies } = useContext(CompaniesContext);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState<DividendCompany | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/owner/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check the owner session.");
        const result = await response.json() as { authenticated: boolean };
        if (!cancelled) setAuthenticated(result.authenticated);
      })
      .catch((cause: unknown) => {
        console.error("Could not check the DNX owner session.", cause);
        if (!cancelled) {
          setAuthenticated(false);
          setError("Owner login status could not be checked. Refresh and try again.");
        }
      });
    return () => { cancelled = true; };
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/owner/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as { error?: string; authenticated?: boolean };
      if (!response.ok) throw new Error(result.error ?? "Owner login failed.");
      setAuthenticated(true);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Owner login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    setNotice("");
    const updated = availableCompanies.map((company) => company.symbol === draft.symbol ? draft : company);
    try {
      const response = await fetch("/api/owner/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: updated }),
      });
      const result = await response.json() as { error?: string; companies?: DividendCompany[] };
      if (!response.ok || !result.companies) throw new Error(result.error ?? "Company changes could not be saved.");
      setCompanies(result.companies);
      setDraft(null);
      setNotice(`${draft.name} saved and published to this DNX instance.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Company changes could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/owner/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not end the owner session.");
      setAuthenticated(false);
      setDraft(null);
      setNotice("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not end the owner session.");
    } finally {
      setBusy(false);
    }
  }

  if (authenticated === null) return <><PageHeading eyebrow="RESTRICTED ACCESS" title="Owner console" description="Checking your owner session." /><Panel title="Secure owner access"><div className="owner-loading">Verifying the signed owner session…</div></Panel></>;
  if (!authenticated) return <><PageHeading eyebrow="RESTRICTED ACCESS" title="Owner console" description="Sign in to edit and publish company demo data for this DNX instance." action={<LockKeyhole size={19} />} />
    <Panel title="Owner sign in" subtitle="Credentials are checked on the server and never saved in the browser"><form className="owner-login-form" onSubmit={login}><label>Owner email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"} <ArrowUpRight size={14} /></button></form>{error && <div className="owner-message error" role="alert">{error}</div>}<div className="owner-security-note"><ShieldCheck size={15} /><span>Use the hashed <code>DNX_DEVELOPER_EMAIL</code>, <code>DNX_DEVELOPER_PASSWORD_HASH</code>, and <code>DNX_DEVELOPER_SESSION_SECRET</code> settings. Legacy owner settings remain supported.</span></div></Panel>
  </>;

  return <><PageHeading eyebrow="OWNER TOOLS" title="Edit company data" description="Update sample company metrics and dividend dates shown across this DNX instance." action={<button className="button button-secondary" disabled={busy} onClick={() => void logout()}><LogOut size={14} /> Sign out</button>} />
    <div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div>This editor changes the site demo dataset only. It does not retrieve or verify exchange data. Public pages continue to label these figures DEMO DATA.</div><DemoTag /></div>
    <Panel title="Company dataset" subtitle={`${availableCompanies.length} editable records · changes apply across dashboard, calendar, screener and analysis`} action={<span className="owner-storage-label">Self-hosted file storage</span>}>
      <div className="owner-company-list">{availableCompanies.map((company) => <div className="owner-company-row" key={company.symbol}><span className="company-logo">{company.symbol.slice(0, 2)}</span><span className="owner-company-name"><b>{company.name}</b><small>{companyExchangeSymbol(company)} · {company.sector}</small></span><span className="owner-company-metrics">{company.yield === null ? "—" : `${company.yield.toFixed(2)}%`} yield · {currency(company.dividend)}</span><button className="button button-secondary button-small" onClick={() => { setDraft({ ...company }); setError(""); setNotice(""); }}><Pencil size={13} /> Edit</button></div>)}</div>
    </Panel>
    {draft && <Panel title={`Edit ${draft.name}`} subtitle={`${draft.symbol} · NSE demo record`} action={<button className="icon-button" aria-label="Close editor" onClick={() => setDraft(null)}><X size={15} /></button>}>
      <form className="owner-edit-form" onSubmit={saveCompany}>
        <label>Company name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>NSE symbol<input value={draft.symbol} readOnly /></label>
        <label>Sector<input required value={draft.sector} onChange={(event) => setDraft({ ...draft, sector: event.target.value })} /></label>
        <label>Dividend type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as DividendCompany["type"] })}><option>Interim</option><option>Final</option><option>Special</option><option>Dividend</option></select></label>
        <label>Market cap (₹ Cr)<input type="number" min="0" step="any" required value={draft.marketCap ?? ""} onChange={(event) => setDraft({ ...draft, marketCap: event.target.value === "" ? null : Number(event.target.value) })} /></label>
        <label>Dividend yield (%)<input type="number" min="0" step="any" required value={draft.yield ?? ""} onChange={(event) => setDraft({ ...draft, yield: event.target.value === "" ? null : Number(event.target.value) })} /></label>
        <label>Dividend per share (₹)<input type="number" min="0" step="any" required value={draft.dividend ?? ""} onChange={(event) => setDraft({ ...draft, dividend: event.target.value === "" ? null : Number(event.target.value) })} /></label>
        <label>Payout ratio (%)<input type="number" min="0" step="any" required value={draft.payout ?? ""} onChange={(event) => setDraft({ ...draft, payout: event.target.value === "" ? null : Number(event.target.value) })} /></label>
        <label>Announcement date<input type="date" required value={dateToInput(draft.announcement)} onChange={(event) => setDraft({ ...draft, announcement: dateFromInput(event.target.value) })} /></label>
        <label>Ex-date<input type="date" required value={dateToInput(draft.exDate)} onChange={(event) => setDraft({ ...draft, exDate: dateFromInput(event.target.value) })} /></label>
        <label>Record date<input type="date" required value={dateToInput(draft.recordDate)} onChange={(event) => setDraft({ ...draft, recordDate: dateFromInput(event.target.value) })} /></label>
        <label>Payment date<input type="date" required value={dateToInput(draft.paymentDate)} onChange={(event) => setDraft({ ...draft, paymentDate: dateFromInput(event.target.value) })} /></label>
        <div className="owner-edit-actions"><button className="button button-secondary" type="button" onClick={() => setDraft(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save and publish"} <Check size={14} /></button></div>
      </form>
    </Panel>}
    {error && <div className="owner-message error" role="alert">{error}</div>}{notice && <div className="owner-message success" role="status">{notice}</div>}
    <div className="settings-note"><ShieldCheck size={15} /><span>Company edits use configured persistent storage: private Vercel Blob in the hosted app, or <code>data/owner-data.json</code> for local self-hosting. All company figures remain demo data.</span></div>
  </>;
}

function ReportsPage() {
  return <><PageHeading eyebrow="INCOME ANALYTICS" title="Dividend reports" description="Review sample income trends and explore a clearer view of your dividend universe." action={<button className="button button-secondary" onClick={() => window.print()}><Download size={15} /> Print report</button>} /><div className="demo-banner"><span className="demo-alert-icon"><ShieldCheck size={16} /></span><div>These report figures are illustrative sample data and do not represent actual market-wide dividend totals.</div><DemoTag /></div>
    <div className="metric-grid reports-metrics"><MetricCard label="Annual dividend income" value={reportTotals.annualIncome} note="2026 sample estimate" icon={CircleDollarSign} tone="green" trend="+10.8%" /><MetricCard label="Monthly average" value={reportTotals.monthlyAverage} note="Illustrative monthly income" icon={CalendarDays} tone="blue" /><MetricCard label="Income sources" value={reportTotals.incomeSources} note="Sample companies tracked" icon={Building2} tone="purple" /><MetricCard label="Top sector" value="Energy" note={`${reportTotals.energyShare} of sample allocation`} icon={Landmark} tone="amber" /></div>
    <div className="content-grid report-charts"><Panel title="Annual dividend history" subtitle="Illustrative income trend · ₹ thousands" action={<DemoTag subtle />}><DividendHistoryChart /></Panel><Panel title="Sector allocation" subtitle="Sample share of tracked dividend income"><SectorChart /></Panel></div>
    <div className="content-grid report-lower"><Panel title="Monthly income distribution" subtitle="Illustrative dividend income · ₹ thousands"><MonthlyChart /></Panel><Panel title="Income summary" subtitle="Sample annual breakdown"><div className="report-summary">{[["2026 estimate", reportTotals.annualIncome, "+10.8%"], ["2025 sample", reportTotals.previousIncome, "+12.7%"], ["2024 sample", reportTotals.olderIncome, "+41.5%"], ["Highest month", reportTotals.highestMonth, "Illustrative"]].map(([label, amount, trend]) => <div key={label}><span>{label}</span><b>{amount}</b><small className="positive">{trend}</small></div>)}</div></Panel></div>
  </>;
}

function SettingsPage({ theme, setTheme, profile, setProfile }: {
  theme: Theme; setTheme: (theme: Theme) => void; profile: Profile; setProfile: (profile: Profile) => void;
}) {
  const [currencyFormat, setCurrencyFormat] = useState("INR (₹)");
  const [notifications, setNotifications] = useState(true);
  const [profileDraft, setProfileDraft] = useState<Profile>(profile);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    setProfileDraft(profile);
    setProfileSaved(false);
  }, [profile]);

  function saveProfile() {
    const name = profileDraft.name.trim();
    const email = profileDraft.email.trim();
    if (!name) {
      setProfileError("Please enter your full name.");
      setProfileSaved(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileError("Please enter a valid email address.");
      setProfileSaved(false);
      return;
    }
    setProfile({ name, email });
    setProfileDraft({ name, email });
    setProfileError("");
    setProfileSaved(true);
  }

  return <><PageHeading eyebrow="PREFERENCES" title="Settings" description="Personalize how DNX INDICATES looks and how your sample data is displayed." action={<DemoTag />} /><Panel title="Appearance" subtitle="Choose your preferred dashboard theme"><div className="setting-row"><div className="setting-icon"><Sun size={17} /></div><div className="setting-copy"><b>Color theme</b><span>Switch between the dark and light interface.</span></div><div className="segmented-control"><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={14} /> Dark</button><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={14} /> Light</button></div></div></Panel>
    <Panel title="Display preferences" subtitle="Adjust how figures are presented"><div className="setting-row"><div className="setting-icon"><CircleDollarSign size={17} /></div><div className="setting-copy"><b>Currency format</b><span>Used in calculations and financial tables.</span></div><select className="settings-select" value={currencyFormat} onChange={(event) => setCurrencyFormat(event.target.value)}><option>INR (₹)</option><option>INR (Indian grouping)</option></select></div><div className="setting-row"><div className="setting-icon"><Bell size={17} /></div><div className="setting-copy"><b>Dividend date reminders</b><span>Show reminder indicators for upcoming sample events.</span></div><button className={`switch${notifications ? " on" : ""}`} role="switch" aria-checked={notifications} onClick={() => setNotifications(!notifications)}><i /></button></div><div className="setting-row"><div className="setting-icon"><SlidersHorizontal size={17} /></div><div className="setting-copy"><b>Show demo-data labels</b><span>Demo labels are always visible to avoid confusion.</span></div><span className="always-on"><Check size={13} /> Always on</span></div></Panel>
    <Panel title="Profile" subtitle="Edit the name and email shown in your DNX workspace"><div className="profile-settings"><div className="profile-large-avatar">{profileDraft.name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U"}</div><div className="profile-fields"><label>Full name<input autoComplete="name" value={profileDraft.name} onChange={(event) => { setProfileDraft({ ...profileDraft, name: event.target.value }); setProfileSaved(false); setProfileError(""); }} /></label><label>Email address<input type="email" autoComplete="email" value={profileDraft.email} onChange={(event) => { setProfileDraft({ ...profileDraft, email: event.target.value }); setProfileSaved(false); setProfileError(""); }} /></label><label>Account type<input value="Personal workspace" readOnly /></label><button className="button button-primary" type="button" onClick={saveProfile}><Check size={15} /> Save changes</button>{profileError && <span className="inline-error" role="alert">{profileError}</span>}{profileSaved && <span className="success-message" role="status">Profile saved in this browser. Your dashboard greeting and sidebar are updated.</span>}</div></div></Panel>
    <div className="settings-note"><ShieldCheck size={15} /><span>Your profile, watchlist, portfolio, and theme preferences are stored in this browser only. They are not connected to a login account or synced across devices.</span></div>
  </>;
}

export default DashboardApp;
