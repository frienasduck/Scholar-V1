// Local-first file bytes belong in IndexedDB, not the ~5 MB localStorage area.
// Account ID is part of the key. This is browser storage, not cloud backup.
async function openFiles(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("scholar-local-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("This browser could not open file storage."));
    request.onblocked = () => reject(new Error("Close other Scholar tabs and retry saving this file."));
  });
}

export function localFileKey(ownerId: string, fileId: string) {
  return `${encodeURIComponent(ownerId)}:${encodeURIComponent(fileId)}`;
}

export async function saveLocalFile(ownerId: string, fileId: string, file: Blob): Promise<string> {
  if (!ownerId) throw new Error("Sign in before saving files.");
  const key = localFileKey(ownerId, fileId);
  const db = await openFiles();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(file, key);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error("The file could not be saved. Your browser storage may be full."));
    });
    return key;
  } finally { db.close(); }
}

export async function readLocalFile(ownerId: string, key: string): Promise<Blob | null> {
  if (!ownerId || !key.startsWith(`${encodeURIComponent(ownerId)}:`)) return null;
  const db = await openFiles();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = db.transaction("files", "readonly").objectStore("files").get(key);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(new Error("The saved file could not be read."));
    });
  } finally { db.close(); }
}

export async function removeLocalFile(ownerId: string, key: string): Promise<void> {
  if (!ownerId || !key.startsWith(`${encodeURIComponent(ownerId)}:`)) return;
  const db = await openFiles();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").delete(key);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error("The saved file could not be removed."));
    });
  } finally { db.close(); }
}
