"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DeveloperConsole from "./developer-console";

type DeveloperView = "overview" | "companies" | "dividends";
type AccessState = "checking" | "authorized" | "error";

export default function DeveloperAccess({ view }: { view: DeveloperView }) {
  const router = useRouter();
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/owner/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not verify developer access.");
        const result = await response.json() as { authenticated: boolean };
        if (cancelled) return;
        if (result.authenticated) setAccessState("authorized");
        else router.replace("/developer/login");
      })
      .catch((cause: unknown) => {
        console.error("Could not verify DNX developer access.", cause);
        if (!cancelled) setAccessState("error");
      });
    return () => { cancelled = true; };
  }, [retry, router]);

  if (accessState === "authorized") return <DeveloperConsole view={view} />;
  if (accessState === "error") {
    return <main className="developer-route-loading">
      <div>
        <p>Developer access could not be checked. Check your connection and retry.</p>
        <button className="button button-primary" type="button" onClick={() => { setAccessState("checking"); setRetry((count) => count + 1); }}>Retry</button>
      </div>
    </main>;
  }
  return <main className="developer-route-loading">Checking developer access…</main>;
}
