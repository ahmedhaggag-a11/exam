/**
 * Client-side IndexedDB caching for large PDF files.
 * Allows PDF books to persist in the teacher's browser without re-uploading
 * or downloading heavy 100MB+ files repeatedly.
 */

const DB_NAME = 'examforge_pdf_cache';
const STORE_NAME = 'pdf_files';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save an ArrayBuffer or Blob of a PDF file to IndexedDB.
 */
export async function cachePdfFile(key: string, data: ArrayBuffer | Uint8Array): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Store both with specific key and as "last_active_pdf"
    store.put(data, key);
    store.put(data, 'last_active_pdf');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to cache PDF in IndexedDB:', err);
  }
}

/**
 * Retrieve cached PDF ArrayBuffer by key (or fallback to last_active_pdf).
 */
export async function getCachedPdf(key?: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const targetKey = key || 'last_active_pdf';
    const request = store.get(targetKey);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else if (key && key !== 'last_active_pdf') {
          // Fallback to last_active_pdf if specific key not found
          const fallbackReq = store.get('last_active_pdf');
          fallbackReq.onsuccess = () => resolve(fallbackReq.result || null);
          fallbackReq.onerror = () => resolve(null);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Failed to get cached PDF:', err);
    return null;
  }
}
