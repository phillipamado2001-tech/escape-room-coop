"use client";

interface Props {
  theme: string;
  lighting: string;
}

const THEME_PATTERNS: Record<string, string> = {
  abandoned_library: `
    repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(139,92,246,0.03) 40px, rgba(139,92,246,0.03) 42px),
    repeating-linear-gradient(90deg, transparent, transparent 80px, rgba(139,92,246,0.02) 80px, rgba(139,92,246,0.02) 82px)
  `,
  science_laboratory: `
    radial-gradient(circle at 20% 30%, rgba(16,185,129,0.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(53,168,232,0.06) 0%, transparent 40%)
  `,
  corporate_office: `
    repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(255,255,255,0.015) 60px, rgba(255,255,255,0.015) 61px),
    repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(255,255,255,0.015) 60px, rgba(255,255,255,0.015) 61px)
  `,
  dungeon_castle: `
    repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(100,80,60,0.04) 30px, rgba(100,80,60,0.04) 32px),
    repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(100,80,60,0.03) 50px, rgba(100,80,60,0.03) 52px)
  `,
  spaceship_scifi: `
    repeating-linear-gradient(135deg, transparent, transparent 20px, rgba(53,168,232,0.03) 20px, rgba(53,168,232,0.03) 21px),
    radial-gradient(circle at 50% 50%, rgba(53,168,232,0.05) 0%, transparent 70%)
  `,
  hotel_noir: `
    repeating-linear-gradient(90deg, transparent, transparent 120px, rgba(232,168,53,0.02) 120px, rgba(232,168,53,0.02) 121px),
    linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.3) 100%)
  `,
  basement_industrial: `
    repeating-linear-gradient(0deg, transparent, transparent 25px, rgba(150,120,80,0.03) 25px, rgba(150,120,80,0.03) 27px),
    repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(150,120,80,0.025) 40px, rgba(150,120,80,0.025) 42px)
  `,
  museum_gallery: `
    linear-gradient(180deg, rgba(139,92,246,0.04) 0%, transparent 20%, transparent 80%, rgba(139,92,246,0.04) 100%),
    repeating-linear-gradient(90deg, transparent, transparent 100px, rgba(255,255,255,0.01) 100px, rgba(255,255,255,0.01) 101px)
  `,
  cabin_woods: `
    repeating-linear-gradient(0deg, transparent, transparent 15px, rgba(80,60,40,0.04) 15px, rgba(80,60,40,0.04) 17px),
    radial-gradient(ellipse at 30% 20%, rgba(232,168,53,0.06) 0%, transparent 60%)
  `,
  doctor_office: `
    repeating-linear-gradient(90deg, transparent, transparent 80px, rgba(255,255,255,0.015) 80px, rgba(255,255,255,0.015) 81px),
    radial-gradient(circle at 50% 20%, rgba(200,220,255,0.04) 0%, transparent 50%)
  `,
  medical_hospital: `
    repeating-linear-gradient(90deg, transparent, transparent 80px, rgba(200,220,255,0.02) 80px, rgba(200,220,255,0.02) 81px),
    repeating-linear-gradient(0deg, transparent, transparent 80px, rgba(200,220,255,0.02) 80px, rgba(200,220,255,0.02) 81px)
  `,
};

const LIGHTING_BASE: Record<string, string> = {
  bright: "from-slate-800 via-slate-850 to-slate-900",
  dim: "from-void-800 via-void-850 to-void-900",
  dark: "from-gray-950 via-black to-gray-950",
  flickering: "from-amber-950/20 via-void-900 to-amber-950/10",
  colored: "from-iris-500/10 via-void-900 to-iris-500/5",
};

export function ProceduralBackground({ theme, lighting }: Props) {
  const pattern = THEME_PATTERNS[theme] ?? THEME_PATTERNS.corporate_office;
  const gradient = LIGHTING_BASE[lighting] ?? LIGHTING_BASE.dim;

  return (
    <>
      {/* Base gradient */}
      <div className={`absolute inset-0 bg-gradient-to-b ${gradient}`} />

      {/* Theme-specific pattern */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: pattern }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(10,10,21,0.6) 100%)",
        }}
      />

      {/* Flickering effect */}
      {lighting === "flickering" && (
        <div className="absolute inset-0 animate-flicker bg-amber-900/5 pointer-events-none" />
      )}
    </>
  );
}
