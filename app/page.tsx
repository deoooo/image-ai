"use client";

import { useEffect, useState } from "react";
import { AdminUserManager } from "@/components/AdminUserManager";
import { TeamAdminManager } from "@/components/TeamAdminManager";
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
import { LogOut, Sparkles } from "lucide-react";

type RegularUser = Extract<AuthenticatedUser, { role: "user" }>;

interface RegularUserHomeProps {
  token: string;
  user: RegularUser;
  modelPrices: ModelPrice[];
  refreshSession: () => Promise<void>;
  logout: () => void;
}

function RegularUserHome({
  token,
  user,
  modelPrices,
  refreshSession,
  logout,
}: RegularUserHomeProps) {
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
  const modelPrice = modelPrices.find((item) => item.model === model)?.price ?? 0;
  const allImages = [
    ...generatedImages,
    ...historyImages.filter((h) => !generatedImages.some((g) => g.id === h.id)),
  ];

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

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      setStatusMessage("Uploading input images...");
      const imagePromises = uploadedImages.map(async (img) => {
        const filename = `inputs/${Date.now()}-${img.file.name}`;

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

        if (!presignedRes.ok) {
          throw new Error("Failed to get upload URL");
        }
        const { uploadUrl, publicUrl } = (await presignedRes.json()) as {
          uploadUrl: string;
          publicUrl: string;
        };

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: img.file,
          headers: { "Content-Type": img.file.type },
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload image");
        }

        return publicUrl;
      });

      const imageUrls = await Promise.all(imagePromises);

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
        const errorBody = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(errorBody?.error || "Generation failed");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let taskId = "";
      let shouldRefreshSession = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          let data: {
            type?: string;
            message?: string;
            taskId?: string;
            balance?: number;
          };

          try {
            data = JSON.parse(line) as typeof data;
          } catch (error) {
            console.error("Error parsing chunk:", error);
            continue;
          }

          if (data.type === "log" && data.message) {
            console.log("Log:", data.message);
            setStatusMessage(data.message);
          } else if (data.type === "error") {
            throw new Error(data.message || "Generation failed");
          } else if (data.type === "result" && data.taskId) {
            taskId = data.taskId;
            if (typeof data.balance === "number") {
              shouldRefreshSession = true;
            }
          }
        }
      }

      if (!taskId) {
        throw new Error("Failed to get Task ID from stream");
      }

      if (shouldRefreshSession) {
        await refreshSession();
      }

      const placeholderImage: GeneratedImage = {
        id: taskId,
        prompt,
        model,
        createdAt: Date.now(),
        progress: 0,
      };

      setGeneratedImages((prev) => [placeholderImage, ...prev]);

      const pollInterval = 2000;
      const maxAttempts = 300;
      let attempts = 0;

      const poll = async (): Promise<void> => {
        if (attempts >= maxAttempts) {
          throw new Error("Generation timed out");
        }

        attempts += 1;

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

        const statusData = (await statusResponse.json()) as {
          balance?: number;
          progress?: number;
          status?: string;
          results?: Array<{ url: string }>;
          failure_reason?: string;
          error?: string;
        };
        console.log("Status:", statusData);

        if (typeof statusData.balance === "number") {
          await refreshSession();
        }

        if (statusData.progress !== undefined) {
          setGenerationProgress(statusData.progress);
          setGeneratedImages((prev) =>
            prev.map((img) =>
              img.id === taskId ? { ...img, progress: statusData.progress } : img
            )
          );
        }

        if (
          statusData.status === "succeeded" &&
          statusData.results &&
          statusData.results.length > 0
        ) {
          const imageUrl = statusData.results[0].url;
          setGeneratedImages((prev) =>
            prev.map((img) =>
              img.id === taskId ? { ...img, url: imageUrl, progress: 100 } : img
            )
          );
          setGenerationProgress(100);
        } else if (statusData.status === "failed") {
          setGeneratedImages((prev) => prev.filter((img) => img.id !== taskId));
          throw new Error(
            statusData.failure_reason || statusData.error || "Generation failed"
          );
        } else {
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
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-black rounded-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Image AI</h1>
            <p className="text-sm text-gray-500">
              {user.teamName ? `${user.teamName} balance` : "Balance"}: <span className="font-medium text-gray-900">{user.balance}</span>
              {user.dailyLimit !== undefined && <span> · Today: {user.dailySpent ?? 0} / {user.dailyLimit}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
            User: <span className="font-medium text-gray-900">{user.username}</span>
          </span>
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">Input Images</h2>
            <ImageUploader images={uploadedImages} onImagesChange={setUploadedImages} />
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
              onSubmit={() => {
                void handleGenerate();
              }}
              isGenerating={isGenerating}
              progress={generationProgress}
              modelPrice={modelPrice}
              balance={user.balance}
              dailyRemaining={
                user.dailyLimit === undefined
                  ? undefined
                  : Math.max(0, user.dailyLimit - (user.dailySpent ?? 0))
              }
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
  return (
    <AuthGate>
      {({ token, user, modelPrices, refreshSession, logout }) => {
        if (user.role === "admin") {
          return <AdminUserManager token={token} onLogout={logout} />;
        }

        if (user.role === "team_admin") {
          return <TeamAdminManager token={token} user={user} onLogout={logout} />;
        }

        return (
          <RegularUserHome
            key={user.id}
            token={token}
            user={user}
            modelPrices={modelPrices}
            refreshSession={refreshSession}
            logout={logout}
          />
        );
      }}
    </AuthGate>
  );
}
