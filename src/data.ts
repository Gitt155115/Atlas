import { type Activity, type AtlasData, createDefaultData, isAtlasData } from './domain';

const STORAGE_KEY = 'atlas.data.v1';
let memoryFallback: AtlasData | null = null;

export interface TrainingRepository {
  load(): AtlasData;
  save(data: AtlasData): void;
}

/** Local MVP storage. The repository boundary allows a server-backed store later. */
export const localTrainingRepository: TrainingRepository = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isAtlasData(parsed)) return parsed;
      }
    } catch {
      // A damaged or unavailable local record should not prevent the app from opening.
    }
    if (memoryFallback) return memoryFallback;
    const initial = createDefaultData();
    this.save(initial);
    return initial;
  },
  save(data) {
    memoryFallback = data;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch { /* Continue for this tab when browser storage is disabled or full. */ }
  },
};

/**
 * Future Apple Health / Health Connect / Garmin / Strava connectors should map
 * their provider payloads to Atlas Activity before returning them. Keep provider
 * credentials and permissions inside the adapter, never in AtlasData.
 */
export interface HealthDataProvider {
  readonly id: string;
  listActivities(from: string, to: string): Promise<Activity[]>;
}

export function downloadBackup(data: AtlasData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `atlas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function readBackup(file: File): Promise<AtlasData> {
  const value: unknown = JSON.parse(await file.text());
  if (!isAtlasData(value)) throw new Error('Filen har inte ett Atlas-backupformat som stöds.');
  return value;
}
