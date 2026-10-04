export type ActivityType = 'strength' | 'running' | 'conditioning' | 'mobility';
export type ActivitySource = 'manual' | 'apple_health' | 'health_connect' | 'garmin' | 'strava' | 'other';

/** Canonical Atlas activity shape. Wearable adapters should map into this shape. */
export type Activity = {
  id: string;
  title: string;
  type: ActivityType;
  startedAt: string;
  durationMinutes: number;
  effort?: number;
  distanceKm?: number;
  notes?: string;
  source: ActivitySource;
  externalId?: string;
};

export type PlannedSession = {
  id: string;
  day: number; // 0 = Monday, 6 = Sunday
  title: string;
  type: ActivityType;
  durationMinutes: number;
  focus: string;
};

export type TrainingGoal = {
  title: string;
  description: string;
  sessionsPerWeek: number;
  lockedAt: string;
};

export type AtlasData = {
  schemaVersion: 1;
  goal: TrainingGoal;
  plan: PlannedSession[];
  activities: Activity[];
};

export type ActivityDraft = Omit<Activity, 'id' | 'startedAt' | 'source' | 'externalId'> & { date: string };

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'strength', label: 'Styrka' },
  { value: 'running', label: 'Löpning' },
  { value: 'conditioning', label: 'Kondition' },
  { value: 'mobility', label: 'Rörlighet & koordination' },
];

export const typeLabel = (type: ActivityType) => ACTIVITY_TYPES.find((item) => item.value === type)?.label ?? type;

export const createId = () => globalThis.crypto?.randomUUID?.() ?? `atlas-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const createDefaultData = (): AtlasData => ({
  schemaVersion: 1,
  goal: {
    title: 'Allsidig och hållbar träning',
    description: 'Bygg styrka och kondition och behåll kroppskontroll och koordination.',
    sessionsPerWeek: 4,
    lockedAt: new Date().toISOString(),
  },
  plan: [
    { id: createId(), day: 0, title: 'Styrka A', type: 'strength', durationMinutes: 60, focus: 'Helkropp · kontrollerad progression' },
    { id: createId(), day: 2, title: 'Kondition + koordination', type: 'conditioning', durationMinutes: 45, focus: 'Lugn aerob träning och kroppskontroll' },
    { id: createId(), day: 4, title: 'Styrka B', type: 'strength', durationMinutes: 55, focus: 'Helkropp · drag och enbensstyrka' },
    { id: createId(), day: 6, title: 'Lugn distans', type: 'running', durationMinutes: 45, focus: 'Prattempo · aerob bas' },
  ],
  activities: [],
});

export function isAtlasData(value: unknown): value is AtlasData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<AtlasData>;
  const types: ActivityType[] = ['strength', 'running', 'conditioning', 'mobility'];
  const sources: ActivitySource[] = ['manual', 'apple_health', 'health_connect', 'garmin', 'strava', 'other'];
  return data.schemaVersion === 1 && !!data.goal && Array.isArray(data.plan) && Array.isArray(data.activities)
    && typeof data.goal.title === 'string' && typeof data.goal.description === 'string'
    && Number.isInteger(data.goal.sessionsPerWeek) && data.goal.sessionsPerWeek >= 1 && data.goal.sessionsPerWeek <= 14
    && typeof data.goal.lockedAt === 'string' && Number.isFinite(Date.parse(data.goal.lockedAt))
    && data.plan.every((item) => !!item && typeof item.id === 'string' && typeof item.title === 'string' && Number.isInteger(item.day) && item.day >= 0 && item.day <= 6
      && types.includes(item.type) && Number.isFinite(item.durationMinutes) && item.durationMinutes >= 1 && typeof item.focus === 'string')
    && data.activities.every((item) => !!item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.startedAt === 'string'
      && Number.isFinite(Date.parse(item.startedAt)) && Number.isFinite(item.durationMinutes) && item.durationMinutes >= 1 && types.includes(item.type)
      && sources.includes(item.source) && (item.effort === undefined || (Number.isInteger(item.effort) && item.effort >= 1 && item.effort <= 10))
      && (item.distanceKm === undefined || (Number.isFinite(item.distanceKm) && item.distanceKm >= 0))
      && (item.notes === undefined || typeof item.notes === 'string'));
}
