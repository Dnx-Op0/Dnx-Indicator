"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight, Bell, Building2, CalendarDays, Check, CircleAlert, Clock3, Database,
  Download, LayoutDashboard, LogOut, Pencil, RefreshCw, Search, ShieldCheck, Sparkles, X, Zap,
} from "lucide-react";
import type { DividendCompany } from "@/data/demo";
import { parseOfficialDividendCsv, type Exchange, type OfficialDividendImport } from "@/lib/official-dividend-import";

type DeveloperView = "overview" | "companies" | "dividends";

type SyncRun = {
  id: string;
  mode: string;
  status: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  attempts: number;
  detected: number;
  created: number;
  updated: number;
  errorCode: string | null;
};

type SyncNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
};

type SyncStatus = {
  databaseConfigured: boolean;
  sourceConfigured: boolean;
  nextScheduledAt: string | null;
  monitoredCompanies: number | null;
  lastSuccessfulAt: string | null;
  recentRuns: SyncRun[];
  notifications: SyncNotification[];
};

type CompanyStorageStatus = {
  mode: "vercel-blob" | "local-file" | "demo-read-only";
  persistent: boolean;
  editable: boolean;
};

function dateToInput(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString().slice(0, 10);
}

function formatSyncDate(value: string | null) {
  if (!value) return "Not yet";
  return `${new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value))} IST`;
}

function preserveYieldSourceWhenUnchanged(updated: DividendCompany, previous: DividendCompany) {
  if (updated.yield === previous.yield) return updated;
  const withoutYieldSource = { ...updated };
  delete withoutYieldSource.yieldAsOf;
  delete withoutYieldSource.yieldPeriodStart;
  delete withoutYieldSource.yieldPriceExchange;
  return withoutYieldSource;
}

function DeveloperMetric({ icon: Icon, label, value, note }: {
  icon: typeof Building2; label: string; value: string; note: string;
}) {
  return <div className="developer-metric">
    <span className="developer-metric-icon"><Icon size={17} /></span>
    <div><small>{label}</small><b>{value}</b><span>{note}</span></div>
  </div>;
}

