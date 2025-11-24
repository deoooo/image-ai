"use client";

import { useState, useEffect } from "react";
import { ImageUploader } from "@/components/ImageUploader";
import { GenerationForm } from "@/components/GenerationForm";
import { ImageGallery } from "@/components/ImageGallery";
import { GeneratedImage, GenerationModel, UploadedImage, AspectRatio, ImageSize } from "@/types";
import { Sparkles } from "lucide-react";
import { upload } from "@vercel/blob/client";

export default function Home() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<GenerationModel>("nano-banana-fast");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("auto");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch history on load
  useEffect(() => {
    // const key = localStorage.getItem("image_ai_access_key");
    // fetch("/api/history", {
    //   headers: { "x-access-key": key || "" }
    // })
    //   .then((res) => res.json())
    //   .then((data) => {
    //     if (Array.isArray(data)) {
    //       setGeneratedImages(data);
    //     }
    //   })
    //   .catch((err) => console.error("Failed to fetch history:", err));
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      const key = localStorage.getItem("image_ai_access_key") || "";

      // Convert images to Base64 directly
      const imagePromises = uploadedImages.map(async (img) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(img.file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
      });

      const imageUrls = await Promise.all(imagePromises);

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

      const data = await response.json();
      setGeneratedImages([data, ...generatedImages]);
    } catch (error) {
      console.error("Error generating image:", error);
      // You might want to add a toast notification here
    } finally {
      setIsGenerating(false);
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
            />
          </section>
        </div>

        {/* Right Content - Gallery */}
        <div className="lg:col-span-8">
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Gallery</h2>
              <span className="text-sm text-gray-500">
                {generatedImages.length} generated
              </span>
            </div>
            <ImageGallery images={generatedImages} />
          </section>
        </div>
      </div>
    </main>
  );
}
