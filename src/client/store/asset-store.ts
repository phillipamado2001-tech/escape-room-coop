import { create } from "zustand";

interface AssetStore {
  backgrounds: Record<string, string>; // roomId -> url
  sprites: Record<string, string>; // objectId -> url
  textures: Record<string, string>; // puzzleId -> url

  setAsset: (type: "background" | "sprite" | "texture", id: string, url: string) => void;
  reset: () => void;
}

export const useAssetStore = create<AssetStore>((set) => ({
  backgrounds: {},
  sprites: {},
  textures: {},

  setAsset: (type, id, url) =>
    set((state) => {
      if (type === "background") {
        return { backgrounds: { ...state.backgrounds, [id]: url } };
      }
      if (type === "sprite") {
        return { sprites: { ...state.sprites, [id]: url } };
      }
      return { textures: { ...state.textures, [id]: url } };
    }),

  reset: () => set({ backgrounds: {}, sprites: {}, textures: {} }),
}));
