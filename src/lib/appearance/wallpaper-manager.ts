const DATABASE = "scholar-appearance-media";
const STORE = "wallpapers";
const VERSION = 1;

export type StoredWallpaper = { id: string; name: string; type: "image" | "video"; mime: string; size: number; blob: Blob; createdAt: number };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Wallpaper storage could not be opened."));
  });
}

export function validateWallpaperFile(file: File): { type: "image" | "video"; error?: string } {
  const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
  const videoTypes = new Set(["video/mp4", "video/webm"]);
  if (imageTypes.has(file.type)) return { type: "image", error: file.size > 15 * 1024 * 1024 ? "Images must be 15 MB or smaller." : undefined };
  if (videoTypes.has(file.type)) return { type: "video", error: file.size > 80 * 1024 * 1024 ? "Videos must be 80 MB or smaller." : undefined };
  return { type: "image", error: "Choose a JPG, PNG, WEBP, AVIF, GIF, MP4, or WEBM file." };
}

export async function storeWallpaper(file: File): Promise<StoredWallpaper> {
  const validation = validateWallpaperFile(file);
  if (validation.error) throw new Error(validation.error);
  const record: StoredWallpaper = {
    id: crypto.randomUUID(), name: file.name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").slice(0, 120),
    type: validation.type, mime: file.type, size: file.size, blob: file, createdAt: Date.now(),
  };
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error("Wallpaper could not be saved."));
  });
  database.close();
  return record;
}

export async function getWallpaper(id: string): Promise<StoredWallpaper | null> {
  if (!id || typeof indexedDB === "undefined") return null;
  const database = await openDatabase();
  const result = await new Promise<StoredWallpaper | undefined>((resolve, reject) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as StoredWallpaper | undefined);
    request.onerror = () => reject(new Error("Wallpaper could not be loaded."));
  });
  database.close();
  return result ?? null;
}

export async function deleteWallpaper(id: string): Promise<void> {
  if (!id || typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error("Wallpaper could not be removed."));
  });
  database.close();
}
