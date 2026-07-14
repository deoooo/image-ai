import { beforeEach, describe, expect, test, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  ApiAuthError: class extends Error {
    constructor(message: string, public status = 401) { super(message); }
  },
  requireAdmin: vi.fn(),
  requireTeamAdmin: vi.fn(),
}));

const dataMock = vi.hoisted(() => ({
  SupabaseDataError: class extends Error {
    constructor(message: string, public code: string) { super(message); }
  },
  createTeamWithAdmin: vi.fn(),
  listTeams: vi.fn(),
  createTeamUser: vi.fn(),
  listTeamUsers: vi.fn(),
  updateTeamUserDailyLimit: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => authMock);
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn(async () => "hashed") }));
vi.mock("@/lib/supabase-data", () => dataMock);

import { POST as createTeam } from "@/app/api/admin/teams/route";
import { GET as listTeamUsers, POST as createTeamUser } from "@/app/api/team/users/route";
import { PATCH as updateLimit } from "@/app/api/team/users/[id]/route";

describe("team management routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.requireAdmin.mockReturnValue({ role: "admin", username: "lynn" });
    authMock.requireTeamAdmin.mockReturnValue({
      role: "team_admin", userId: "admin_1", username: "owner", teamId: "team_1",
    });
  });

  test("super admin creates a team and its first administrator atomically", async () => {
    dataMock.createTeamWithAdmin.mockResolvedValue({
      team: { id: "team_1", name: "Design", balance: 20 },
      admin: { id: "admin_1", username: "owner" },
    });
    const response = await createTeam(new Request("http://localhost/api/admin/teams", {
      method: "POST",
      body: JSON.stringify({ name: " Design ", balance: 20, adminUsername: " owner ", adminPassword: "secret" }),
    }));

    expect(response.status).toBe(201);
    expect(dataMock.createTeamWithAdmin).toHaveBeenCalledWith({
      name: "Design", balance: 20, adminUsername: "owner", adminPasswordHash: "hashed",
    });
  });

  test("explains when the first administrator username is reserved", async () => {
    const response = await createTeam(new Request("http://localhost/api/admin/teams", {
      method: "POST",
      body: JSON.stringify({ name: "Design", balance: 0, adminUsername: " LyNn ", adminPassword: "secret" }),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "The administrator username “LyNn” is reserved. Choose another username.",
    });
    expect(dataMock.createTeamWithAdmin).not.toHaveBeenCalled();
  });

  test("team administrator only lists users from the team in the session", async () => {
    dataMock.listTeamUsers.mockResolvedValue([]);
    const response = await listTeamUsers(new Request("http://localhost/api/team/users"));
    expect(response.status).toBe(200);
    expect(dataMock.listTeamUsers).toHaveBeenCalledWith("team_1");
  });

  test("team administrator creates a member with a daily limit", async () => {
    dataMock.createTeamUser.mockResolvedValue({ id: "member_1", username: "alice", dailyLimit: 3 });
    const response = await createTeamUser(new Request("http://localhost/api/team/users", {
      method: "POST",
      body: JSON.stringify({ username: "alice", password: "secret", dailyLimit: 3 }),
    }));
    expect(response.status).toBe(201);
    expect(dataMock.createTeamUser).toHaveBeenCalledWith({
      teamId: "team_1", username: "alice", passwordHash: "hashed", dailyLimit: 3,
    });
  });

  test("daily-limit updates are scoped to the administrator team", async () => {
    dataMock.updateTeamUserDailyLimit.mockResolvedValue({ id: "member_1", dailyLimit: 4 });
    const response = await updateLimit(new Request("http://localhost/api/team/users/member_1", {
      method: "PATCH", body: JSON.stringify({ dailyLimit: 4 }),
    }), { params: Promise.resolve({ id: "member_1" }) });
    expect(response.status).toBe(200);
    expect(dataMock.updateTeamUserDailyLimit).toHaveBeenCalledWith("team_1", "member_1", 4);
  });
});
