"use client";

import React from "react";
import { GeneratedImage } from "@/types";
import { Download, ExternalLink } from "lucide-react";

interface HistoryGalleryProps {
  images: GeneratedImage[];
}

export function HistoryGallery({ images }: HistoryGalleryProps) {
  if (images.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <p className="text-gray-500">No history available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {images.map((image) => (
        <div
          key={image.id}
          className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm hover:shadow-md transition-all"
        >
          <img
            src={image.url}
            alt={image.prompt}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-white text-xs line-clamp-2 mb-2">
                {image.prompt}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={image.url}
                  download={`generated-${image.id}.png`}
                  className="p-1.5 bg-white/20 backdrop-blur-md rounded-lg text-white hover:bg-white/30 transition-colors"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                <a
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-white/20 backdrop-blur-md rounded-lg text-white hover:bg-white/30 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <span className="ml-auto text-[10px] text-white/70 bg-black/30 px-1.5 py-0.5 rounded-full backdrop-blur-md">
                  {image.model}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