export default function DeveloperConsole({ view }: { view: DeveloperView }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<DividendCompany[]>([]);
  const [storage, setStorage] = useState<CompanyStorageStatus | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [draft, setDraft] = useState<DividendCompany | null>(null);
  const [dividendDraft, setDividendDraft] = useState<DividendCompany | null>(null);
  const [isNewCalendarEntry, setIsNewCalendarEntry] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncLoading, setSyncLoading] = useState(true);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [importExchange, setImportExchange] = useState<Exchange>("NSE");
  const [importPreview, setImportPreview] = useState<OfficialDividendImport | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
    let cancelled = false;
    fetch("/api/owner/data", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { companies?: DividendCompany[]; storage?: CompanyStorageStatus; error?: string };
        if (!response.ok || !result.companies || !result.storage) throw new Error(result.error ?? "Could not load the company dataset.");
        if (!cancelled) setCompanies(result.companies);
        if (!cancelled) setStorage(result.storage);
      })
      .catch((cause: unknown) => {
        console.error("Could not load developer company data.", cause);
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the company dataset.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSyncStatus(initialLoad: boolean) {
      try {
        const response = await fetch("/api/developer/sync/status", { cache: "no-store" });
        const result = await response.json() as SyncStatus & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load synchronization status.");
        if (!cancelled) setSyncStatus(result);
      } catch (cause) {
        console.error("Could not load dividend synchronization status.", cause);
        if (!cancelled) setSyncError(cause instanceof Error ? cause.message : "Could not load synchronization status.");
      } finally {
        if (!cancelled && initialLoad) setSyncLoading(false);
      }
    }

    void loadSyncStatus(true);
    const interval = window.setInterval(() => void loadSyncStatus(false), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  async function runSyncNow() {
    setSyncBusy(true);
    setSyncError("");
    setSyncNotice("");
    try {
      const response = await fetch("/api/developer/sync/run", { method: "POST" });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? (result.status === "UNCONFIGURED"
          ? "No approved dividend source is connected. No data was fetched."
          : "Synchronization failed."));
      }
      setSyncNotice("Synchronization completed successfully.");
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : "Synchronization failed.");
    } finally {
      try {
        const response = await fetch("/api/developer/sync/status", { cache: "no-store" });
        const result = await response.json() as SyncStatus & { error?: string };
        if (response.ok) setSyncStatus(result);
        else setSyncError(result.error ?? "Could not refresh synchronization status.");
      } catch (cause) {
        console.error("Could not refresh synchronization status.", cause);
      }
      setSyncBusy(false);
    }
  }

  async function saveCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    setNotice("");
    const updated = companies.map((company) => company.symbol === draft.symbol
      ? preserveYieldSourceWhenUnchanged(draft, company)
      : company);
    try {
      const response = await fetch("/api/owner/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: updated }),
      });
      const result = await response.json() as { companies?: DividendCompany[]; storage?: CompanyStorageStatus; error?: string };
      if (!response.ok || !result.companies) throw new Error(result.error ?? "Company changes could not be saved.");
      setCompanies(result.companies);
      if (result.storage) setStorage(result.storage);
      setDraft(null);
      setNotice(`${draft.name} saved and published to the public demo dataset.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Company changes could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDividendUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dividendDraft) return;
    setBusy(true);
    setError("");
    setNotice("");
    const previous = companies.find((company) => company.symbol === dividendDraft.symbol) ?? dividendDraft;
    const updatedDividend = preserveYieldSourceWhenUnchanged({
      ...dividendDraft,
      manualUpdateAt: new Date().toISOString(),
      manualSourceUrl: dividendDraft.manualSourceUrl?.trim() || undefined,
    }, previous);
    const exists = companies.some((company) => company.symbol === updatedDividend.symbol);
    const updated = exists ? companies.map((company) => company.symbol === updatedDividend.symbol ? updatedDividend : company) : [...companies, updatedDividend];
    try {
      const response = await fetch("/api/owner/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: updated }),
      });
      const result = await response.json() as { companies?: DividendCompany[]; storage?: CompanyStorageStatus; error?: string };
      if (!response.ok || !result.companies) throw new Error(result.error ?? "Dividend changes could not be saved.");
      setCompanies(result.companies);
      if (result.storage) setStorage(result.storage);
      setDividendDraft(null);
      setIsNewCalendarEntry(false);
      setNotice(`${updatedDividend.name} calendar entry ${exists ? "updated" : "added"} and published. It is manually entered and not independently verified.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dividend changes could not be saved.");
    } finally {
      setBusy(false);
    }
  }

    async function previewOfficialImport(event: React.ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0];
      setImportPreview(null);
      setImportFileName("");
      setError("");
      setNotice("");
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        setError("CSV files must be 5 MB or smaller.");
        event.target.value = "";
        return;
      }

      setImportBusy(true);
      try {
        const parsed = parseOfficialDividendCsv(await file.text(), importExchange);
        setImportPreview(parsed);
        setImportFileName(file.name);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not read the selected exchange CSV.");
        event.target.value = "";
      } finally {
        event.target.value = "";
        setImportBusy(false);
      }
    }

    async function publishOfficialImport() {
      if (!importPreview) return;
      setBusy(true);
      setError("");
      setNotice("");
      const merged = new Map(companies.map((company) => [company.symbol, company]));
      let added = 0;
      let updated = 0;
      let preservedManual = 0;

      for (const importedCompany of importPreview.companies) {
        const current = merged.get(importedCompany.symbol);
        if (current?.manualUpdateAt && current.sourceExchange === importedCompany.sourceExchange) {
          preservedManual += 1;
          continue;
        }
        if (current) updated += 1;
        else added += 1;
        merged.set(importedCompany.symbol, importedCompany);
      }

      try {
        const response = await fetch("/api/owner/data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companies: [...merged.values()] }),
        });
        const result = await response.json() as { companies?: DividendCompany[]; storage?: CompanyStorageStatus; error?: string };
        if (!response.ok || !result.companies) throw new Error(result.error ?? "Exchange records could not be saved.");
        setCompanies(result.companies);
        if (result.storage) setStorage(result.storage);
        setImportPreview(null);
        setImportFileName("");
        setNotice(`Published ${added} new and updated ${updated} ${importExchange} records.${preservedManual ? ` Kept ${preservedManual} manually edited records unchanged.` : ""}`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Exchange records could not be saved.");
      } finally {
        setBusy(false);
      }
    }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/owner/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not end the developer session.");
      router.replace("/developer/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not end the developer session.");
    } finally {
      setBusy(false);
    }
  }

  const onOverview = view === "overview";
  const onCompanies = view === "companies";
  const onDividends = view === "dividends";
  const title = onOverview ? "Developer overview" : onCompanies ? "Manage companies" : "Dividend updates";
  const matchingCompanies = companies.filter((company) =>
    `${company.name} ${company.symbol} ${company.exchangeSymbol ?? ""}`.toLowerCase().includes(companySearch.trim().toLowerCase()),
  );
  const visibleMatchingCompanies = matchingCompanies.slice(0, 100);
  const manualDividendCount = companies.filter((company) => company.manualUpdateAt).length;

  return <div className="developer-layout">
    <aside className="developer-sidebar">
      <Link className="developer-sidebar-brand" href="/"><span className="developer-brand-mark">DNX</span><span><b>DNX INDICATES</b><small>Developer workspace</small></span></Link>
      <div className="developer-sidebar-label">PRIVATE CONSOLE</div>
      <nav className="developer-nav" aria-label="Developer navigation">
        <Link className={onOverview ? "active" : ""} href="/developer"><LayoutDashboard size={16} /> Overview</Link>
        <Link className={onCompanies ? "active" : ""} href="/developer/companies"><Building2 size={16} /> Manage companies</Link>
        <Link className={onDividends ? "active" : ""} href="/developer/dividends"><CalendarDays size={16} /> Dividend updates</Link>
      </nav>
      <div className="developer-sidebar-note"><ShieldCheck size={15} /><span>Automatic-feed connection and sync status are shown below. Manual dividend edits remain separately marked.</span></div>
      <div className="developer-sidebar-bottom"><span className="developer-avatar">D</span><span><b>Owner &amp; developer</b><small>Private access</small></span></div>
    </aside>

    <main className="developer-main">
      <header className="developer-topbar"><div><span>DNX WORKSPACE</span><b>{title}</b></div><div className="developer-topbar-actions"><div className="developer-topbar-status"><i /> Developer session active</div><button className="button button-secondary button-small developer-signout" onClick={() => void signOut()} disabled={busy}><LogOut size={14} />{busy ? "Signing out…" : "Sign out"}</button></div></header>
      <div className="developer-content">
        <div className="developer-page-heading"><div><span className="eyebrow">{onOverview ? "PRIVATE DEVELOPER DASHBOARD" : onCompanies ? "DEMO DATA MANAGEMENT" : "MANUAL DIVIDEND MANAGEMENT"}</span><h1>{title}</h1><p>{onOverview ? "Review automatic-feed connection, synchronization history, and manual dividend controls." : onCompanies ? "Edit company names, sectors, and market capitalization. Use Dividend Updates for dividend values and dates." : "Manually update dividend amounts, yields, payout ratio, and dates. Published entries appear across public dividend pages."}</p></div><span className="developer-phase-badge"><Sparkles size={13} /> {onOverview ? "SYNC FOUNDATION" : onCompanies ? "DEMO DATA" : "MANUAL ENTRY"}</span></div>

        {error && <div className="developer-message error" role="alert"><CircleAlert size={15} />{error}</div>}
        {notice && <div className="developer-message success" role="status"><Check size={15} />{notice}</div>}

        {onOverview ? <>
          <div className="developer-metric-grid">
            <DeveloperMetric icon={Building2} label="Companies in demo dataset" value={loading ? "…" : String(companies.length)} note="Editable sample records" />
            <DeveloperMetric icon={Database} label="Sync database" value={syncLoading ? "…" : syncStatus?.databaseConfigured ? "Connected" : "Not configured"} note="PostgreSQL connection required" />
            <DeveloperMetric icon={Zap} label="Authorized source" value={syncLoading ? "…" : syncStatus?.sourceConfigured ? "Connected" : "Not configured"} note="No financial source is queried" />
          </div>
          <section className="developer-panel developer-sync-panel">
            <div className="developer-panel-heading">
              <div><span className="eyebrow">AUTOMATIC DIVIDEND INTELLIGENCE</span><h2>Scheduled synchronization</h2><p>Free Vercel Hobby hosting permits one scheduled run per day. The full-sync job is scheduled for 16:00 IST; intraday 30-minute checks require a paid plan.</p></div>
              <button className="button button-secondary button-small" onClick={() => void runSyncNow()} disabled={syncBusy || syncLoading || !syncStatus?.databaseConfigured}><RefreshCw size={13} className={syncBusy ? "developer-spin" : ""} />{syncBusy ? "Running…" : "Run sync now"}</button>
            </div>
            {(syncError || syncNotice) && <div className={`developer-message ${syncError ? "error" : "success"}`} role={syncError ? "alert" : "status"}>{syncError ? <CircleAlert size={15} /> : <Check size={15} />}{syncError || syncNotice}</div>}
            <div className="developer-sync-stats">
              <div><span>Last successful sync</span><b>{syncLoading ? "Loading…" : formatSyncDate(syncStatus?.lastSuccessfulAt ?? null)}</b></div>
              <div><span>Next scheduled check</span><b>{syncLoading ? "Loading…" : formatSyncDate(syncStatus?.nextScheduledAt ?? null)}</b></div>
              <div><span>Companies monitored</span><b>{syncLoading ? "…" : syncStatus?.monitoredCompanies ?? "Unavailable"}</b></div>
              <div><span>Database</span><b className={syncStatus?.databaseConfigured ? "sync-good" : "sync-warn"}>{syncLoading ? "Loading…" : syncStatus?.databaseConfigured ? "Connected" : "Needs DATABASE_URL + migration"}</b></div>
            </div>
            <div className="developer-sync-notice"><ShieldCheck size={15} /><span>{syncStatus?.sourceConfigured && syncStatus.databaseConfigured ? <>An authorized provider endpoint and database are configured. New source records are stored in the sync database; complete the review/publication workflow before treating them as public calendar entries.</> : syncStatus?.sourceConfigured ? <>The provider endpoint is configured, but PostgreSQL is not connected. Add DATABASE_URL and apply the Prisma migration before records can be stored.</> : <>No authorized dividend feed is configured. Scheduled calls are recorded as <b>UNCONFIGURED</b>; they do not fetch, invent, or publish financial data. Add the provider environment variables described in the README.</>}</span></div>
            {syncStatus?.notifications.length ? <div className="developer-sync-list"><h3><Bell size={13} /> Unread developer notifications</h3>{syncStatus.notifications.map((item) => <div className="developer-sync-row" key={item.id}><span className="sync-status-dot failed" /><div><b>{item.title}</b><small>{item.message}</small></div><time>{formatSyncDate(item.createdAt)}</time></div>)}</div> : null}
            {syncStatus?.recentRuns.length ? <div className="developer-sync-list"><h3><Clock3 size={13} /> Recent synchronization attempts</h3>{syncStatus.recentRuns.map((run) => <div className="developer-sync-row" key={run.id}><span className={`sync-status-dot ${run.status === "SUCCEEDED" ? "success" : "failed"}`} /><div><b>{run.mode} · {run.status}</b><small>{run.trigger} · {run.errorCode ?? `${run.created} new, ${run.updated} updated`}</small></div><time>{formatSyncDate(run.startedAt)}</time></div>)}</div> : null}
            {!syncLoading && !syncStatus?.databaseConfigured && <div className="developer-empty">Add DATABASE_URL and apply the Prisma migration to persist synchronization runs and notifications.</div>}
          </section>
          <div className="developer-overview-grid">
            <section className="developer-panel"><div className="developer-panel-heading"><div><span className="eyebrow">AVAILABLE NOW</span><h2>Manage company and dividend details</h2><p>Use the separate editors to update company fundamentals or manually publish dividend amount, yield, and date changes.</p></div><Building2 size={19} /></div><Link className="button button-primary" href="/developer/companies">Company editor <ArrowUpRight size={14} /></Link> <Link className="button button-secondary" href="/developer/dividends">Dividend updates <ArrowUpRight size={14} /></Link></section>
            <section className="developer-panel developer-phase-panel"><div className="developer-panel-heading"><div><span className="eyebrow">SOURCE INTEGRATION REQUIRED</span><h2>{syncStatus?.sourceConfigured ? "Automatic feed endpoint configured" : "Financial data remains disconnected"}</h2><p>{syncStatus?.sourceConfigured ? "The provider endpoint is configured. Complete database setup and the review/publication workflow before automatic records appear in the public calendar." : "Configure an authorized, documented feed and database before automatic retrieval. Review and publication to the public calendar remain separate steps."}</p></div><Database size={19} /></div><ul><li>Public figures remain labelled demo data</li><li>PostgreSQL schema tracks source references and revisions</li><li>Configure an approved provider before any successful run can occur</li></ul></section>
          </div>
          <div className="developer-disclaimer"><ShieldCheck size={16} /><span>Market prices and bundled company values remain DEMO DATA. Any manual dividend edits are marked and are not independently verified.</span></div>
        </> : onCompanies ? <>
          <section className="developer-panel"><div className="developer-panel-heading"><div><span className="eyebrow">CENTRAL DEMO DATASET</span><h2>Company records</h2><p>{loading ? "Loading saved company records…" : `${companies.length} records · edits publish across public company views`}</p></div><span className="developer-storage-pill"><Database size={13} />{storage?.mode === "vercel-blob" ? "Private cloud storage" : storage?.mode === "local-file" ? "Local file storage" : storage?.mode === "demo-read-only" ? "Read-only demo" : "Checking storage…"}</span></div>
            {storage?.mode === "demo-read-only" && <div className="developer-storage-notice" role="note"><CircleAlert size={15} /><span>Cloud editing is unavailable because persistent storage is not configured. The public site is showing the bundled demo dataset; edits are disabled to prevent lost changes.</span></div>}
            <div className="developer-list-toolbar">
              <label className="developer-search"><Search size={14} /><input type="search" aria-label="Search company records" placeholder="Search company or exchange symbol" value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} /></label>
              <span className="developer-list-count">{loading ? "Loading records…" : `${matchingCompanies.length} matching listings`}</span>
            </div>
            {loading ? <div className="developer-empty">Loading company data…</div> : matchingCompanies.length ? <><div className="developer-company-list">{visibleMatchingCompanies.map((company) => <div className="developer-company-row" key={company.symbol}><span className="company-logo">{(company.exchangeSymbol ?? company.symbol).slice(0, 2)}</span><span className="developer-company-copy"><b>{company.name}</b><small>{company.sourceExchange ? `${company.sourceExchange} ${company.exchangeSymbol}` : company.symbol} · {company.sector}</small></span><span className="developer-company-value">{company.yield === null ? "Yield unavailable" : `${company.yield.toFixed(2)}% yield`} · {company.dividend === null ? "Amount unavailable" : `₹${company.dividend.toFixed(2)}`}</span><button className="button button-secondary button-small" disabled={!storage?.editable} onClick={() => { setDraft({ ...company }); setError(""); setNotice(""); }}><Pencil size={13} /> Edit</button></div>)}</div>{matchingCompanies.length > visibleMatchingCompanies.length && <div className="developer-empty">Showing the first 100 matches. Search by company or exchange symbol to narrow the list.</div>}</> : <div className="developer-empty">No companies match the search.</div>}
          </section>
          {draft && storage?.editable && <section className="developer-panel"><div className="developer-panel-heading"><div><span className="eyebrow">EDIT SAMPLE RECORD</span><h2>{draft.name}</h2><p>{draft.symbol} · changes stay labelled demo information</p></div><button className="developer-icon-button" aria-label="Close editor" onClick={() => setDraft(null)}><X size={15} /></button></div>
            <form className="developer-edit-form" onSubmit={saveCompany}>
              <label>Company name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>NSE symbol<input value={draft.symbol} readOnly /></label>
              <label>Sector<input required value={draft.sector} onChange={(event) => setDraft({ ...draft, sector: event.target.value })} /></label>
              <label>Market cap (₹ Cr)<input type="number" min="0" step="any" required={!draft.sourceExchange} value={draft.marketCap ?? ""} onChange={(event) => setDraft({ ...draft, marketCap: event.target.value === "" ? null : Number(event.target.value) })} /></label>
              <div className="developer-edit-actions"><button className="button button-secondary" type="button" onClick={() => setDraft(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={busy || !storage?.editable}>{busy ? "Saving…" : "Save and publish"} <Check size={14} /></button></div>
            </form>
          </section>}
          <div className="developer-disclaimer"><ShieldCheck size={16} /><span>This editor changes only the sample dataset. Public pages continue to mark these values DEMO DATA.</span></div>
        </> : <>
          <section className="developer-panel">
            <div className="developer-panel-heading"><div><span className="eyebrow">DIVIDEND DATASET</span><h2>Calendar &amp; dividend records</h2><p>{loading ? "Loading dividend records…" : `${companies.length} records · edits publish to the public dividend calendar`}</p></div><button className="button button-primary button-small" type="button" disabled={!storage?.editable || busy || loading} onClick={() => { setIsNewCalendarEntry(true); setDividendDraft({ name: "", symbol: "", sector: "Other", marketCap: null, yield: null, dividend: null, type: "Interim", announcement: "", exDate: "", recordDate: "", paymentDate: "", payout: null }); setError(""); setNotice(""); }}><CalendarDays size={13} /> Add calendar entry</button><span className="developer-storage-pill"><Database size={13} />{storage?.mode === "vercel-blob" ? "Private cloud storage" : storage?.mode === "local-file" ? "Local file storage" : storage?.mode === "demo-read-only" ? "Read-only demo" : "Checking storage…"}</span></div>
            {storage?.mode === "demo-read-only" && <div className="developer-storage-notice" role="note"><CircleAlert size={15} /><span>Persistent storage is not configured. Dividend editing is disabled to prevent lost changes.</span></div>}
            <div className="developer-sync-notice"><ShieldCheck size={15} /><span>Official CSV imports preserve unknown metrics as unavailable. Imported announcements are attributed to NSE/BSE; no undocumented feed is queried.</span></div>
            <div className="developer-list-toolbar">
              <label className="developer-search"><Search size={14} /><input type="search" aria-label="Search companies by name or exchange symbol" placeholder="Search company or exchange symbol" value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} /></label>
              <span className="developer-list-count">{loading ? "Loading records…" : `${matchingCompanies.length} of ${companies.length} listings · ${manualDividendCount} manually updated`}</span>
            </div>
            <section className="developer-panel">
              <div className="developer-panel-heading"><div><span className="eyebrow">OFFICIAL EXCHANGE CSV</span><h2>Import dividend-paying listings</h2><p>Download the equity corporate-actions CSV from <a href="https://www.nseindia.com/companies-listing/corporate-filings-actions" target="_blank" rel="noopener noreferrer">NSE</a> or <a href="https://www.bseindia.com/corporates/corporates_act?expandable=0" target="_blank" rel="noopener noreferrer">BSE</a>, then preview and merge it here. Choose equity listings; dual-listed issuers remain separate exchange listings.</p></div><Download size={19} /></div>
              <div className="developer-edit-form">
                <label>Exchange<select value={importExchange} onChange={(event) => { setImportExchange(event.target.value as Exchange); setImportPreview(null); setImportFileName(""); }}><option value="NSE">NSE</option><option value="BSE">BSE</option></select></label>
                <label>Official corporate-actions CSV<input type="file" accept=".csv,text/csv" onChange={(event) => void previewOfficialImport(event)} disabled={importBusy || busy} /></label>
              </div>
              <div className="developer-sync-notice"><ShieldCheck size={15} /><span>The importer keeps the nearest upcoming dividend event per exchange symbol (or the latest past event if no upcoming event exists), within a 12-month past / 12-month future window. Yield, market cap, payout ratio, and missing dates stay unavailable. Records are saved to the shared dataset and become visible on public pages. Confirm exchange data-reuse rights before publishing beyond your permitted use.</span></div>
              {importBusy && <div className="developer-empty">Reading and validating CSV…</div>}
              {importPreview && <div className="developer-import-preview">
                <b>{importFileName}</b>
                <span>{importPreview.companies.length} unique {importExchange} listings · {importPreview.companies.reduce((total, company) => total + (company.calendarEvents?.length ?? 1), 0)} dividend events retained · {importPreview.duplicateRows} repeated-symbol rows preserved · {importPreview.skippedRows} other rows skipped.</span>
                <ul>{importPreview.companies.slice(0, 5).map((company) => <li key={company.symbol}>{company.name} · {company.exchangeSymbol} · {company.calendarEvents?.length ?? 1} event(s) · next ex-date {company.exDate} · {company.dividend === null ? "Amount unavailable" : `₹${company.dividend.toFixed(2)} / share`}</li>)}</ul>
                {importPreview.companies.length > 5 && <small>Showing 5 of {importPreview.companies.length} preview records.</small>}
                <div className="developer-edit-actions"><button className="button button-secondary" type="button" onClick={() => { setImportPreview(null); setImportFileName(""); }}>Cancel</button><button className="button button-primary" type="button" disabled={!storage?.editable || busy} onClick={() => void publishOfficialImport()}>{busy ? "Publishing…" : "Import and publish"} <Check size={14} /></button></div>
              </div>}
            </section>
            {dividendDraft && storage?.editable && <section className="developer-inline-editor">
              <div className="developer-panel-heading"><div><span className="eyebrow">{isNewCalendarEntry ? "NEW MANUAL CALENDAR ENTRY" : "MANUAL DIVIDEND UPDATE"}</span><h2>{isNewCalendarEntry ? "Add dividend event" : dividendDraft.name}</h2><p>{isNewCalendarEntry ? "Create a calendar entry that will appear on the public calendar after saving." : `${dividendDraft.symbol} · edit the dividend details and dates`}</p></div><button className="developer-icon-button" aria-label="Close dividend editor" onClick={() => { setDividendDraft(null); setIsNewCalendarEntry(false); }}><X size={15} /></button></div>
              <form className="developer-edit-form" onSubmit={saveDividendUpdate}>
                {isNewCalendarEntry && <><label>Company name<input required value={dividendDraft.name} onChange={(event) => setDividendDraft({ ...dividendDraft, name: event.target.value })} placeholder="Company name" /></label><label>Unique symbol<input required pattern="[A-Za-z0-9._-]+" value={dividendDraft.symbol} onChange={(event) => setDividendDraft({ ...dividendDraft, symbol: event.target.value.toUpperCase().replace(/[^A-Z0-9._-]/g, "") })} placeholder="e.g. ABC" /></label></>}
                <label>Dividend per share (₹)<input type="number" min="0" step="any" required={!dividendDraft.sourceExchange} value={dividendDraft.dividend ?? ""} onChange={(event) => setDividendDraft({ ...dividendDraft, dividend: event.target.value === "" ? null : Number(event.target.value) })} /></label>
                <label>Dividend yield (%)<input type="number" min="0" step="any" required={!dividendDraft.sourceExchange && !isNewCalendarEntry} value={dividendDraft.yield ?? ""} onChange={(event) => setDividendDraft({ ...dividendDraft, yield: event.target.value === "" ? null : Number(event.target.value) })} /></label>
                <label>Payout ratio (%)<input type="number" min="0" step="any" required={!dividendDraft.sourceExchange && !isNewCalendarEntry} value={dividendDraft.payout ?? ""} onChange={(event) => setDividendDraft({ ...dividendDraft, payout: event.target.value === "" ? null : Number(event.target.value) })} /></label>
                <label>Dividend type<select value={dividendDraft.type} onChange={(event) => setDividendDraft({ ...dividendDraft, type: event.target.value as DividendCompany["type"] })}><option>Interim</option><option>Final</option><option>Special</option><option>Dividend</option></select></label>
                <label>Announcement date<input type="date" required={(!dividendDraft.sourceExchange && !isNewCalendarEntry) || Boolean(dividendDraft.announcement)} value={dateToInput(dividendDraft.announcement)} onChange={(event) => setDividendDraft({ ...dividendDraft, announcement: event.target.value })} /></label>
                <label>Ex-date<input type="date" required value={dateToInput(dividendDraft.exDate)} onChange={(event) => setDividendDraft({ ...dividendDraft, exDate: event.target.value })} /></label>
                <label>Record date<input type="date" required={(!dividendDraft.sourceExchange && !isNewCalendarEntry) || Boolean(dividendDraft.recordDate)} value={dateToInput(dividendDraft.recordDate)} onChange={(event) => setDividendDraft({ ...dividendDraft, recordDate: event.target.value })} /></label>
                <label>Payment date<input type="date" required={(!dividendDraft.sourceExchange && !isNewCalendarEntry) || Boolean(dividendDraft.paymentDate)} value={dateToInput(dividendDraft.paymentDate)} onChange={(event) => setDividendDraft({ ...dividendDraft, paymentDate: event.target.value })} /></label>
                <label>Source URL (optional)<input type="url" placeholder="https://…" value={dividendDraft.manualSourceUrl ?? ""} onChange={(event) => setDividendDraft({ ...dividendDraft, manualSourceUrl: event.target.value })} /></label>
                <div className="developer-edit-actions"><button className="button button-secondary" type="button" onClick={() => { setDividendDraft(null); setIsNewCalendarEntry(false); }}>Cancel</button><button className="button button-primary" type="submit" disabled={busy || !storage?.editable}>{busy ? "Publishing…" : isNewCalendarEntry ? "Add to calendar" : "Save dividend update"} <Check size={14} /></button></div>
              </form>
            </section>}
            {loading ? (
              <div className="developer-empty">Loading dividend data…</div>
            ) : matchingCompanies.length ? (
              <>
                <div className="developer-company-list">
                  {visibleMatchingCompanies.map((company) => (
                    <div className="developer-company-row" key={company.symbol}>
                      <span className="company-logo">{(company.exchangeSymbol ?? company.symbol).slice(0, 2)}</span>
                      <span className="developer-company-copy">
                        <b>{company.name}</b>
                        <small>
                          {company.sourceExchange ? `${company.sourceExchange} ${company.exchangeSymbol} · ` : ""}
                          Ex-date {company.exDate || "not provided"}
                          {company.manualUpdateAt
                            ? ` · Manually updated ${formatSyncDate(company.manualUpdateAt)}`
                            : company.sourceExchange
                              ? ` · Imported ${formatSyncDate(company.sourceUpdatedAt ?? null)}`
                              : " · Sample record"}
                        </small>
                      </span>
                      <span className="developer-company-value">
                        {company.dividend === null ? "Amount unavailable" : `₹${company.dividend.toFixed(2)} / share`}
                        {" · "}
                        {company.yield === null ? "Yield unavailable" : `${company.yield.toFixed(2)}% yield`}
                      </span>
                      <button
                        className="button button-secondary button-small"
                        aria-label={`Edit ${company.name} dividend update`}
                        title={storage?.editable ? `Edit ${company.name}` : "Persistent storage is not available"}
                        disabled={!storage?.editable || busy}
                        onClick={() => { setIsNewCalendarEntry(false); setDividendDraft({ ...company }); setError(""); setNotice(""); }}
                      >
                        <Pencil size={13} /> Update
                      </button>
                    </div>
                  ))}
                </div>
                {matchingCompanies.length > visibleMatchingCompanies.length && <div className="developer-empty">Showing the first 100 matches. Search by company or exchange symbol to narrow the list.</div>}
              </>
            ) : (
              <div className="developer-empty">No companies match the search. Try a different name or exchange symbol.</div>
            )}
          </section>
          <div className="developer-disclaimer"><ShieldCheck size={16} /><span>Manually entered dividend details are marked on the public company page and are not independently verified. Confirm every figure and date against the linked official disclosure.</span></div>
        </>}
        <footer className="developer-footer">DNX INDICATES · PRIVATE DEVELOPER WORKSPACE</footer>
      </div>
    </main>
  </div>;
}
