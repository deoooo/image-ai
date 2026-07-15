import { beforeEach, describe, expect, test, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  ApiAuthError: class extends Error {
    constructor(message: string, public status = 401) { super(message); }
  },
  requireAdmin: vi.fn(),
  requireTeamAdmin: vi.fn(),
}));

const dataMock = vi.hoisted(() => ({ listOperationLogs: vi.fn() }));

vi.mock("@/lib/api-auth", () => authMock);
vi.mock("@/lib/supabase-data", () => dataMock);

import { GET as listAdminOperations } from "@/app/api/admin/operations/route";
import { GET as listTeamOperations } from "@/app/api/team/operations/route";

describe("operation history routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.requireAdmin.mockReturnValue({ role: "admin", username: "lynn" });
    authMock.requireTeamAdmin.mockReturnValue({ role: "team_admin", userId: "admin_1", username: "owner", teamId: "team_1" });
    dataMock.listOperationLogs.mockResolvedValue([]);
  });

  test("super administrator can list operations across all teams", async () => {
    const response = await listAdminOperations(new Request("http://localhost/api/admin/operations"));
    expect(response.status).toBe(200);
    expect(dataMock.listOperationLogs).toHaveBeenCalledWith();
  });

  test("team administrator operation history is scoped to the session team", async () => {
    const response = await listTeamOperations(new Request("http://localhost/api/team/operations"));
    expect(response.status).toBe(200);
    expect(dataMock.listOperationLogs).toHaveBeenCalledWith("team_1");
  });

  test("team operation history rejects non-team sessions", async () => {
    authMock.requireTeamAdmin.mockImplementationOnce(() => {
      throw new authMock.ApiAuthError("Forbidden", 403);
    });
    const response = await listTeamOperations(new Request("http://localhost/api/team/operations"));
    expect(response.status).toBe(403);
    expect(dataMock.listOperationLogs).not.toHaveBeenCalled();
  });
});
