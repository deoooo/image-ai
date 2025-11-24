"use client";

import React from "react";
import { GeneratedImage } from "@/types";
import { Download, ExternalLink } from "lucide-react";

interface ImageGalleryProps {
  images: GeneratedImage[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  if (images.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <p className="text-gray-500">No images generated yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {images.map((image) => (
        <div
          key={image.id}
          className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm hover:shadow-md transition-all"
        >
          {image.url ? (
            // Completed image
            <>
              <img
                src={image.url}
                alt={image.prompt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-white text-sm line-clamp-2 mb-2">
                    {image.prompt}
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={image.url}
                      download={`generated-${image.id}.png`}
                      className="p-2 bg-white/20 backdrop-blur-md rounded-lg text-white hover:bg-white/30 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white/20 backdrop-blur-md rounded-lg text-white hover:bg-white/30 transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <span className="ml-auto text-xs text-white/70 bg-black/30 px-2 py-1 rounded-full backdrop-blur-md">
                      {image.model}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Generating placeholder with circular progress
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
              <div className="relative w-32 h-32">
                {/* Background circle */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-200"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - (image.progress || 0) / 100)}`}
                    className="text-blue-500 transition-all duration-300"
                    strokeLinecap="round"
                  />
                </svg>
                {/* Percentage text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-gray-700">
                    {image.progress || 0}%
                  </span>
                </div>
              </div>
              <p className="mt-6 text-sm text-gray-600 font-medium">Generating...</p>
              <p className="mt-2 text-xs text-gray-500 px-4 text-center line-clamp-2">
                {image.prompt}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
