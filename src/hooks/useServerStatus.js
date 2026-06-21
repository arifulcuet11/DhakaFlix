import { useState, useEffect } from "react";

const PROXY = "http://localhost:3001";

export function useServerStatus() {
  const [online, setOnline] = useState(null); // null = checking

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${PROXY}/ping`, { signal: AbortSignal.timeout(2000) });
        const data = await res.json();
        if (!cancelled) setOnline(data.ok === true);
      } catch {
        if (!cancelled) setOnline(false);
      }
    }

    check();
    const interval = setInterval(check, 15000); // recheck every 15s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return online;
}

export const PROXY_URL = PROXY;
