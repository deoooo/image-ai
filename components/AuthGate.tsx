"use client";

import React, { useState, useEffect } from "react";
import { Lock } from "lucide-react";

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check local storage on mount
    const storedKey = localStorage.getItem("image_ai_access_key");
    if (storedKey) {
      verifyKey(storedKey);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyKey = async (key: string) => {
    try {
      // We verify by making a lightweight API call or just checking if it works
      // For simplicity, we'll assume if the API accepts it, it's valid.
      // But since we don't have a dedicated "verify" endpoint, we can just save it
      // and let the first API call fail if it's wrong.
      // However, for better UX, let's add a verify endpoint or just trust the user 
      // until they try to generate. 
      
      // Actually, let's add a simple verify endpoint to be sure.
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });

      if (res.ok) {
        setIsAuthenticated(true);
        localStorage.setItem("image_ai_access_key", key);
        setError("");
      } else {
        setError("Invalid access key");
        localStorage.removeItem("image_ai_access_key");
      }
    } catch (err) {
      setError("Failed to verify key");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    verifyKey(accessKey);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-gray-100 rounded-full">
            <Lock className="w-6 h-6 text-gray-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Access Required</h1>
          <p className="text-gray-500">Please enter your access key to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="Enter access key"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={!accessKey}
            className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
