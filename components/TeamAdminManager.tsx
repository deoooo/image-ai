"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LogOut, Plus, Users } from "lucide-react";
import type { AuthenticatedUser } from "@/types";
import { OperationLogPanel } from "@/components/OperationLogPanel";
import { formatMoney, isValidMoney } from "@/lib/money";

type TeamAdmin = Extract<AuthenticatedUser, { role: "team_admin" }>;
type Member = { id: string; username: string; role: "user" | "team_admin"; dailyLimit: number | null; dailySpent: number; dailySpentDate: string | null };

export function TeamAdminManager({ token, user, onLogout }: { token: string; user: TeamAdmin; onLogout: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [dailyLimit, setDailyLimit] = useState(0);
  const [limits, setLimits] = useState<Record<string, string>>({}); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const [operationRefreshKey, setOperationRefreshKey] = useState(0);

  const load = useCallback(async () => {
    const response = await fetch("/api/team/users", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to load team members");
    setMembers(data.users || []);
  }, [token]);
  useEffect(() => { void load().catch((e) => setMessage(e.message)); }, [load]);

  async function createMember(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/team/users", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ username, password, dailyLimit }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Failed to create member");
      setMembers((items) => [data.user, ...items]); setUsername(""); setPassword(""); setDailyLimit(0); setMessage("Member created."); setOperationRefreshKey((value) => value + 1);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to create member"); } finally { setSaving(false); }
  }

  async function saveLimit(member: Member) {
    const value = Number(limits[member.id]); if (!isValidMoney(value)) return setMessage("Daily limit must be non-negative with at most 3 decimal places.");
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/team/users/${member.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ dailyLimit: value }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Failed to update limit");
      setMembers((items) => items.map((item) => item.id === member.id ? data.user : item)); setLimits((v) => ({ ...v, [member.id]: "" })); setMessage("Daily limit updated."); setOperationRefreshKey((value) => value + 1);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to update limit"); } finally { setSaving(false); }
  }

  const actualMembers = members.filter((member) => member.role === "user");
  return <main className="min-h-screen bg-gray-50 p-4 md:p-8"><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex items-center justify-between border-b pb-4"><div><h1 className="text-2xl font-semibold">{user.teamName}</h1><p className="text-sm text-gray-500">Team balance: <strong>{formatMoney(user.teamBalance)}</strong> · Administrator: {user.username}</p></div><button onClick={onLogout} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"><LogOut className="h-4 w-4" /> Log out</button></header>
    <section className="rounded-xl border bg-white p-5"><h2 className="mb-1 flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Create team member</h2><p className="mb-4 text-sm text-gray-500">The daily limit resets at midnight in Asia/Shanghai.</p>
      <form onSubmit={createMember} className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]"><input aria-label="Member username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="h-11 rounded-lg border px-3" /><input aria-label="Member password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="h-11 rounded-lg border px-3" /><input type="number" min="0" step="0.001" value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} aria-label="Daily limit" className="h-11 rounded-lg border px-3" /><button disabled={saving || !username.trim() || !password} className="rounded-lg bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-40">Create member</button></form>{message && <p role="status" className="mt-3 text-sm">{message}</p>}
    </section>
    <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Members ({actualMembers.length})</h2><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Username</th><th>Spent today</th><th>Daily limit</th><th>New limit</th><th /></tr></thead><tbody>{actualMembers.map((member) => <tr key={member.id} className="border-b"><td className="py-3 font-medium">{member.username}</td><td>{formatMoney(member.dailySpent)}</td><td>{formatMoney(member.dailyLimit ?? 0)}</td><td><input aria-label={`New daily limit for ${member.username}`} type="number" min="0" step="0.001" value={limits[member.id] || ""} onChange={(e) => setLimits((v) => ({ ...v, [member.id]: e.target.value }))} placeholder={formatMoney(member.dailyLimit ?? 0)} className="h-9 w-32 rounded-lg border px-2" /></td><td className="text-right"><button onClick={() => void saveLimit(member)} disabled={saving} className="rounded-lg border px-3 py-2 font-medium disabled:opacity-40">Save</button></td></tr>)}</tbody></table></div></section>
    <OperationLogPanel token={token} scope="team" refreshKey={operationRefreshKey} />
  </div></main>;
}
