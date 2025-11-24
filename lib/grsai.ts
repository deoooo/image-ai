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

  async draw(params: GrsaiDrawRequest): Promise<string[]> {
    console.log("Requesting Grsai API with params:", JSON.stringify(params, null, 2));
    
    const response = await fetch(`${this.baseUrl}/v1/draw/nano-banana`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || "nano-banana-fast",
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || "auto",
        imageSize: params.imageSize || "1K",
        urls: params.urls || [],
        shutProgress: params.shutProgress ?? false, // Use param or default to false
      }),
    });

    console.log("Grsai API Response Status:", response.status);
    console.log("Grsai API Response Headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Grsai API Error Body:", errorText);
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const contentType = response.headers.get("content-type");

    // Handle Image Response (Stream)
    if (contentType && contentType.startsWith("image/")) {
      console.log("Received image stream, uploading to R2...");
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = `generated/${Date.now()}.png`; // Assume PNG or extract from content-type
      
      // Upload to R2
      const r2Url = await uploadToR2(filename, buffer, contentType);
      console.log("Uploaded to R2:", r2Url);
      return [r2Url];
    }

    // Handle JSON Response (Server-Sent Events format)
    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: GrsaiDrawResponse | null = null;
    let taskId = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // SSE format: each event is "data: {json}\n\n"
      const lines = buffer.split("\n");
      
      // Keep incomplete line in buffer
      if (!buffer.endsWith("\n")) {
        buffer = lines.pop() || "";
      } else {
        buffer = "";
      }

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;
        
        try {
          // Remove "data: " prefix
          const jsonStr = trimmedLine.substring(5).trim();
          if (!jsonStr) continue;
          
          const data = JSON.parse(jsonStr);
          console.log("Parsed SSE data:", data);
          
          if (!taskId && data.id) {
            taskId = data.id;
          }
          
          // Check for different success formats
          if (data.status === "succeeded") {
            finalResult = data;
            break; // Found final result
          } else if (data.status === "failed") {
            throw new Error(data.failure_reason || data.error || "Generation failed");
          }
          // Otherwise it's still running, continue polling
        } catch (e) {
          console.warn("Failed to parse SSE line:", trimmedLine, e);
        }
      }
      
      // If we found the final result, break out of the read loop
      if (finalResult) break;
    }

    if (!finalResult || !finalResult.results || finalResult.results.length === 0) {
      throw new Error(`Did not receive successful result. Task ID: ${taskId || "unknown"}`);
    }

    return finalResult.results.map((r: any) => r.url);
  }

  // Legacy method kept for compatibility
  async pollResult(taskId: string): Promise<string[]> {
    return []; 
  }
}
