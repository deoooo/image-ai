"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Building2, CheckCircle2, LoaderCircle, Plus, RefreshCw } from "lucide-react";

type Team = { id: string; name: string; balance: number; createdAt: string };
type Notice = { tone: "success" | "error"; text: string } | null;

export function TeamManagementPanel({ token }: { token: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState(0);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [adminForms, setAdminForms] = useState<Record<string, { username: string; password: string }>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [adminUsernameError, setAdminUsernameError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const adminUsernameRef = useRef<HTMLInputElement>(null);
  const balanceFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }),
    []
  );

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    });
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Request failed");
    return data;
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request("/api/admin/teams");
      setTeams(Array.isArray(data?.teams) ? data.teams as Team[] : []);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Failed to load teams" });
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  async function createTeam(event: FormEvent) {
    event.preventDefault();
    setSaving("create");
    setNotice(null);
    setAdminUsernameError("");
    const teamName = name.trim();
    const administrator = adminUsername.trim();
    try {
      const data = await request("/api/admin/teams", {
        method: "POST",
        body: JSON.stringify({ name: teamName, balance, adminUsername: administrator, adminPassword }),
      });
      setTeams((current) => [data?.team as Team, ...current]);
      setName(""); setBalance(0); setAdminUsername(""); setAdminPassword("");
      setNotice({
        tone: "success",
        text: `Created team “${teamName}” and administrator “${administrator}”. The team is shown below.`,
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to create team";
      if (text.toLowerCase().includes("username") && text.toLowerCase().includes("reserved")) {
        setAdminUsernameError(text);
        requestAnimationFrame(() => adminUsernameRef.current?.focus());
      }
      setNotice({ tone: "error", text });
    } finally { setSaving(null); }
  }

  async function recharge(team: Team) {
    const amount = Number(amounts[team.id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice({ tone: "error", text: "Recharge amount must be greater than zero." });
      return;
    }
    setSaving(team.id); setNotice(null);
    try {
      const data = await request(`/api/admin/teams/${team.id}`, {
        method: "PATCH", body: JSON.stringify({ amount, operation: "credit" }),
      });
      setTeams((current) => current.map((item) => item.id === team.id ? data?.team as Team : item));
      setAmounts((current) => ({ ...current, [team.id]: "" }));
      setNotice({ tone: "success", text: `Recharged ${balanceFormatter.format(amount)} to ${team.name}.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Recharge failed" });
    } finally { setSaving(null); }
  }

  async function addAdmin(team: Team) {
    const form = adminForms[team.id] || { username: "", password: "" };
    if (!form.username.trim() || !form.password) {
      setNotice({ tone: "error", text: "Enter an administrator username and password." });
      return;
    }
    setSaving(`admin-${team.id}`); setNotice(null);
    try {
      await request(`/api/admin/teams/${team.id}/admins`, {
        method: "POST", body: JSON.stringify(form),
      });
      setAdminForms((current) => ({ ...current, [team.id]: { username: "", password: "" } }));
      setNotice({ tone: "success", text: `Team administrator “${form.username.trim()}” created.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Failed to add administrator" });
    } finally { setSaving(null); }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Building2 className="h-4 w-4" /> Teams</h2>
          <p className="text-sm text-gray-500">Create a team and its first administrator in one step.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh teams" title="Refresh teams" className="rounded-lg border p-2 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <form onSubmit={createTeam} className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-12">
        <label className="grid gap-1.5 text-sm font-medium text-gray-700 lg:col-span-3">
          Team name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Acme Design" autoComplete="off" className="h-11 rounded-lg border border-gray-200 px-3 font-normal text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700 lg:col-span-2">
          Initial team balance
          <input type="number" min="0" step="0.001" inputMode="decimal" value={balance} onChange={(event) => setBalance(Number(event.target.value))} placeholder="0" className="h-11 rounded-lg border border-gray-200 px-3 font-normal text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700 lg:col-span-3">
          Team admin username
          <input
            ref={adminUsernameRef}
            value={adminUsername}
            onChange={(event) => { setAdminUsername(event.target.value); setAdminUsernameError(""); }}
            placeholder="New administrator login"
            autoComplete="off"
            aria-invalid={Boolean(adminUsernameError)}
            aria-describedby={adminUsernameError ? "team-admin-username-help team-admin-username-error" : "team-admin-username-help"}
            className={`h-11 rounded-lg border px-3 font-normal text-gray-900 outline-none focus:ring-2 ${adminUsernameError ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-gray-200 focus:border-gray-400 focus:ring-gray-900/10"}`}
          />
          <span id="team-admin-username-help" className="text-xs font-normal text-gray-500">Create a new login; “lynn” and “deo” are unavailable.</span>
          {adminUsernameError && <span id="team-admin-username-error" className="text-xs font-normal text-red-600">{adminUsernameError}</span>}
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700 lg:col-span-2">
          Team admin password
          <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="Initial password" autoComplete="new-password" className="h-11 rounded-lg border border-gray-200 px-3 font-normal text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10" />
        </label>
        <button type="submit" disabled={saving === "create" || !name.trim() || !adminUsername.trim() || !adminPassword || !Number.isFinite(balance) || balance < 0} className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg bg-gray-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 lg:col-span-2 lg:mt-[26px]">
          {saving === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {saving === "create" ? "Creating..." : "Create team"}
        </button>
      </form>

      {notice && (
        <div role={notice.tone === "error" ? "alert" : "status"} aria-live="polite" className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {notice.tone === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {loading && teams.length === 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading teams...</div>
        )}
        {teams.map((team) => {
          const adminForm = adminForms[team.id] || { username: "", password: "" };
          return <article key={team.id} className="rounded-xl border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="font-semibold">{team.name}</h3><p className="text-xs text-gray-500">Shared team balance</p></div>
              <strong className="text-lg tabular-nums">{balanceFormatter.format(team.balance)}</strong>
            </div>
            <div className="flex gap-2">
              <input aria-label={`Recharge amount for ${team.name}`} type="number" min="0.001" step="0.001" inputMode="decimal" value={amounts[team.id] || ""} onChange={(event) => setAmounts((value) => ({ ...value, [team.id]: event.target.value }))} placeholder="Recharge amount" className="h-10 min-w-0 flex-1 rounded-lg border px-3" />
              <button type="button" onClick={() => void recharge(team)} disabled={saving === team.id} className="rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-40">{saving === team.id ? "Recharging..." : "Recharge"}</button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 border-t pt-3 sm:grid-cols-[1fr_1fr_auto]">
              <input aria-label={`New administrator username for ${team.name}`} value={adminForm.username} onChange={(event) => setAdminForms((value) => ({ ...value, [team.id]: { ...adminForm, username: event.target.value } }))} placeholder="New admin username" className="h-10 min-w-0 rounded-lg border px-3" />
              <input aria-label={`New administrator password for ${team.name}`} type="password" value={adminForm.password} onChange={(event) => setAdminForms((value) => ({ ...value, [team.id]: { ...adminForm, password: event.target.value } }))} placeholder="Initial password" className="h-10 min-w-0 rounded-lg border px-3" />
              <button type="button" onClick={() => void addAdmin(team)} disabled={saving === `admin-${team.id}`} className="rounded-lg border px-3 text-sm font-medium disabled:opacity-40">{saving === `admin-${team.id}` ? "Adding..." : "Add admin"}</button>
            </div>
          </article>;
        })}
        {!loading && teams.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500">
            <p className="font-medium text-gray-700">No teams yet</p>
            <p className="mt-1">Complete the form above to create the first team and administrator.</p>
          </div>
        )}
      </div>
    </section>
  );
}
