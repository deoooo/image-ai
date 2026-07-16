"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, LoaderCircle, RefreshCw } from "lucide-react";
import { normalizeMoney } from "@/lib/money";

type OperationLog = {
  id: string;
  actorUsername: string;
  teamName: string | null;
  action: string;
  targetName: string;
  amount: number | null;
  previousValue: number | null;
  newValue: number | null;
  createdAt: string;
};

const actionLabels: Record<string, string> = {
  team_created: "Created team",
  team_admin_created: "Added team administrator",
  team_balance_credited: "Recharged team balance",
  team_balance_debited: "Deducted team balance",
  team_member_created: "Created team member",
  member_daily_limit_updated: "Updated daily limit",
  user_created: "Created user",
  user_balance_credited: "Recharged user balance",
  user_balance_debited: "Deducted user balance",
};

function describeChange(operation: OperationLog, numberFormat: Intl.NumberFormat) {
  if (operation.amount != null) return numberFormat.format(normalizeMoney(operation.amount));
  if (operation.previousValue != null && operation.newValue != null) {
    return `${numberFormat.format(normalizeMoney(operation.previousValue))} → ${numberFormat.format(normalizeMoney(operation.newValue))}`;
  }
  if (operation.newValue != null) return numberFormat.format(normalizeMoney(operation.newValue));
  return "—";
}

export function OperationLogPanel({
  token,
  scope,
  refreshKey = 0,
}: {
  token: string;
  scope: "admin" | "team";
  refreshKey?: number;
}) {
  const [operations, setOperations] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }), []);
  const numberFormat = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/${scope}/operations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as { operations?: OperationLog[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to load operation history");
      setOperations(Array.isArray(data?.operations) ? data.operations : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load operation history");
    } finally {
      setLoading(false);
    }
  }, [scope, token]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><History className="h-4 w-4" /> Operation history</h2>
          <p className="text-sm text-gray-500">{scope === "admin" ? "Latest administrator activity across users and teams." : "Latest administrator activity for this team."}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh operation history" title="Refresh operation history" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="border-b border-gray-200 text-gray-500"><th className="py-3 pr-4 font-medium">Time</th><th className="pr-4 font-medium">Operator</th>{scope === "admin" && <th className="pr-4 font-medium">Team</th>}<th className="pr-4 font-medium">Action</th><th className="pr-4 font-medium">Target</th><th className="text-right font-medium">Amount / change</th></tr></thead>
            <tbody>
              {loading && operations.length === 0 ? <tr><td colSpan={scope === "admin" ? 6 : 5} className="py-6 text-gray-500"><span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading operation history...</span></td></tr> :
                operations.length === 0 ? <tr><td colSpan={scope === "admin" ? 6 : 5} className="py-6 text-gray-500">No operation history yet.</td></tr> :
                operations.map((operation) => <tr key={operation.id} className="border-b border-gray-100 last:border-0"><td className="whitespace-nowrap py-3 pr-4 text-gray-600">{dateFormat.format(new Date(operation.createdAt))}</td><td className="pr-4 font-medium">{operation.actorUsername}</td>{scope === "admin" && <td className="pr-4 text-gray-600">{operation.teamName || "Independent users"}</td>}<td className="pr-4">{actionLabels[operation.action] || operation.action}</td><td className="pr-4 font-medium">{operation.targetName}</td><td className="text-right tabular-nums">{describeChange(operation, numberFormat)}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
