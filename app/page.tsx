"use client";

import { useEffect, useState } from "react";
import { AdminUserManager } from "@/components/AdminUserManager";
import { AuthGate } from "@/components/AuthGate";
import { ImageUploader } from "@/components/ImageUploader";
import { GenerationForm } from "@/components/GenerationForm";
import { ImageGallery } from "@/components/ImageGallery";
import {
  AuthenticatedUser,
  GeneratedImage,
  GenerationModel,
  UploadedImage,
  AspectRatio,
  ImageSize,
  ModelPrice,
} from "@/types";
import { Sparkles } from "lucide-react";

type RegularUser = Extract<AuthenticatedUser, { role: "user" }>;

interface RegularUserHomeProps {
  token: string;
  user: RegularUser;
  modelPrices: ModelPrice[];
  uploadedImages: UploadedImage[];
  setUploadedImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>;
  setHistoryImages: React.Dispatch<React.SetStateAction<GeneratedImage[]>>;
  allImages: GeneratedImage[];
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  model: GenerationModel;
  setModel: React.Dispatch<React.SetStateAction<GenerationModel>>;
  aspectRatio: AspectRatio;
  setAspectRatio: React.Dispatch<React.SetStateAction<AspectRatio>>;
  imageSize: ImageSize;
  setImageSize: React.Dispatch<React.SetStateAction<ImageSize>>;
  handleGenerate: () => Promise<void>;
  isGenerating: boolean;
  generationProgress: number;
  statusMessage: string;
}

function RegularUserHome({
  token,
  user,
  modelPrices,
  uploadedImages,
  setUploadedImages,
  setHistoryImages,
  allImages,
  prompt,
  setPrompt,
  model,
  setModel,
  aspectRatio,
  setAspectRatio,
  imageSize,
  setImageSize,
  handleGenerate,
  isGenerating,
  generationProgress,
  statusMessage,
}: RegularUserHomeProps) {
  const modelPrice = modelPrices.find((item) => item.model === model)?.price ?? 0;

  useEffect(() => {
    let isActive = true;

    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/history", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as GeneratedImage[];
        if (isActive && Array.isArray(data)) {
          setHistoryImages(data);
        }
      } catch (err) {
        console.error("Failed to load history", err);
      }
    };

    void fetchHistory();

    return () => {
      isActive = false;
    };
  }, [token, setHistoryImages]);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center gap-3 pb-6 border-b border-gray-200">
        <div className="p-2 bg-black rounded-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Image AI</h1>
          <p className="text-sm text-gray-500">
            Balance: <span className="font-medium text-gray-900">{user.balance}</span>
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">Input Images</h2>
            <ImageUploader images={uploadedImages} onImagesChange={setUploadedImages} />
          </section>

          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
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
              onSubmit={() => {
                void handleGenerate();
              }}
              isGenerating={isGenerating}
              progress={generationProgress}
              modelPrice={modelPrice}
              balance={user.balance}
            />
            {statusMessage && (
              <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg flex items-center gap-2 animate-pulse">
                <Sparkles className="w-4 h-4" />
                {statusMessage}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-8">
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Gallery</h2>
              <span className="text-sm text-gray-500">{allImages.length} images</span>
            </div>
            <ImageGallery images={allImages} />
          </section>
        </div>
      </div>
    </main>
  );
}

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

  // Merge generated (new active session) and history (fetched)
  // Ensure we don't show duplicates if history fetch includes recently generated ones
  // But generally, generatedImages will be empty on mount, and historyImages will populate.
  // When we generate a new one, it adds to generatedImages.
  const allImages = [
    ...generatedImages,
    ...historyImages.filter((h) => !generatedImages.some((g) => g.id === h.id)),
  ];

  const handleGenerate = async (token: string, refreshSession: () => Promise<void>) => {
    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      // Upload images to R2
      setStatusMessage("Uploading input images...");
      const imagePromises = uploadedImages.map(async (img) => {
        const filename = `inputs/${Date.now()}-${img.file.name}`;

        // 1. Get presigned URL
        const presignedRes = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename,
            contentType: img.file.type,
          }),
        });

        if (!presignedRes.ok) throw new Error("Failed to get upload URL");
        const { uploadUrl, publicUrl } = await presignedRes.json();

        // 2. Upload file
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: img.file,
          headers: { "Content-Type": img.file.type },
        });

        if (!uploadRes.ok) throw new Error("Failed to upload image");

        return publicUrl;
      });

      const imageUrls = await Promise.all(imagePromises);

      // Step 1: Initiate generation
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
      let shouldRefreshSession = false;

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
              if (typeof data.balance === "number") {
                shouldRefreshSession = true;
              }
            }
          } catch (e) {
            console.error("Error parsing chunk:", e);
          }
        }
      }

      if (!taskId) {
        throw new Error("Failed to get Task ID from stream");
      }

      if (shouldRefreshSession) {
        await refreshSession();
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

      setGeneratedImages((prev) => [placeholderImage, ...prev]);

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
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ taskId }),
        });

        if (!statusResponse.ok) {
          throw new Error("Failed to check status");
        }

        const statusData = await statusResponse.json();
        console.log("Status:", statusData);

        if (typeof statusData.balance === "number") {
          await refreshSession();
        }

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
    <AuthGate>
      {({ token, user, modelPrices, refreshSession }) => {
        if (user.role === "admin") {
          return <AdminUserManager token={token} />;
        }

        return (
          <RegularUserHome
            token={token}
            user={user}
            modelPrices={modelPrices}
            uploadedImages={uploadedImages}
            setUploadedImages={setUploadedImages}
            setHistoryImages={setHistoryImages}
            allImages={allImages}
            prompt={prompt}
            setPrompt={setPrompt}
            model={model}
            setModel={setModel}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            imageSize={imageSize}
            setImageSize={setImageSize}
            handleGenerate={() => handleGenerate(token, refreshSession)}
            isGenerating={isGenerating}
            generationProgress={generationProgress}
            statusMessage={statusMessage}
          />
        );
      }}
    </AuthGate>
  );
}
