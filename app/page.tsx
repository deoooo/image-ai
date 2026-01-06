"use client";

import { useState, useEffect } from "react";
import { ImageUploader } from "@/components/ImageUploader";
import { GenerationForm } from "@/components/GenerationForm";
import { ImageGallery } from "@/components/ImageGallery";

import {
  GeneratedImage,
  GenerationModel,
  UploadedImage,
  AspectRatio,
  ImageSize,
} from "@/types";
import { Sparkles } from "lucide-react";
import { upload } from "@vercel/blob/client";

export default function Home() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [historyImages, setHistoryImages] = useState<GeneratedImage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<GenerationModel>("nano-banana-pro");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("auto");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Fetch history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const key = localStorage.getItem("image_ai_access_key") || "";
        if (!key) return;

        const res = await fetch("/api/history", {
          headers: { "x-access-key": key },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setHistoryImages(data);
          }
        }
      } catch (err) {
        console.error("Failed to load history", err);
      }
    };

    fetchHistory();
    fetchHistory();
  }, []); // Only fetch on mount

  // Merge generated (new active session) and history (fetched)
  // Ensure we don't show duplicates if history fetch includes recently generated ones
  // But generally, generatedImages will be empty on mount, and historyImages will populate.
  // When we generate a new one, it adds to generatedImages.
  const allImages = [
    ...generatedImages,
    ...historyImages.filter((h) => !generatedImages.some((g) => g.id === h.id)),
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      const key = localStorage.getItem("image_ai_access_key") || "";

      // Convert images to Base64 directly
      const imagePromises = uploadedImages.map(async (img) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(img.file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });
      });

      const imageUrls = await Promise.all(imagePromises);

      // Step 1: Initiate generation
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-key": key,
        },
        body: JSON.stringify({
          prompt,
          model,
          aspectRatio,
          imageSize,
          images: imageUrls,
        }),
      });

      if (!response.ok) {
        throw new Error("Generation failed");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let taskId = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === "log") {
              console.log("Log:", data.message);
              setStatusMessage(data.message);
            } else if (data.type === "error") {
              throw new Error(data.message);
            } else if (data.type === "result") {
              taskId = data.taskId;
            }
          } catch (e) {
            console.error("Error parsing chunk:", e);
          }
        }
      }

      if (!taskId) {
        throw new Error("Failed to get Task ID from stream");
      }

      console.log("Task ID:", taskId);

      // Create placeholder image immediately
      const placeholderImage: GeneratedImage = {
        id: taskId,
        prompt,
        model,
        createdAt: Date.now(),
        progress: 0,
        // url is undefined (will be set when complete)
      };

      setGeneratedImages([placeholderImage, ...generatedImages]);

      // Step 2: Poll for status
      const pollInterval = 2000; // 2 seconds
      const maxAttempts = 300; // 10 minutes max (300 * 2s = 600s = 10min)
      let attempts = 0;

      const poll = async (): Promise<void> => {
        if (attempts >= maxAttempts) {
          throw new Error("Generation timed out");
        }

        attempts++;

        const statusResponse = await fetch("/api/generate/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-access-key": key,
          },
          body: JSON.stringify({ taskId }),
        });

        if (!statusResponse.ok) {
          throw new Error("Failed to check status");
        }

        const statusData = await statusResponse.json();
        console.log("Status:", statusData);

        // Update progress in the placeholder
        if (statusData.progress !== undefined) {
          setGenerationProgress(statusData.progress);
          setGeneratedImages((prev) =>
            prev.map((img) =>
              img.id === taskId
                ? { ...img, progress: statusData.progress }
                : img
            )
          );
        }

        // Check status
        if (
          statusData.status === "succeeded" &&
          statusData.results &&
          statusData.results.length > 0
        ) {
          // Generation complete - update placeholder with final image
          const imageUrl = statusData.results[0].url;
          setGeneratedImages((prev) =>
            prev.map((img) =>
              img.id === taskId ? { ...img, url: imageUrl, progress: 100 } : img
            )
          );
          setGenerationProgress(100);
        } else if (statusData.status === "failed") {
          // Remove placeholder on failure
          setGeneratedImages((prev) => prev.filter((img) => img.id !== taskId));
          throw new Error(
            statusData.failure_reason || statusData.error || "Generation failed"
          );
        } else {
          // Still running, poll again
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          await poll();
        }
      };

      await poll();
    } catch (error) {
      console.error("Error generating image:", error);
      alert(
        `Generation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsGenerating(false);

      setGenerationProgress(0);
      setStatusMessage("");
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center gap-3 pb-6 border-b border-gray-200">
        <div className="p-2 bg-black rounded-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Image AI</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar - Controls */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">Input Images</h2>
            <ImageUploader
              images={uploadedImages}
              onImagesChange={setUploadedImages}
            />
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">Generation Settings</h2>
            <GenerationForm
              prompt={prompt}
              onPromptChange={setPrompt}
              model={model}
              onModelChange={setModel}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              imageSize={imageSize}
              onImageSizeChange={setImageSize}
              onSubmit={handleGenerate}
              isGenerating={isGenerating}
              progress={generationProgress}
            />
            {statusMessage && (
              <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg flex items-center gap-2 animate-pulse">
                <Sparkles className="w-4 h-4" />
                {statusMessage}
              </div>
            )}
          </section>
        </div>

        {/* Right Content - Gallery */}
        <div className="lg:col-span-8">
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Gallery</h2>
              <span className="text-sm text-gray-500">
                {allImages.length} images
              </span>
            </div>
            <ImageGallery images={allImages} />
          </section>
        </div>
      </div>
    </main>
  );
}
