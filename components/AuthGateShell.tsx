"use client";

import type React from "react";
import { AuthGate } from "@/components/AuthGate";

interface AuthGateShellProps {
  children: React.ReactNode;
}

export function AuthGateShell({ children }: AuthGateShellProps) {
  return <AuthGate>{() => children}</AuthGate>;
}
