import { verifySessionToken, type Session } from "@/lib/auth";

export class ApiAuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

export function getSessionFromRequest(req: Request): Session | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return verifySessionToken(header.slice("Bearer ".length));
}

export function requireSession(req: Request): Session {
  const session = getSessionFromRequest(req);
  if (!session) throw new ApiAuthError("Unauthorized", 401);
  return session;
}

export function requireAdmin(req: Request): Extract<Session, { role: "admin" }> {
  const session = requireSession(req);
  if (session.role !== "admin") throw new ApiAuthError("Forbidden", 403);
  return session;
}

export function requireUser(req: Request): Extract<Session, { role: "user" }> {
  const session = requireSession(req);
  if (session.role !== "user") throw new ApiAuthError("Forbidden", 403);
  return session;
}

export function requireTeamAdmin(
  req: Request
): Extract<Session, { role: "team_admin" }> {
  const session = requireSession(req);
  if (session.role !== "team_admin") throw new ApiAuthError("Forbidden", 403);
  return session;
}
