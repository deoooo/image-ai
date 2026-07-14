"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, Plus, RefreshCw } from "lucide-react";

type Team = { id: string; name: string; balance: number; createdAt: string };

export function TeamManagementPanel({ token }: { token: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState(0);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [adminForms, setAdminForms] = useState<Record<string, { username: string; password: string }>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

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
      setMessage(error instanceof Error ? error.message : "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  async function createTeam(event: FormEvent) {
    event.preventDefault();
    setSaving("create"); setMessage("");
    try {
      const data = await request("/api/admin/teams", {
        method: "POST",
        body: JSON.stringify({ name, balance, adminUsername, adminPassword }),
      });
      setTeams((current) => [data?.team as Team, ...current]);
      setName(""); setBalance(0); setAdminUsername(""); setAdminPassword("");
      setMessage("Team and team administrator created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create team");
    } finally { setSaving(null); }
  }

  async function recharge(team: Team) {
    const amount = Number(amounts[team.id]);
    if (!Number.isFinite(amount) || amount <= 0) return setMessage("Recharge amount must be greater than zero.");
    setSaving(team.id); setMessage("");
    try {
      const data = await request(`/api/admin/teams/${team.id}`, {
        method: "PATCH", body: JSON.stringify({ amount, operation: "credit" }),
      });
      setTeams((current) => current.map((item) => item.id === team.id ? data?.team as Team : item));
      setAmounts((current) => ({ ...current, [team.id]: "" }));
      setMessage(`Recharged ${amount} to ${team.name}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Recharge failed"); }
    finally { setSaving(null); }
  }

  async function addAdmin(team: Team) {
    const form = adminForms[team.id] || { username: "", password: "" };
    if (!form.username.trim() || !form.password) return setMessage("Enter an administrator username and password.");
    setSaving(`admin-${team.id}`); setMessage("");
    try {
      await request(`/api/admin/teams/${team.id}/admins`, {
        method: "POST", body: JSON.stringify(form),
      });
      setAdminForms((current) => ({ ...current, [team.id]: { username: "", password: "" } }));
      setMessage(`Team administrator ${form.username.trim()} created.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to add administrator"); }
    finally { setSaving(null); }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div><h2 className="flex items-center gap-2 text-base font-semibold"><Building2 className="h-4 w-4" /> Teams</h2>
          <p className="text-sm text-gray-500">Create teams, assign administrators, and recharge the shared balance.</p></div>
        <button onClick={() => void load()} aria-label="Refresh teams" className="rounded-lg border p-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      <form onSubmit={createTeam} className="grid gap-3 lg:grid-cols-5">
        <input aria-label="Team name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" className="h-11 rounded-lg border px-3" />
        <input aria-label="Initial team balance" type="number" min="0" step="0.001" value={balance} onChange={(e) => setBalance(Number(e.target.value))} placeholder="Initial balance" className="h-11 rounded-lg border px-3" />
        <input aria-label="First team administrator username" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="Admin username" className="h-11 rounded-lg border px-3" />
        <input aria-label="First team administrator password" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Admin password" className="h-11 rounded-lg border px-3" />
        <button disabled={saving === "create" || !name.trim() || !adminUsername.trim() || !adminPassword} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-40"><Plus className="h-4 w-4" /> Create team</button>
      </form>
      {message && <p role="status" className="mt-3 text-sm text-gray-700">{message}</p>}
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {teams.map((team) => {
          const adminForm = adminForms[team.id] || { username: "", password: "" };
          return <article key={team.id} className="rounded-xl border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">{team.name}</h3><p className="text-xs text-gray-500">Shared team balance</p></div><strong className="text-lg tabular-nums">{team.balance}</strong></div>
            <div className="flex gap-2">
              <input aria-label={`Recharge amount for ${team.name}`} type="number" min="0.001" step="0.001" value={amounts[team.id] || ""} onChange={(e) => setAmounts((v) => ({ ...v, [team.id]: e.target.value }))} placeholder="Recharge amount" className="h-10 min-w-0 flex-1 rounded-lg border px-3" />
              <button onClick={() => void recharge(team)} disabled={saving === team.id} className="rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-40">Recharge</button>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2 border-t pt-3">
              <input aria-label={`New administrator username for ${team.name}`} value={adminForm.username} onChange={(e) => setAdminForms((v) => ({ ...v, [team.id]: { ...adminForm, username: e.target.value } }))} placeholder="New admin" className="h-10 min-w-0 rounded-lg border px-3" />
              <input aria-label={`New administrator password for ${team.name}`} type="password" value={adminForm.password} onChange={(e) => setAdminForms((v) => ({ ...v, [team.id]: { ...adminForm, password: e.target.value } }))} placeholder="Password" className="h-10 min-w-0 rounded-lg border px-3" />
              <button onClick={() => void addAdmin(team)} disabled={saving === `admin-${team.id}`} className="rounded-lg border px-3 text-sm font-medium disabled:opacity-40">Add admin</button>
            </div>
          </article>;
        })}
        {!loading && teams.length === 0 && <p className="text-sm text-gray-500">No teams yet.</p>}
      </div>
    </section>
  );
}
