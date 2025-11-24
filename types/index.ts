export type GenerationModel = "nano-banana-fast" | "nano-banana" | "nano-banana-pro";
export type AspectRatio = "auto" | "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | "5:4" | "4:5" | "21:9";
export type ImageSize = "1K" | "2K" | "4K";

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  model: GenerationModel;
  createdAt: number;
}

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
}
