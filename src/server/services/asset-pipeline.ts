import type { AssetRequirements } from "@shared/types";
import {
  isDalleAvailable,
  generateBackgroundImage,
  generateSpriteImage,
  generateTextureImage,
} from "./asset-generation";
import { saveAsset, ensureAssetDir, assetExists, type AssetType } from "./asset-cache";

const INTER_REQUEST_DELAY_MS = 2000;

interface AssetReadyData {
  type: AssetType;
  id: string;
  url: string;
}

type EmitCallback = (data: AssetReadyData) => void;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start the asset generation pipeline for a session.
 * This is fire-and-forget — it runs in the background after room generation.
 * Each completed asset emits via the callback.
 */
export async function startAssetPipeline(
  sessionId: string,
  assetRequirements: AssetRequirements,
  onAssetReady: EmitCallback
): Promise<void> {
  if (!isDalleAvailable()) {
    console.log(`🎨 No OpenAI key — skipping asset generation for ${sessionId}`);
    return;
  }

  console.log(`🎨 Starting asset pipeline for session ${sessionId}`);
  ensureAssetDir(sessionId);

  const backgrounds = assetRequirements.backgrounds || [];
  const sprites = assetRequirements.sprites || [];
  const textures = assetRequirements.puzzleTextures || (assetRequirements as any).puzzle_textures || [];

  let generated = 0;
  const total = backgrounds.length + sprites.length + textures.length;

  // 1. Backgrounds (highest visual impact)
  for (const bg of backgrounds) {
    const roomId = (bg as any).room_id || bg.roomId;
    const prompt = (bg as any).prompt_description || bg.promptDescription || "";
    const tags = (bg as any).style_tags || bg.styleTags || [];
    const ratio = (bg as any).aspect_ratio || bg.aspectRatio || "16:9";

    if (assetExists(sessionId, "background", roomId)) {
      console.log(`  ↳ Background for ${roomId} already cached`);
      continue;
    }

    const fullPrompt = `${prompt}. Style: ${tags.join(", ")}`;
    console.log(`  🖼️ Generating background for room ${roomId}...`);

    const buffer = await generateBackgroundImage(fullPrompt, ratio);
    if (buffer) {
      const url = await saveAsset(sessionId, "background", roomId, buffer, {
        width: 1920,
        height: 1080,
        quality: 80,
      });
      onAssetReady({ type: "background", id: roomId, url });
      generated++;
      console.log(`  ✅ Background ${roomId} (${generated}/${total})`);
    } else {
      console.log(`  ❌ Background ${roomId} failed`);
    }

    if (backgrounds.indexOf(bg) < backgrounds.length - 1 || sprites.length > 0 || textures.length > 0) {
      await delay(INTER_REQUEST_DELAY_MS);
    }
  }

  // 2. Sprites (key_items and tools first)
  const sortedSprites = [...sprites].sort((a: any, b: any) => {
    const catA = a.size_category || a.sizeCategory || "medium";
    const catB = b.size_category || b.sizeCategory || "medium";
    // Larger items first (they're more important visually)
    const order = { large: 0, medium: 1, small: 2 };
    return (order[catA as keyof typeof order] ?? 1) - (order[catB as keyof typeof order] ?? 1);
  });

  for (const sprite of sortedSprites) {
    const objectId = (sprite as any).object_id || sprite.objectId;
    const prompt = (sprite as any).prompt_description || sprite.promptDescription || "";
    const tags = (sprite as any).style_tags || sprite.styleTags || [];
    const size = (sprite as any).size_category || sprite.sizeCategory || "medium";

    if (assetExists(sessionId, "sprite", objectId)) {
      console.log(`  ↳ Sprite for ${objectId} already cached`);
      continue;
    }

    const fullPrompt = `${prompt}. Style: ${tags.join(", ")}`;
    console.log(`  🎭 Generating sprite for ${objectId}...`);

    const buffer = await generateSpriteImage(fullPrompt);
    if (buffer) {
      const sizeMap = { small: 384, medium: 512, large: 768 };
      const px = sizeMap[size as keyof typeof sizeMap] ?? 512;
      const url = await saveAsset(sessionId, "sprite", objectId, buffer, {
        width: px,
        height: px,
        quality: 85,
      });
      onAssetReady({ type: "sprite", id: objectId, url });
      generated++;
      console.log(`  ✅ Sprite ${objectId} (${generated}/${total})`);
    } else {
      console.log(`  ❌ Sprite ${objectId} failed`);
    }

    if (sortedSprites.indexOf(sprite) < sortedSprites.length - 1 || textures.length > 0) {
      await delay(INTER_REQUEST_DELAY_MS);
    }
  }

  // 3. Textures (lowest priority)
  for (const tex of textures) {
    const puzzleId = (tex as any).puzzle_id || tex.puzzleId;
    const prompt = (tex as any).surface_description || tex.surfaceDescription || "";
    const tags = (tex as any).style_tags || tex.styleTags || [];

    if (assetExists(sessionId, "texture", puzzleId)) {
      console.log(`  ↳ Texture for ${puzzleId} already cached`);
      continue;
    }

    const fullPrompt = `${prompt}. Style: ${tags.join(", ")}`;
    console.log(`  🧩 Generating texture for ${puzzleId}...`);

    const buffer = await generateTextureImage(fullPrompt);
    if (buffer) {
      const url = await saveAsset(sessionId, "texture", puzzleId, buffer, {
        width: 512,
        height: 512,
        quality: 75,
      });
      onAssetReady({ type: "texture", id: puzzleId, url });
      generated++;
      console.log(`  ✅ Texture ${puzzleId} (${generated}/${total})`);
    } else {
      console.log(`  ❌ Texture ${puzzleId} failed`);
    }

    if (textures.indexOf(tex) < textures.length - 1) {
      await delay(INTER_REQUEST_DELAY_MS);
    }
  }

  console.log(`🎨 Asset pipeline complete for ${sessionId}: ${generated}/${total} generated`);
}
