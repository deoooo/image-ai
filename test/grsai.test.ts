import { beforeEach, describe, expect, test, vi } from "vitest";

const httpMock = vi.hoisted(() => ({
  fetchWithProxy: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  fetchWithProxy: httpMock.fetchWithProxy,
}));

import { GrsaiClient } from "@/lib/grsai";

describe("GrsaiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GRSAI_API_KEY = "test-key";
    process.env.GRSAI_API_BASE_URL = "https://grsai.example";
    httpMock.fetchWithProxy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "task_1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  test("uses the GPT Image endpoint and pixel dimensions", async () => {
    const client = new GrsaiClient();

    await expect(
      client.draw({
        model: "gpt-image-2",
        prompt: "paint a red fox",
        aspectRatio: "3:2",
        imageSize: "4K",
        urls: ["https://cdn.example/input.png"],
      })
    ).resolves.toBe("task_1");

    expect(httpMock.fetchWithProxy).toHaveBeenCalledWith(
      "https://grsai.example/v1/draw/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
      })
    );

    const request = httpMock.fetchWithProxy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({
      model: "gpt-image-2",
      prompt: "paint a red fox",
      aspectRatio: "1536x1024",
      urls: ["https://cdn.example/input.png"],
      webHook: "-1",
      shutProgress: false,
    });
  });

  test("keeps Nano Banana on its existing endpoint", async () => {
    const client = new GrsaiClient();

    await client.draw({
      model: "nano-banana-pro",
      prompt: "paint a red fox",
      aspectRatio: "16:9",
      imageSize: "2K",
    });

    expect(httpMock.fetchWithProxy).toHaveBeenCalledWith(
      "https://grsai.example/v1/draw/nano-banana",
      expect.any(Object)
    );

    const request = httpMock.fetchWithProxy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      model: "nano-banana-pro",
      aspectRatio: "16:9",
      imageSize: "2K",
    });
  });
});
