import { existsSync, mkdirSync, rmSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { GAME_CONSTANTS } from "@shared/constants";

const BASE_DIR = path.join(process.cwd(), "generated-assets");

export type AssetType = "background" | "sprite" | "texture";

export function ensureAssetDir(sessionId: string): string {
  const dir = path.join(BASE_DIR, sessionId);
  for (const sub of ["backgrounds", "sprites", "textures"]) {
    const subDir = path.join(dir, sub);
    if (!existsSync(subDir)) {
      mkdirSync(subDir, { recursive: true });
    }
  }
  return dir;
}

function typeDir(type: AssetType): string {
  return type === "background"
    ? "backgrounds"
    : type === "sprite"
    ? "sprites"
    : "textures";
}

export function getAssetPath(sessionId: string, type: AssetType, id: string): string {
  return path.join(BASE_DIR, sessionId, typeDir(type), `${id}.webp`);
}

export function getAssetUrl(sessionId: string, type: AssetType, id: string): string {
  return `/assets/${sessionId}/${typeDir(type)}/${id}.webp`;
}

export function assetExists(sessionId: string, type: AssetType, id: string): boolean {
  return existsSync(getAssetPath(sessionId, type, id));
}

/**
 * Convert PNG buffer to WebP and save to disk. Returns the URL path.
 */
export async function saveAsset(
  sessionId: string,
  type: AssetType,
  id: string,
  pngBuffer: Buffer,
  options?: { width?: number; height?: number; quality?: number }
): Promise<string> {
  ensureAssetDir(sessionId);
  const filePath = getAssetPath(sessionId, type, id);

  let pipeline = sharp(pngBuffer);

  if (options?.width || options?.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      fit: "cover",
      withoutEnlargement: true,
    });
  }

  const webpBuffer = await pipeline
    .webp({ quality: options?.quality ?? 80 })
    .toBuffer();

  await writeFile(filePath, webpBuffer);

  return getAssetUrl(sessionId, type, id);
}

/**
 * Remove all assets for a session.
 */
export function cleanupSessionAssets(sessionId: string): void {
  const dir = path.join(BASE_DIR, sessionId);
  if (existsSync(dir)) {
    try {
      rmSync(dir, { recursive: true, force: true });
      console.log(`🗑️ Cleaned up assets for session ${sessionId}`);
    } catch (err) {
      console.error(`Failed to cleanup assets for ${sessionId}:`, err);
    }
  }
}
