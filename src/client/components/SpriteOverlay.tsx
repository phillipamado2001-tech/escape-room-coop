"use client";

import { useState, useEffect } from "react";
import { useAssetStore } from "@client/store/asset-store";

interface Props {
  objectId: string;
  name: string;
  lighting?: string;
  size?: "small" | "medium" | "large";
  onClick?: () => void;
  className?: string;
}

const LIGHTING_FILTERS: Record<string, string> = {
  bright: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
  dim: "brightness(0.85) drop-shadow(0 2px 8px rgba(0,0,0,0.5)) sepia(0.1)",
  dark: "brightness(0.7) drop-shadow(0 2px 12px rgba(0,0,0,0.7)) saturate(0.8)",
  flickering:
    "brightness(0.8) drop-shadow(0 2px 8px rgba(200,150,50,0.4)) sepia(0.15)",
  colored: "drop-shadow(0 2px 8px rgba(139,92,246,0.3)) hue-rotate(10deg)",
};

const SIZE_CLASSES: Record<string, string> = {
  small: "w-8 h-8",
  medium: "w-14 h-14",
  large: "w-20 h-20",
};

export function SpriteOverlay({
  objectId,
  name,
  lighting = "dim",
  size = "medium",
  onClick,
  className = "",
}: Props) {
  const spriteUrl = useAssetStore((s) => s.sprites[objectId]);
  const [loaded, setLoaded] = useState(false);

  // Reset loaded state when sprite URL changes
  useEffect(() => setLoaded(false), [spriteUrl]);

  const filter = LIGHTING_FILTERS[lighting] ?? LIGHTING_FILTERS.dim;
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.medium;

  if (!spriteUrl) {
    // Fallback: colored circle with first letter
    const initial = name.charAt(0).toUpperCase();
    return (
      <button
        onClick={onClick}
        className={`${sizeClass} rounded-full bg-iris-400/20 border border-iris-400/30 flex items-center justify-center text-iris-400 text-xs font-bold hover:bg-iris-400/30 transition-colors ${className}`}
        title={name}
      >
        {initial}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`${sizeClass} relative group transition-transform hover:scale-110 ${className}`}
      title={name}
    >
      <img
        src={spriteUrl}
        alt={name}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-contain transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        style={{ filter }}
      />
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-iris-400/10 blur-sm" />
    </button>
  );
}
