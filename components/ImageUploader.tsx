"use client";

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { UploadedImage } from "@/types";

interface ImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
}

export function ImageUploader({ images, onImagesChange }: ImageUploaderProps) {
  const MAX_IMAGES = 6;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const remainingSlots = MAX_IMAGES - images.length;
      if (remainingSlots <= 0) {
        alert(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }

      const filesToAdd = acceptedFiles.slice(0, remainingSlots);
      const newImages: UploadedImage[] = filesToAdd.map((file) => ({
        id: Math.random().toString(36).substring(7),
        file,
        preview: URL.createObjectURL(file),
      }));
      onImagesChange([...images, ...newImages]);

      if (acceptedFiles.length > remainingSlots) {
        alert(`Only ${remainingSlots} more image(s) can be added. Maximum is ${MAX_IMAGES} images.`);
      }
    },
    [images, onImagesChange]
  );

  const removeImage = (id: string) => {
    const newImages = images.filter((img) => img.id !== id);
    onImagesChange(newImages);
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    noClick: images.length > 0, // Disable click when images exist
    noKeyboard: images.length > 0,
    maxFiles: MAX_IMAGES,
  });

  // Show upload box when no images
  if (images.length === 0) {
    return (
      <div className="w-full">
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center",
            isDragActive
              ? "border-blue-500 bg-blue-50/50"
              : "border-gray-300 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-100/50"
          )}
        >
          <input {...getInputProps()} />
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            <Upload className="w-6 h-6 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Click to upload image
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Or drag and drop images here
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Supports JPG, JPEG, PNG, WEBP formats
          </p>
        </div>
      </div>
    );
  }

  // Show previews with add button when images exist
  return (
    <div className="w-full" {...getRootProps()}>
      <input {...getInputProps()} />
      <div className="grid grid-cols-2 gap-3">
        {images.map((image) => (
          <div
            key={image.id}
            className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
          >
            <img
              src={image.preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeImage(image.id);
              }}
              className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        
        {/* Add more button - only show if under limit */}
        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className={cn(
              "aspect-square rounded-lg border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-2",
              isDragActive
                ? "border-blue-500 bg-blue-50/50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-100/50"
            )}
          >
            <div className="bg-white p-3 rounded-full shadow-sm">
              <Plus className="w-5 h-5 text-gray-600" />
            </div>
            <span className="text-xs text-gray-500 font-medium">Add More</span>
          </button>
        )}
      </div>
    </div>
  );
}
