import { useEffect, useState } from 'react';

export interface MiddlewareActivityRow {
  at: string;
  kind: string;
  source?: string;
  transactionRef?: string;
  phoneNumber?: string;
  amount?: number;
  scenario?: string;
  decision?: string;
  riskScore?: number;
  explanation?: string;
  txn_id?: string;
  settlement?: string;
  [key: string]: unknown;
}

/**
 * Polls middleware `/api/activity` when dashboard live mode runs (proxied via Vite).
 */
export function useMiddlewareActivity(enabled: boolean): MiddlewareActivityRow[] {
  const [entries, setEntries] = useState<MiddlewareActivityRow[]>([]);

  useEffect(() => {
    if (!enabled) {
      setEntries([]);
      return;
    }

    let cancelled = false;

    const fetchActivity = (): void => {
      void fetch('/api/activity')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { entries?: MiddlewareActivityRow[] }) => {
          if (!cancelled && Array.isArray(j.entries)) {
            setEntries(j.entries as MiddlewareActivityRow[]);
          }
        })
        .catch(() => {
          /* noisy network during dev — ignore */
        });
    };

    fetchActivity();
    const id = window.setInterval(fetchActivity, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return entries;
}
