"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import type { AuthenticatedUser, ModelPrice } from "@/types";

interface AuthGateProps {
  children: (props: {
    token: string;
    user: AuthenticatedUser;
    modelPrices: ModelPrice[];
    refreshSession: () => Promise<void>;
    logout: () => void;
  }) => React.ReactNode;
}

const TOKEN_STORAGE_KEY = "image_ai_session_token";

export function AuthGate({ children }: AuthGateProps) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [modelPrices, setModelPrices] = useState<ModelPrice[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setToken("");
    setUser(null);
    setModelPrices([]);
  }, []);

  const clearStoredSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    clearSession();
  }, [clearSession]);

  const logout = useCallback(() => {
    clearStoredSession();
    setPassword("");
    setError("");
  }, [clearStoredSession]);

  const loadSession = useCallback(async (nextToken: string) => {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${nextToken}` },
    });
    if (!res.ok) {
      throw new Error("Session expired");
    }
    const data = (await res.json()) as {
      user: AuthenticatedUser;
      modelPrices?: ModelPrice[];
    };
    setToken(nextToken);
    setUser(data.user);
    setModelPrices(data.modelPrices || []);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      await loadSession(token);
    } catch (error) {
      clearStoredSession();
      throw error;
    }
  }, [clearStoredSession, loadSession, token]);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    void loadSession(storedToken)
      .catch(() => {
        clearStoredSession();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [clearStoredSession, loadSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            token?: string;
            error?: string;
          }
        | null;

      if (!res.ok || !data?.token) {
        throw new Error(data?.error || "Login failed");
      }

      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      await loadSession(data.token);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      clearStoredSession();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
      </div>
    );
  }

  if (token && user) {
    const sessionProps = {
      token,
      user,
      modelPrices,
      refreshSession,
      logout,
    };

    return <>{children(sessionProps)}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-xl">
        <div className="text-center space-y-2">
          <div className="inline-flex rounded-full bg-gray-100 p-3">
            <Lock className="w-6 h-6 text-gray-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
          <p className="text-gray-500">Use your Image AI account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password}
            className="w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
