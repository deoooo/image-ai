"use client";

import React from "react";
import { GenerationModel, AspectRatio, ImageSize } from "@/types";
import { cn } from "@/lib/utils";
import { Wand2 } from "lucide-react";

interface GenerationFormProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  model: GenerationModel;
  onModelChange: (model: GenerationModel) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  imageSize: ImageSize;
  onImageSizeChange: (size: ImageSize) => void;
  onSubmit: () => void;
  isGenerating: boolean;
  progress?: number;
  modelPrice: number;
  balance?: number;
  dailyRemaining?: number;
}

export function GenerationForm({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  aspectRatio,
  onAspectRatioChange,
  imageSize,
  onImageSizeChange,
  onSubmit,
  isGenerating,
  progress = 0,
  modelPrice,
  balance,
  dailyRemaining,
}: GenerationFormProps) {
  const hasInsufficientBalance =
    (balance !== undefined && balance < modelPrice) ||
    (dailyRemaining !== undefined && dailyRemaining < modelPrice);
  const isDisabled = isGenerating || !prompt.trim() || hasInsufficientBalance;
  const isGptImage = model === "gpt-image-2";

  const handleModelChange = (nextModel: GenerationModel) => {
    if (nextModel === "gpt-image-2") {
      onImageSizeChange("1K");
      if (!["auto", "1:1", "3:2", "2:3"].includes(aspectRatio)) {
        onAspectRatioChange("auto");
      }
    }

    onModelChange(nextModel);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Model
        </label>
        <select
          value={model}
          onChange={(e) => handleModelChange(e.target.value as GenerationModel)}
          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        >
          <option value="gpt-image-2">GPT Image 2</option>
          <option value="nano-banana-fast">Nano Banana Fast</option>
          <option value="nano-banana-pro">Nano Banana Pro</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Image Size
          </label>
          <select
            value={imageSize}
            onChange={(e) => onImageSizeChange(e.target.value as ImageSize)}
            disabled={isGptImage}
            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          >
            <option value="1K">1K</option>
            {!isGptImage && <option value="2K">2K</option>}
            {!isGptImage && <option value="4K">4K</option>}
          </select>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Aspect Ratio
          </label>
          <select
            value={aspectRatio}
            onChange={(e) => onAspectRatioChange(e.target.value as AspectRatio)}
            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          >
            <option value="auto">Auto</option>
            <option value="1:1">1:1</option>
            <option value="3:2">3:2</option>
            <option value="2:3">2:3</option>
            {!isGptImage && (
              <>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
                <option value="5:4">5:4</option>
                <option value="4:5">4:5</option>
                <option value="21:9">21:9</option>
              </>
            )}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe your image..."
          className="w-full h-32 px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
        />
      </div>

      <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
        Selected model price: <span className="font-semibold">{modelPrice} RMB</span>
        {balance !== undefined && (
          <span className="ml-3 text-gray-500">Balance: {balance}</span>
        )}
        {dailyRemaining !== undefined && (
          <span className="ml-3 text-gray-500">Daily remaining: {dailyRemaining}</span>
        )}
      </div>

      <button
        onClick={onSubmit}
        disabled={isDisabled}
        className={cn(
          "w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all",
          isDisabled
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-gray-900 text-white hover:bg-gray-800 shadow-lg hover:shadow-xl active:scale-[0.98]"
        )}
      >
        {isGenerating ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {progress > 0 ? `Generating... ${progress}%` : "Generating..."}
          </>
        ) : (
          <>
            <Wand2 className="w-5 h-5" />
            Generate Image
          </>
        )}
      </button>
    </div>
  );
}
