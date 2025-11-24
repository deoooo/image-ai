import { uploadToR2 } from "./r2";

const GRSAI_API_BASE_URL = process.env.GRSAI_API_BASE_URL || "https://api.grsai.com";
const GRSAI_API_KEY = process.env.GRSAI_API_KEY;

export interface GrsaiDrawRequest {
  model?: "nano-banana-fast" | "nano-banana" | "nano-banana-pro";
  prompt: string;
  aspectRatio?: string;
  imageSize?: "1K" | "2K" | "4K";
  urls?: string[];
  shutProgress?: boolean;
}

export interface GrsaiDrawResponse {
  id: string;
  results: {
    url: string;
    content: string;
  }[] | null;
  progress: number;
  status: "queued" | "running" | "succeeded" | "failed";
  failure_reason?: string;
  error?: string;
}

export class GrsaiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.GRSAI_API_KEY || "";
    this.baseUrl = process.env.GRSAI_API_BASE_URL || "https://api.grsai.com";
  }

  async draw(params: GrsaiDrawRequest): Promise<string> {
    console.log("Requesting Grsai API with params:", JSON.stringify(params, null, 2));
    
    const response = await fetch(`${this.baseUrl}/v1/draw/nano-banana`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || "nano-banana-pro",
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || "auto",
        imageSize: params.imageSize || "1K",
        urls: params.urls || [],
        webHook: "-1", // Fixed value for polling mode
        shutProgress: false, // Disable progress in webhook
      }),
    });

    console.log("Grsai API Response Status:", response.status);
    console.log("Grsai API Response Headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Grsai API Error Body:", errorText);
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log("Grsai API Response Data:", data);

    // Extract task ID from response
    if (data.id) {
      return data.id;
    } else if (data.data && data.data.id) {
      return data.data.id;
    } else {
      throw new Error(`No task ID in response: ${JSON.stringify(data)}`);
    }
  }

  async getResult(taskId: string): Promise<GrsaiDrawResponse> {
    console.log("Fetching result for task:", taskId);
    
    const response = await fetch(`${this.baseUrl}/v1/draw/result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        id: taskId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get result: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log("Result API Response:", result);

    // Handle different response formats
    if (result.data) {
      return result.data;
    } else if (result.id) {
      return result;
    } else {
      throw new Error(`Unexpected result format: ${JSON.stringify(result)}`);
    }
  }

  // Polling method for server-side use
  async pollResult(taskId: string, intervalMs = 2000, timeoutMs = 120000): Promise<string[]> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.getResult(taskId);

      if (result.status === "succeeded" && result.results && result.results.length > 0) {
        return result.results.map((r: any) => r.url);
      }

      if (result.status === "failed") {
        throw new Error(result.failure_reason || result.error || "Generation failed");
      }

      // Still running, wait before next poll
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error("Polling timed out");
  }
}
