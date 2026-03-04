"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

interface PhotoUploadProps {
  name: string;
  photoUrl: string | null;
}

export function PhotoUpload({ name, photoUrl }: PhotoUploadProps) {
  const [currentUrl, setCurrentUrl] = useState(photoUrl);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch("/api/profile/photo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Upload failed");
        return;
      }

      const { url } = await res.json();
      setCurrentUrl(url + "?t=" + Date.now());
    } catch {
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full focus:outline-none focus:ring-2 focus:ring-[#1D4F91] focus:ring-offset-2"
    >
      {currentUrl ? (
        <img
          src={currentUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#1D4F91] text-lg font-semibold text-white">
          {initials}
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        ) : (
          <Camera className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />
    </button>
  );
}
