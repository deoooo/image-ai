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

const billingMock = vi.hoisted(() => ({
  BillingError: class extends Error {
    constructor(message: string, public status = 400) {
      super(message);
    }
  },
  chargeForGeneration: vi.fn(),
  refundGeneration: vi.fn(),
}));

const dataMock = vi.hoisted(() => ({
  attachTaskToGeneration: vi.fn(),
  findGenerationByTaskIdForUser: vi.fn(),
  markGenerationSucceeded: vi.fn(),
  listSucceededGenerations: vi.fn(),
}));

const grsaiMock = vi.hoisted(() => ({
  draw: vi.fn(),
  getResult: vi.fn(),
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

vi.mock("@/lib/billing", () => ({
  BillingError: billingMock.BillingError,
  chargeForGeneration: billingMock.chargeForGeneration,
  refundGeneration: billingMock.refundGeneration,
}));

vi.mock("@/lib/supabase-data", () => ({
  attachTaskToGeneration: dataMock.attachTaskToGeneration,
  findGenerationByTaskIdForUser: dataMock.findGenerationByTaskIdForUser,
  markGenerationSucceeded: dataMock.markGenerationSucceeded,
  listSucceededGenerations: dataMock.listSucceededGenerations,
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
      ...(init?.headers || {}),
    },
  });
}

async function readNdjson(
  response: Response
): Promise<Array<Record<string, unknown>>> {
  const body = await response.text();
  return body
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("generation-related API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    apiAuthMock.requireUser.mockReturnValue({
      role: "user",
      userId: "user_1",
      username: "alice",
    });
    billingMock.chargeForGeneration.mockResolvedValue({
      generationId: "gen_1",
      priceCharged: 3,
      balance: 7,
    });
    billingMock.refundGeneration.mockResolvedValue({
      refunded: true,
      balance: 10,
    });
    dataMock.findGenerationByTaskIdForUser.mockResolvedValue({
      id: "gen_1",
      userId: "user_1",
      taskId: "task_1",
    });
    dataMock.listSucceededGenerations.mockResolvedValue([]);
    dataMock.attachTaskToGeneration.mockResolvedValue({});
    dataMock.markGenerationSucceeded.mockResolvedValue({});
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

  test("generate rejects a legacy access-key-only request", async () => {
    apiAuthMock.requireUser.mockImplementationOnce(() => {
      throw new apiAuthMock.ApiAuthError("Unauthorized", 401);
    });

    const response = await generatePost(
      new Request("http://localhost/api/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-access-key": "legacy-key",
        },
        body: JSON.stringify({ prompt: "paint a red fox" }),
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(billingMock.chargeForGeneration).not.toHaveBeenCalled();
  });

  test("generate charges the user, persists the task id, and streams billing metadata", async () => {
    const response = await generatePost(
      createUserRequest("http://localhost/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "paint a red fox" }),
      })
    );

    const lines = await readNdjson(response);
    const resultLine = lines.find((line) => line.type === "result");

    expect(response.status).toBe(200);
    expect(apiAuthMock.requireUser).toHaveBeenCalledTimes(1);
    expect(billingMock.chargeForGeneration).toHaveBeenCalledWith({
      userId: "user_1",
      prompt: "paint a red fox",
      model: "nano-banana-pro",
    });
    expect(dataMock.attachTaskToGeneration).toHaveBeenCalledWith("gen_1", "task_1");
    expect(resultLine).toMatchObject({
      type: "result",
      taskId: "task_1",
      generationId: "gen_1",
      status: "pending",
      balance: 7,
      priceCharged: 3,
    });
  });

  test("generate refunds when persistence fails after the provider returns a task id", async () => {
    dataMock.attachTaskToGeneration.mockRejectedValueOnce(
      new Error("database unavailable")
    );

    const response = await generatePost(
      createUserRequest("http://localhost/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "paint a red fox" }),
      })
    );

    const lines = await readNdjson(response);

    expect(response.status).toBe(200);
    expect(dataMock.attachTaskToGeneration).toHaveBeenCalledWith("gen_1", "task_1");
    expect(billingMock.refundGeneration).toHaveBeenCalledWith("gen_1");
    expect(lines.at(-1)).toEqual({
      type: "error",
      message: "database unavailable",
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
    expect(dataMock.findGenerationByTaskIdForUser).toHaveBeenCalledWith(
      "task_1",
      "user_1"
    );
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

  test("status returns 404 when the task belongs to a different user", async () => {
    dataMock.findGenerationByTaskIdForUser.mockResolvedValueOnce(null);

    const response = await statusPost(
      createUserRequest("http://localhost/api/generate/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: "task_1" }),
      })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Task not found" });
    expect(billingMock.refundGeneration).not.toHaveBeenCalled();
  });

  test("status delegates repeated failed polling to idempotent refunds", async () => {
    grsaiMock.getResult.mockResolvedValue({
      id: "task_1",
      status: "failed",
      progress: 100,
      results: null,
      failure_reason: "provider failed",
    });
    billingMock.refundGeneration
      .mockResolvedValueOnce({ refunded: true, balance: 10 })
      .mockResolvedValueOnce({ refunded: false });

    const first = await statusPost(
      createUserRequest("http://localhost/api/generate/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: "task_1" }),
      })
    );
    const second = await statusPost(
      createUserRequest("http://localhost/api/generate/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: "task_1" }),
      })
    );

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      id: "task_1",
      status: "failed",
      progress: 100,
      results: null,
      failure_reason: "provider failed",
      balance: 10,
    });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      id: "task_1",
      status: "failed",
      progress: 100,
      results: null,
      failure_reason: "provider failed",
      balance: undefined,
    });
    expect(billingMock.refundGeneration).toHaveBeenNthCalledWith(1, "gen_1");
    expect(billingMock.refundGeneration).toHaveBeenNthCalledWith(2, "gen_1");
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
    expect(dataMock.markGenerationSucceeded).toHaveBeenCalledWith(
      "gen_1",
      "https://cdn.example/generated.png"
    );
    expect(await response.json()).toEqual({
      id: "task_1",
      status: "succeeded",
      progress: 100,
      results: [{ url: "https://cdn.example/generated.png", content: "" }],
    });
  });

  test("history returns only the authenticated user's persisted generations", async () => {
    dataMock.listSucceededGenerations.mockResolvedValueOnce([
      {
        id: "gen_1",
        taskId: null,
        prompt: "paint a skyline",
        model: "nano-banana-pro",
        imageUrl: "https://cdn.example/image.png",
        createdAt: "2026-07-02T10:00:00.000Z",
      },
    ]);

    const response = await historyGet(
      createUserRequest("http://localhost/api/history")
    );

    expect(response.status).toBe(200);
    expect(apiAuthMock.requireUser).toHaveBeenCalledTimes(1);
    expect(dataMock.listSucceededGenerations).toHaveBeenCalledWith("user_1", 20);
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

  test("history returns an empty list for the built-in user without database access", async () => {
    apiAuthMock.requireUser.mockReturnValueOnce({
      role: "user",
      userId: "builtin_deo",
      username: "deo",
    });

    const response = await historyGet(
      createUserRequest("http://localhost/api/history")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(dataMock.listSucceededGenerations).not.toHaveBeenCalled();
  });

  test("upload uses bearer auth and scopes the pathname before delegating to Vercel Blob", async () => {
    const request = createUserRequest("http://localhost/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: "/gallery/../shots/flower.png",
          clientPayload: null,
          multipart: false,
        },
      } satisfies Partial<HandleUploadBody>),
    });

    const response = await uploadPost(request);

    expect(response.status).toBe(200);
    expect(apiAuthMock.requireUser).toHaveBeenCalledTimes(1);
    expect(uploadMock.handleUpload).toHaveBeenCalledTimes(1);

    const args = uploadMock.handleUpload.mock.calls[0]?.[0] as {
      body: { type: string; payload: { pathname: string } };
      onBeforeGenerateToken: (
        pathname: string,
        clientPayload: string | null,
        multipart: boolean
      ) => Promise<{
        allowedContentTypes: string[];
        tokenPayload: string;
      }>;
    };

    expect(args.body.payload.pathname).toBe(
      "users/user_1/gallery/shots/flower.png"
    );

    const tokenConfig = await args.onBeforeGenerateToken(
      args.body.payload.pathname,
      null,
      false
    );

    expect(tokenConfig).toEqual({
      allowedContentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      tokenPayload: JSON.stringify({ userId: "user_1" }),
    });
  });

  test("upload rejects a legacy access-key-only request", async () => {
    apiAuthMock.requireUser.mockImplementationOnce(() => {
      throw new apiAuthMock.ApiAuthError("Unauthorized", 401);
    });

    const response = await uploadPost(
      new Request("http://localhost/api/upload", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-access-key": "legacy-key",
        },
        body: JSON.stringify({
          type: "blob.generate-client-token",
          payload: {
            pathname: "flower.png",
            clientPayload: null,
            multipart: false,
          },
        }),
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(uploadMock.handleUpload).not.toHaveBeenCalled();
  });

  test("presigned upload scopes keys under the authenticated user prefix", async () => {
    const response = await presignedPost(
      createUserRequest("http://localhost/api/upload/presigned", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: "/users/other-user/../uploads/example.png",
          contentType: "image/png",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(apiAuthMock.requireUser).toHaveBeenCalledTimes(1);
    expect(r2Mock.getPresignedUrl).toHaveBeenCalledWith(
      "users/user_1/uploads/example.png",
      "image/png"
    );
    expect(await response.json()).toEqual({
      uploadUrl: "https://r2.example/upload",
      publicUrl: "https://cdn.example/image.png",
    });
  });
});
