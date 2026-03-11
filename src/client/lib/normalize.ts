// Utility for accessing snake_case or camelCase fields from Opus output.
// Opus generates snake_case JSON; TypeScript types use camelCase.

export function field<T>(obj: any, camel: string, snake: string): T {
  return obj?.[camel] ?? obj?.[snake];
}

// Common field accessors
export const id = {
  room: (r: any): string => r?.roomId ?? r?.room_id ?? "",
  zone: (z: any): string => z?.zoneId ?? z?.zone_id ?? "",
  object: (o: any): string => o?.objectId ?? o?.object_id ?? "",
  puzzle: (p: any): string => p?.puzzleId ?? p?.puzzle_id ?? "",
};

export function getZones(room: any) {
  return room?.zones ?? [];
}

export function getTransitions(room: any) {
  return room?.transitions ?? [];
}

export function getObjects(session: any) {
  return session?.objects ?? [];
}

export function getPuzzles(session: any) {
  return session?.puzzles ?? [];
}

export function getRooms(session: any) {
  return session?.rooms ?? [];
}

export function getGraph(session: any) {
  return session?.dependencyGraph ?? session?.dependency_graph;
}

export function getPosition(item: any) {
  return item?.position ?? { x: 0, y: 0, width: 0, height: 0 };
}
