export type ActivityType = 'strength' | 'running' | 'conditioning' | 'mobility';
export type ActivitySource = 'manual' | 'apple_health' | 'health_connect' | 'garmin' | 'strava' | 'other';
export type StrengthLift = 'deadlift' | 'squat' | 'bench_press';
export type RunningEvent = '5k' | '10k' | 'half_marathon' | 'marathon';

export type PerformanceTarget =
  | { id: string; category: 'strength'; metric: StrengthLift; currentKg?: number; targetKg: number; targetDate?: string }
  | { id: string; category: 'running'; metric: RunningEvent; currentSeconds?: number; targetSeconds: number; targetDate?: string };

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
  distanceKm?: number;
  focus: string;
};

export type TrainingGoal = {
  title: string;
  description: string;
  targets: PerformanceTarget[];
  targetDate?: string;
  availableDays: number[];
  sessionsPerWeek: number;
  recommendedSessionsPerWeek: number;
  lockedAt: string;
};

export type AtlasData = {
  schemaVersion: 2;
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

export const STRENGTH_LIFTS: { value: StrengthLift; label: string }[] = [
  { value: 'deadlift', label: 'Marklyft' },
  { value: 'squat', label: 'Knäböj' },
  { value: 'bench_press', label: 'Bänkpress' },
];

export const RUNNING_EVENTS: { value: RunningEvent; label: string; distanceKm: number }[] = [
  { value: '5k', label: '5 km', distanceKm: 5 },
  { value: '10k', label: '10 km', distanceKm: 10 },
  { value: 'half_marathon', label: 'Halvmaraton', distanceKm: 21.1 },
  { value: 'marathon', label: 'Maraton', distanceKm: 42.2 },
];

export const typeLabel = (type: ActivityType) => ACTIVITY_TYPES.find((item) => item.value === type)?.label ?? type;
export const liftLabel = (metric: StrengthLift) => STRENGTH_LIFTS.find((item) => item.value === metric)?.label ?? metric;
export const runningEvent = (metric: RunningEvent) => RUNNING_EVENTS.find((item) => item.value === metric)!;

export const createId = () => globalThis.crypto?.randomUUID?.() ?? `atlas-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function recommendSessionsPerWeek(targets: PerformanceTarget[], availableDays: number[]) {
  const hasStrength = targets.some((target) => target.category === 'strength');
  const hasRunning = targets.some((target) => target.category === 'running');
  const startingPoint = hasStrength && hasRunning ? 4 : hasStrength || hasRunning ? 3 : 0;
  return Math.min(startingPoint, availableDays.length);
}

export function createPlanSuggestion(goal: TrainingGoal): PlannedSession[] {
  const strengthTargets = goal.targets.filter((target): target is Extract<PerformanceTarget, { category: 'strength' }> => target.category === 'strength');
  const runningTargets = goal.targets.filter((target): target is Extract<PerformanceTarget, { category: 'running' }> => target.category === 'running');
  const hasStrength = strengthTargets.length > 0;
  const hasRunning = runningTargets.length > 0;
  const count = Math.max(0, Math.min(goal.sessionsPerWeek, 7));
  if (!count || (!hasStrength && !hasRunning)) return [];

  const strengthCount = hasStrength && hasRunning ? Math.min(Math.ceil(count / 2), 2) : hasStrength ? count : 0;
  const runCount = count - strengthCount;
  const strengthSessions = Array.from({ length: strengthCount }, (_, index) => {
    const target = strengthTargets[index % strengthTargets.length];
    const lift = liftLabel(target.metric);
    const otherTargets = strengthTargets.filter((item) => item.id !== target.id).map((item) => `${liftLabel(item.metric)} ${item.targetKg} kg`);
    const sessionName = ['A', 'B', 'C'][index % 3];
    return {
      title: `Styrka ${sessionName} · ${lift}`,
      type: 'strength' as const,
      durationMinutes: 60,
      focus: `Prioriterat lyft: ${lift}, mål ${target.targetKg} kg.${otherTargets.length ? ` Övriga styrkemål: ${otherTargets.join(' · ')}.` : ''} Övningar, vikter och progression behöver anpassas efter ditt nuläge.`,
    };
  });
  const runNames = runCount === 1 ? ['Löpning'] : runCount === 2 ? ['Kvalitetspass', 'Långpass'] : ['Intervaller / kvalitet', 'Lugn distans', 'Långpass', 'Lugn distans'];
  const runSessions = Array.from({ length: runCount }, (_, index) => {
    const target = runningTargets[index % runningTargets.length];
    const event = runningEvent(target.metric);
    const goalTime = `${Math.floor(target.targetSeconds / 60)}:${String(target.targetSeconds % 60).padStart(2, '0')}`;
    const isLongRun = index === runCount - 1 && runCount > 1;
    return {
      title: `${runNames[index % runNames.length]} · ${event.label}`,
      type: 'running' as const,
      durationMinutes: isLongRun ? 60 : 45,
      focus: `Målriktning: ${event.label} på ${goalTime}. Träningsfart och progression behöver anpassas efter ditt nuläge.`,
    };
  });
  const sessions = [...strengthSessions, ...runSessions];
  const days = [...new Set(goal.availableDays)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort((a, b) => a - b);
  const usableDays = days.length >= count ? days : Array.from({ length: 7 }, (_, day) => day);
  const selectedDays = count === 1 ? [usableDays[0]] : Array.from({ length: count }, (_, index) => usableDays[Math.round(index * (usableDays.length - 1) / (count - 1))]);
  return sessions.slice(0, count).map((session, index) => ({ id: createId(), day: selectedDays[index], ...session }));
}

export const createDefaultData = (): AtlasData => ({
  schemaVersion: 2,
  goal: {
    title: 'Mina träningsmål', description: '', targets: [], availableDays: [0, 1, 2, 3, 4, 5, 6],
    sessionsPerWeek: 0, recommendedSessionsPerWeek: 0, lockedAt: new Date().toISOString(),
  },
  plan: [],
  activities: [],
});

function isActivityType(value: unknown): value is ActivityType {
  return value === 'strength' || value === 'running' || value === 'conditioning' || value === 'mobility';
}

function isPerformanceTarget(value: unknown): value is PerformanceTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Partial<PerformanceTarget>;
  if (typeof target.id !== 'string') return false;
  if (target.category === 'strength') {
    const item = target as Extract<PerformanceTarget, { category: 'strength' }>;
    return ['deadlift', 'squat', 'bench_press'].includes(item.metric)
      && Number.isFinite(item.targetKg) && item.targetKg > 0
      && (item.currentKg === undefined || (Number.isFinite(item.currentKg) && item.currentKg >= 0))
      && (item.targetDate === undefined || (typeof item.targetDate === 'string' && Number.isFinite(Date.parse(item.targetDate))));
  }
  if (target.category === 'running') {
    const item = target as Extract<PerformanceTarget, { category: 'running' }>;
    return ['5k', '10k', 'half_marathon', 'marathon'].includes(item.metric)
      && Number.isFinite(item.targetSeconds) && item.targetSeconds > 0
      && (item.currentSeconds === undefined || (Number.isFinite(item.currentSeconds) && item.currentSeconds > 0))
      && (item.targetDate === undefined || (typeof item.targetDate === 'string' && Number.isFinite(Date.parse(item.targetDate))));
  }
  return false;
}

/** Converts the v1 local data and backups without discarding the user's existing log. */
export function migrateAtlasData(value: unknown): AtlasData | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (data.schemaVersion === 1) {
    const legacy = data as unknown as { goal?: Record<string, unknown>; plan?: unknown[]; activities?: unknown[] };
    if (!legacy.goal || !Array.isArray(legacy.plan) || !Array.isArray(legacy.activities)) return null;
    const legacyDays = legacy.plan.map((session) => (session as { day?: unknown })?.day).filter((day): day is number => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6);
    const oldSessions = Number(legacy.goal.sessionsPerWeek);
    return {
      schemaVersion: 2,
      goal: {
        title: typeof legacy.goal.title === 'string' ? legacy.goal.title : 'Mina träningsmål',
        description: typeof legacy.goal.description === 'string' ? legacy.goal.description : '',
        targets: [], targetDate: undefined,
        availableDays: legacyDays.length ? [...new Set(legacyDays)] : [0, 1, 2, 3, 4, 5, 6],
        sessionsPerWeek: Number.isInteger(oldSessions) && oldSessions >= 0 && oldSessions <= 14 ? oldSessions : 0,
        recommendedSessionsPerWeek: Number.isInteger(oldSessions) && oldSessions >= 0 && oldSessions <= 14 ? oldSessions : 0,
        lockedAt: typeof legacy.goal.lockedAt === 'string' ? legacy.goal.lockedAt : new Date().toISOString(),
      },
      plan: legacy.plan.map((item) => {
        const session = item as Record<string, unknown>;
        return { ...session, distanceKm: undefined } as unknown as PlannedSession;
      }),
      activities: legacy.activities as Activity[],
    };
  }
  if (data.schemaVersion !== 2) return null;
  const current = value as Partial<AtlasData>;
  const goal = current.goal;
  if (!goal || typeof goal.title !== 'string' || typeof goal.description !== 'string'
    || !Array.isArray(goal.targets) || !goal.targets.every(isPerformanceTarget)
    || !Array.isArray(goal.availableDays) || !goal.availableDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    || !Number.isInteger(goal.sessionsPerWeek) || goal.sessionsPerWeek < 0 || goal.sessionsPerWeek > 14
    || !Number.isInteger(goal.recommendedSessionsPerWeek) || goal.recommendedSessionsPerWeek < 0 || goal.recommendedSessionsPerWeek > 14
    || typeof goal.lockedAt !== 'string' || !Number.isFinite(Date.parse(goal.lockedAt))
    || !Array.isArray(current.plan) || !Array.isArray(current.activities)) return null;
  const validPlan = current.plan.every((session) => !!session && typeof session.id === 'string' && Number.isInteger(session.day) && session.day >= 0 && session.day <= 6
    && typeof session.title === 'string' && isActivityType(session.type) && Number.isFinite(session.durationMinutes) && session.durationMinutes >= 1
    && (session.distanceKm === undefined || (Number.isFinite(session.distanceKm) && session.distanceKm > 0)) && typeof session.focus === 'string');
  const validActivities = current.activities.every((item) => !!item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.startedAt === 'string'
    && Number.isFinite(Date.parse(item.startedAt)) && Number.isFinite(item.durationMinutes) && item.durationMinutes >= 1 && isActivityType(item.type)
    && ['manual', 'apple_health', 'health_connect', 'garmin', 'strava', 'other'].includes(item.source)
    && (item.effort === undefined || (Number.isInteger(item.effort) && item.effort >= 1 && item.effort <= 10))
    && (item.distanceKm === undefined || (Number.isFinite(item.distanceKm) && item.distanceKm >= 0))
    && (item.notes === undefined || typeof item.notes === 'string'));
  return validPlan && validActivities ? current as AtlasData : null;
}

export const isAtlasData = (value: unknown): value is AtlasData => migrateAtlasData(value) !== null;
