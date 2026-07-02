"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Save } from "lucide-react";

interface AdminUser {
  id: string;
  username: string;
  balance: number;
  createdAt: string;
}

type ApiErrorBody = {
  error?: string;
};

async function readApiError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as ApiErrorBody | null;
  if (data?.error && typeof data.error === "string") {
    return data.error;
  }

  return fallback;
}

export function AdminUserManager({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState(0);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"idle" | "success" | "error">("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const createdAtFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    []
  );

  const clearMessage = useCallback(() => {
    setMessage("");
    setMessageTone("idle");
  }, []);

  const showMessage = useCallback(
    (nextMessage: string, tone: "success" | "error" = "success") => {
      setMessage(nextMessage);
      setMessageTone(tone);
    },
    []
  );

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    clearMessage();

    try {
      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to load users"));
      }

      const data = (await response.json()) as { users?: AdminUser[] };
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Failed to load users", "error");
    } finally {
      setIsLoading(false);
    }
  }, [clearMessage, showMessage, token]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password || !Number.isInteger(balance) || balance < 0) {
      showMessage("Enter a username, password, and non-negative whole-number balance.", "error");
      return;
    }

    setIsCreating(true);
    clearMessage();

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
          balance,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            user?: AdminUser;
            error?: string;
          }
        | null;

      if (!response.ok || !data?.user) {
        throw new Error(data?.error || "Failed to create user");
      }

      const createdUser = data.user;
      setUsers((prev) => [createdUser, ...prev.filter((user) => user.id !== createdUser.id)]);
      setUsername("");
      setPassword("");
      setBalance(0);
      showMessage("User created.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Failed to create user", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const updateBalance = async (user: AdminUser) => {
    if (!Number.isInteger(user.balance) || user.balance < 0) {
      showMessage("Balance must be a non-negative whole number.", "error");
      return;
    }

    setSavingUserId(user.id);
    clearMessage();

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          balance: user.balance,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            user?: AdminUser;
            error?: string;
          }
        | null;

      if (!response.ok || !data?.user) {
        throw new Error(data?.error || "Failed to update balance");
      }

      const updatedUser = data.user;
      setUsers((prev) => prev.map((item) => (item.id === user.id ? updatedUser : item)));
      showMessage(`Updated ${user.username}'s balance.`);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Failed to update balance", "error");
    } finally {
      setSavingUserId(null);
    }
  };

  const isFormDisabled = isCreating || isLoading;
  const canCreateUser =
    !isFormDisabled && username.trim().length > 0 && password.length > 0 && Number.isInteger(balance) && balance >= 0;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 text-gray-900 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="border-b border-gray-200 pb-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Admin user manager</h1>
            <p className="text-sm text-gray-500">Create accounts and adjust balances.</p>
          </div>
        </header>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Create user</h2>
              <p className="text-sm text-gray-500">New users are added to the top of the list.</p>
            </div>
          </div>

          <form onSubmit={createUser} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_auto]">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Username</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                placeholder="Username"
                className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Password"
                className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Balance</span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={balance}
                onChange={(event) => setBalance(Number(event.target.value))}
                className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
              />
            </label>

            <button
              type="submit"
              disabled={!canCreateUser}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          </form>

          {message && (
            <p
              role="status"
              aria-live="polite"
              className={`mt-3 text-sm ${
                messageTone === "error" ? "text-red-600" : messageTone === "success" ? "text-emerald-700" : "text-gray-600"
              }`}
            >
              {message}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Users</h2>
              <p className="text-sm text-gray-500">{users.length} account{users.length === 1 ? "" : "s"} total</p>
            </div>

            <button
              type="button"
              onClick={() => void loadUsers()}
              disabled={isLoading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Refresh users"
              aria-label="Refresh users"
            >
              <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-gray-500">
                  <th className="border-b border-gray-200 px-0 py-3 font-medium">Username</th>
                  <th className="border-b border-gray-200 px-0 py-3 font-medium">Created</th>
                  <th className="border-b border-gray-200 px-0 py-3 font-medium">Balance</th>
                  <th className="border-b border-gray-200 px-0 py-3 text-right font-medium">Save</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && users.length === 0 ? (
                  <tr>
                    <td className="border-b border-gray-100 py-6 text-gray-500" colSpan={4}>
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td className="border-b border-gray-100 py-6 text-gray-500" colSpan={4}>
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isSaving = savingUserId === user.id;

                    return (
                      <tr key={user.id} className="align-middle">
                        <td className="border-b border-gray-100 py-3 pr-4 font-medium text-gray-900">
                          <span className="block min-w-0 truncate">{user.username}</span>
                        </td>
                        <td className="border-b border-gray-100 py-3 pr-4 text-gray-600">
                          {createdAtFormatter.format(new Date(user.createdAt))}
                        </td>
                        <td className="border-b border-gray-100 py-3 pr-4">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            value={user.balance}
                            onChange={(event) => {
                              const nextBalance = Number(event.target.value);
                              setUsers((prev) =>
                                prev.map((item) =>
                                  item.id === user.id ? { ...item, balance: nextBalance } : item
                                )
                              );
                            }}
                            className="h-10 w-32 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
                          />
                        </td>
                        <td className="border-b border-gray-100 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void updateBalance(user)}
                            disabled={isSaving}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            title={`Save balance for ${user.username}`}
                            aria-label={`Save balance for ${user.username}`}
                          >
                            <Save className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
