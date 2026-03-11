import OpenAI from "openai";

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (_client) return _client;
  if (!process.env.OPENAI_API_KEY) return null;
  _client = new OpenAI();
  return _client;
}

export function isDalleAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Generate a room background image via DALL-E 3.
 */
export async function generateBackgroundImage(
  prompt: string,
  aspectRatio: "16:9" | "21:9"
): Promise<Buffer | null> {
  const client = getClient();
  if (!client) return null;

  const size = aspectRatio === "21:9" ? "1792x1024" : "1792x1024";
  const fullPrompt = `Digital painted environment for an escape room game. Atmospheric, detailed, moody lighting. ${prompt}. No text, no UI elements, no people. Wide establishing shot.`;

  try {
    const response = await client.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: size as any,
      quality: "standard",
      response_format: "b64_json",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return null;

    return Buffer.from(b64, "base64");
  } catch (err: any) {
    console.error(`DALL-E background generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Generate an object sprite via DALL-E 3.
 */
export async function generateSpriteImage(prompt: string): Promise<Buffer | null> {
  const client = getClient();
  if (!client) return null;

  const fullPrompt = `Single game object on a clean dark background (#0a0a15). Digital painted style, clear edges, centered composition. ${prompt}. No text, isolated object only.`;

  try {
    const response = await client.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return null;

    return Buffer.from(b64, "base64");
  } catch (err: any) {
    console.error(`DALL-E sprite generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Generate a puzzle texture via DALL-E 3.
 */
export async function generateTextureImage(prompt: string): Promise<Buffer | null> {
  const client = getClient();
  if (!client) return null;

  const fullPrompt = `Seamless texture surface for a puzzle in an escape room game. Close-up, detailed material. ${prompt}. No text, no objects, just the surface material.`;

  try {
    const response = await client.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return null;

    return Buffer.from(b64, "base64");
  } catch (err: any) {
    console.error(`DALL-E texture generation failed: ${err.message}`);
    return null;
  }
}
