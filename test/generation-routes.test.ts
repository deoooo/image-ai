import { beforeEach, describe, expect, test, vi } from "vitest";
import type { HandleUploadBody } from "@vercel/blob/client";

const apiAuthMock = vi.hoisted(() => ({
  ApiAuthError: class extends Error {
    constructor(message: string, public status = 401) {
      super(message);
    }
  },
  requireUser: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  validateAccessKey: vi.fn(),
}));

const billingMock = vi.hoisted(() => ({
  BillingError: class extends Error {
    constructor(message: string, public status = 400) {
      super(message);
    }
  },
  chargeForGeneration: vi.fn(),
  refundGeneration: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  generation: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

const grsaiMock = vi.hoisted(() => ({
  draw: vi.fn(),
  getResult: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  from: vi.fn(),
}));

const uploadMock = vi.hoisted(() => ({
  handleUpload: vi.fn(),
}));

const r2Mock = vi.hoisted(() => ({
  getPresignedUrl: vi.fn(),
  uploadToR2: vi.fn(),
}));

const httpMock = vi.hoisted(() => ({
  fetchWithProxy: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  ApiAuthError: apiAuthMock.ApiAuthError,
  requireUser: apiAuthMock.requireUser,
}));

vi.mock("@/lib/auth", () => ({
  validateAccessKey: authMock.validateAccessKey,
}));

vi.mock("@/lib/billing", () => ({
  BillingError: billingMock.BillingError,
  chargeForGeneration: billingMock.chargeForGeneration,
  refundGeneration: billingMock.refundGeneration,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/grsai", () => ({
  GrsaiClient: class {
    draw = grsaiMock.draw;
    getResult = grsaiMock.getResult;
  },
}));

vi.mock("@vercel/blob/client", () => ({
  handleUpload: uploadMock.handleUpload,
}));

vi.mock("@/lib/r2", () => ({
  getPresignedUrl: r2Mock.getPresignedUrl,
  uploadToR2: r2Mock.uploadToR2,
}));

vi.mock("@/lib/http", () => ({
  fetchWithProxy: httpMock.fetchWithProxy,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: supabaseMock.from,
  },
}));

import { POST as generatePost } from "@/app/api/generate/route";
import { POST as statusPost } from "@/app/api/generate/status/route";
import { GET as historyGet } from "@/app/api/history/route";
import { POST as uploadPost } from "@/app/api/upload/route";
import { POST as presignedPost } from "@/app/api/upload/presigned/route";

function createUserRequest(url: string, init?: RequestInit): Request {
  return new Request(url, {
    ...init,
    headers: {
      authorization: "Bearer session-token",
      "x-access-key": "legacy-key",
      ...(init?.headers || {}),
    },
  });
}

describe("generation-related API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    apiAuthMock.requireUser.mockReturnValue({
      role: "user",
      userId: "user_1",
      username: "alice",
    });
    authMock.validateAccessKey.mockReturnValue(true);
    billingMock.chargeForGeneration.mockResolvedValue({
      generationId: "gen_1",
      priceCharged: 3,
      balance: 7,
    });
    billingMock.refundGeneration.mockResolvedValue({
      refunded: true,
      balance: 10,
    });
    supabaseMock.insert.mockResolvedValue({ error: null });
    supabaseMock.update.mockReturnValue({ eq: supabaseMock.eq });
    supabaseMock.eq.mockResolvedValue({ error: null });
    supabaseMock.select.mockReturnValue({ eq: supabaseMock.eq, order: supabaseMock.order });
    supabaseMock.order.mockReturnValue({ limit: supabaseMock.limit });
    supabaseMock.limit.mockResolvedValue({ data: [], error: null });
    supabaseMock.from.mockImplementation(() => ({
      insert: supabaseMock.insert,
      update: supabaseMock.update,
      select: supabaseMock.select,
    }));
    prismaMock.generation.findFirst.mockResolvedValue({
      id: "gen_1",
      userId: "user_1",
      taskId: "task_1",
    });
    prismaMock.generation.findMany.mockResolvedValue([]);
    prismaMock.generation.update.mockResolvedValue({});
    grsaiMock.draw.mockResolvedValue("task_1");
    grsaiMock.getResult.mockResolvedValue({
      id: "task_1",
      status: "running",
      progress: 30,
      results: null,
    });
    uploadMock.handleUpload.mockResolvedValue({
      ok: true,
      uploadUrl: "https://blob.example/upload",
    });
    r2Mock.getPresignedUrl.mockResolvedValue({
      uploadUrl: "https://r2.example/upload",
      publicUrl: "https://cdn.example/image.png",
    });
    r2Mock.uploadToR2.mockResolvedValue("https://cdn.example/generated.png");
    httpMock.fetchWithProxy.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" },
      })
    );
  });

  test("generate charges the user, persists the task id, and streams billing metadata", async () => {
    const response = await generatePost(
      createUserRequest("http://localhost/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "paint a red fox" }),
      })
    );

    const body = await response.text();
    const lines = body
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const resultLine = lines.find((line) => line.type === "result");

    expect(response.status).toBe(200);
    expect(apiAuthMock.requireUser).toHaveBeenCalledTimes(1);
    expect(billingMock.chargeForGeneration).toHaveBeenCalledWith({
      userId: "user_1",
      prompt: "paint a red fox",
      model: "nano-banana-pro",
    });
    expect(prismaMock.generation.update).toHaveBeenCalledWith({
      where: { id: "gen_1" },
      data: { taskId: "task_1", status: "pending" },
    });
    expect(resultLine).toMatchObject({
      type: "result",
      taskId: "task_1",
      generationId: "gen_1",
      status: "pending",
      balance: 7,
      priceCharged: 3,
    });
  });

  test("status refunds the owned generation when the provider reports failure", async () => {
    grsaiMock.getResult.mockResolvedValueOnce({
      id: "task_1",
      status: "failed",
      progress: 100,
      results: null,
      failure_reason: "provider failed",
    });

    const response = await statusPost(
      createUserRequest("http://localhost/api/generate/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: "task_1" }),
      })
    );

    expect(response.status).toBe(200);
    expect(apiAuthMock.requireUser).toHaveBeenCalledTimes(1);
    expect(prismaMock.generation.findFirst).toHaveBeenCalledWith({
      where: { taskId: "task_1", userId: "user_1" },
    });
    expect(billingMock.refundGeneration).toHaveBeenCalledWith("gen_1");
    expect(await response.json()).toEqual({
      id: "task_1",
      status: "failed",
      progress: 100,
      results: null,
      failure_reason: "provider failed",
      balance: 10,
    });
  });

  test("status rewrites successful results to the R2 url and persists it", async () => {
    grsaiMock.getResult.mockResolvedValueOnce({
      id: "task_1",
      status: "succeeded",
      progress: 100,
      results: [{ url: "https://provider.example/raw.png", content: "" }],
    });

    const response = await statusPost(
      createUserRequest("http://localhost/api/generate/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: "task_1" }),
      })
    );

    expect(response.status).toBe(200);
    expect(httpMock.fetchWithProxy).toHaveBeenCalledWith(
      "https://provider.example/raw.png"
    );
    expect(r2Mock.uploadToR2).toHaveBeenCalledWith(
      expect.stringMatching(/^generations\/\d{4}-\d{2}-\d{2}\/task_1\.png$/),
      expect.any(Buffer),
      "image/png"
    );
    expect(prismaMock.generation.update).toHaveBeenCalledWith({
      where: { id: "gen_1" },
      data: {
        status: "succeeded",
        imageUrl: "https://cdn.example/generated.png",
      },
    });
    expect(await response.json()).toEqual({
      id: "task_1",
      status: "succeeded",
      progress: 100,
      results: [{ url: "https://cdn.example/generated.png", content: "" }],
    });
  });

  test("history returns only the authenticated user's persisted generations", async () => {
    prismaMock.generation.findMany.mockResolvedValueOnce([
      {
        id: "gen_1",
        taskId: null,
        prompt: "paint a skyline",
        model: "nano-banana-pro",
        imageUrl: "https://cdn.example/image.png",
        createdAt: new Date("2026-07-02T10:00:00.000Z"),
      },
    ]);

    const response = await historyGet(
      createUserRequest("http://localhost/api/history")
    );

    expect(response.status).toBe(200);
    expect(apiAuthMock.requireUser).toHaveBeenCalledTimes(1);
    expect(prismaMock.generation.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        status: "succeeded",
        imageUrl: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    expect(await response.json()).toEqual([
      {
        id: "gen_1",
        url: "https://cdn.example/image.png",
        prompt: "paint a skyline",
        model: "nano-banana-pro",
        createdAt: 1782986400000,
      },
    ]);
  });

  test("upload uses bearer auth before delegating to the Vercel blob helper", async () => {
    const request = createUserRequest("http://localhost/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "blob.generate-client-token" } satisfies Partial<HandleUploadBody>),
    });

    const response = await uploadPost(request);

    expect(response.status).toBe(200);
    expect(apiAuthMock.requireUser).toHaveBeenCalledTimes(1);
    expect(uploadMock.handleUpload).toHaveBeenCalledTimes(1);

    const args = uploadMock.handleUpload.mock.calls[0]?.[0] as {
      onBeforeGenerateToken: () => Promise<{
        allowedContentTypes: string[];
        tokenPayload: string;
      }>;
    };
    const tokenConfig = await args.onBeforeGenerateToken();

    expect(tokenConfig).toEqual({
      allowedContentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      tokenPayload: JSON.stringify({}),
    });
  });

  test("presigned upload requires a user session and returns the R2 URLs", async () => {
    const response = await presignedPost(
      createUserRequest("http://localhost/api/upload/presigned", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: "uploads/example.png",
          contentType: "image/png",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(apiAuthMock.requireUser).toHaveBeenCalledTimes(1);
    expect(r2Mock.getPresignedUrl).toHaveBeenCalledWith(
      "uploads/example.png",
      "image/png"
    );
    expect(await response.json()).toEqual({
      uploadUrl: "https://r2.example/upload",
      publicUrl: "https://cdn.example/image.png",
    });
  });
});
