import {
  TResponseData,
  TResponseTtc,
  TResponseUpdate,
  TResponseVariables,
} from "@formbricks/types/responses";

const DB_NAME = "formbricks-offline";
const DB_VERSION = 1;

const STORE_PENDING_RESPONSES = "pendingResponses";
const STORE_SURVEY_PROGRESS = "surveyProgress";

export interface SerializedSurveyState {
  responseId: string | null;
  displayId: string | null;
  surveyId: string;
  singleUseId: string | null;
  userId: string | null;
  contactId: string | null;
  responseAcc: TResponseUpdate;
}

export interface PendingResponseEntry {
  id?: number;
  surveyId: string;
  responseUpdate: TResponseUpdate;
  surveyStateSnapshot: SerializedSurveyState;
  createdAt: number;
}

export interface SurveyProgressEntry {
  surveyId: string;
  blockId: string;
  responseData: TResponseData;
  ttc: TResponseTtc;
  currentVariables: TResponseVariables;
  history: string[];
  selectedLanguage: string;
  surveyStateSnapshot: SerializedSurveyState;
  updatedAt: number;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

const isIndexedDBAvailable = (): boolean => {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
};

const openDb = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_PENDING_RESPONSES)) {
        const store = db.createObjectStore(STORE_PENDING_RESPONSES, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("surveyId", "surveyId", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_SURVEY_PROGRESS)) {
        db.createObjectStore(STORE_SURVEY_PROGRESS, { keyPath: "surveyId" });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbPromise = null;

      dbInstance.onclose = () => {
        dbInstance = null;
      };

      dbInstance.onerror = () => {
        dbInstance = null;
      };

      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onblocked = () => {
      console.warn("Formbricks: IndexedDB open blocked by another connection");
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("IndexedDB open failed"));
    };
  });

  return dbPromise;
};

export const addPendingResponse = async (entry: Omit<PendingResponseEntry, "id">): Promise<number> => {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING_RESPONSES, "readwrite");
      const store = tx.objectStore(STORE_PENDING_RESPONSES);
      const request = store.add(entry);

      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    });
  } catch (e) {
    console.warn("Formbricks: Failed to persist response to IndexedDB", e);
    return -1;
  }
};

export const getPendingResponses = async (surveyId: string): Promise<PendingResponseEntry[]> => {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING_RESPONSES, "readonly");
      const store = tx.objectStore(STORE_PENDING_RESPONSES);
      const index = store.index("surveyId");
      const request = index.getAll(surveyId);

      request.onsuccess = () => {
        const results = (request.result as PendingResponseEntry[]).sort((a, b) => a.createdAt - b.createdAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    });
  } catch (e) {
    console.warn("Formbricks: Failed to read pending responses from IndexedDB", e);
    return [];
  }
};

export const removePendingResponse = async (id: number): Promise<void> => {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING_RESPONSES, "readwrite");
      const store = tx.objectStore(STORE_PENDING_RESPONSES);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    });
  } catch (e) {
    console.warn("Formbricks: Failed to remove pending response from IndexedDB", e);
  }
};

export const countPendingResponses = async (surveyId: string): Promise<number> => {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING_RESPONSES, "readonly");
      const index = tx.objectStore(STORE_PENDING_RESPONSES).index("surveyId");
      const request = index.count(IDBKeyRange.only(surveyId));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    });
  } catch (e) {
    console.warn("Formbricks: Failed to count pending responses from IndexedDB", e);
    return 0;
  }
};

export const clearPendingResponses = async (surveyId: string): Promise<void> => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_PENDING_RESPONSES, "readwrite");
    const store = tx.objectStore(STORE_PENDING_RESPONSES);
    const index = store.index("surveyId");
    const cursorRequest = index.openCursor(IDBKeyRange.only(surveyId));

    return new Promise((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    });
  } catch (e) {
    console.warn("Formbricks: Failed to clear pending responses from IndexedDB", e);
  }
};

export const saveSurveyProgress = async (progress: SurveyProgressEntry): Promise<void> => {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SURVEY_PROGRESS, "readwrite");
      const store = tx.objectStore(STORE_SURVEY_PROGRESS);
      const request = store.put(progress);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    });
  } catch (e) {
    console.warn("Formbricks: Failed to save survey progress to IndexedDB", e);
  }
};

export const getSurveyProgress = async (surveyId: string): Promise<SurveyProgressEntry | undefined> => {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SURVEY_PROGRESS, "readonly");
      const store = tx.objectStore(STORE_SURVEY_PROGRESS);
      const request = store.get(surveyId);

      request.onsuccess = () => resolve(request.result as SurveyProgressEntry | undefined);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    });
  } catch (e) {
    console.warn("Formbricks: Failed to read survey progress from IndexedDB", e);
    return undefined;
  }
};

export const patchSurveyProgressSnapshot = async (
  surveyId: string,
  snapshotPatch: Partial<SerializedSurveyState>
): Promise<void> => {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SURVEY_PROGRESS, "readwrite");
      const store = tx.objectStore(STORE_SURVEY_PROGRESS);
      const getRequest = store.get(surveyId);

      getRequest.onsuccess = () => {
        const existing = getRequest.result as SurveyProgressEntry | undefined;
        if (!existing) {
          resolve();
          return;
        }

        const putRequest = store.put({
          ...existing,
          surveyStateSnapshot: {
            ...existing.surveyStateSnapshot,
            ...snapshotPatch,
          },
          updatedAt: Date.now(),
        });

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error ?? new Error("IndexedDB request failed"));
      };

      getRequest.onerror = () => reject(getRequest.error ?? new Error("IndexedDB request failed"));
    });
  } catch (e) {
    console.warn("Formbricks: Failed to patch survey progress snapshot in IndexedDB", e);
  }
};

export const clearSurveyProgress = async (surveyId: string): Promise<void> => {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SURVEY_PROGRESS, "readwrite");
      const store = tx.objectStore(STORE_SURVEY_PROGRESS);
      const request = store.delete(surveyId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    });
  } catch (e) {
    console.warn("Formbricks: Failed to clear survey progress from IndexedDB", e);
  }
};
