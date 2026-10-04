import React, { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity as ActivityIcon, ArrowDownToLine, ArrowUpFromLine, CalendarDays, Check, ChevronLeft, ChevronRight, Dumbbell, Edit3, Flag, History, Plus, Route, ShieldCheck, Trash2, X, Zap } from 'lucide-react';
import { localTrainingRepository, downloadBackup, readBackup } from './data';
import { ACTIVITY_TYPES, RUNNING_EVENTS, STRENGTH_LIFTS, createPlanSuggestion, recommendSessionsPerWeek, type Activity, type ActivityDraft, type ActivityType, type AtlasData, createId, type PerformanceTarget, type PlannedSession, type RunningEvent, type StrengthLift, type TrainingGoal, typeLabel, liftLabel, runningEvent } from './domain';
import './styles.css';

type Tab = 'today' | 'plan' | 'log' | 'goal';
const weekDays = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const emptyDraft = (session?: PlannedSession): ActivityDraft => ({
  title: session?.title ?? '', type: session?.type ?? 'strength', durationMinutes: session?.durationMinutes ?? 45,
  effort: 6, date: localDate(), notes: '',
});

function localDate(date = new Date()) {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function mondayOf(date: Date) {
  const monday = new Date(date); monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); return monday;
}
const weekKey = (date: Date) => localDate(mondayOf(date));
const formatDate = (iso: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('sv-SE', options).format(new Date(`${iso}T12:00:00`));
const targetMetricLabel = (target: PerformanceTarget) => target.category === 'strength'
  ? liftLabel(target.metric)
  : runningEvent(target.metric).label;
const formatTargetValue = (target: PerformanceTarget) => target.category === 'strength'
  ? `${target.targetKg} kg`
  : `${Math.floor(target.targetSeconds / 60)}:${String(target.targetSeconds % 60).padStart(2, '0')}`;
const targetSummary = (targets: PerformanceTarget[]) => targets.length
  ? targets.map((target) => `${targetMetricLabel(target)} ${formatTargetValue(target)}`).join(' · ')
  : 'Lägg till konkreta mål under Mål';
const goalTitle = (targets: PerformanceTarget[]) => {
  const strength = targets.some((target) => target.category === 'strength');
  const running = targets.some((target) => target.category === 'running');
  return strength && running ? 'Styrka + kondition' : strength ? 'Styrkemål' : running ? 'Konditionsmål' : 'Mina träningsmål';
};

function App() {
  const [data, setData] = useState<AtlasData>(() => localTrainingRepository.load());
  const [tab, setTab] = useState<Tab>('today');
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [editing, setEditing] = useState<PlannedSession | 'new' | null>(null);
  const [newPlanDay, setNewPlanDay] = useState(0);
  const [notice, setNotice] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localTrainingRepository.save(data); }, [data]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3600); return () => window.clearTimeout(timer); }, [notice]);

  const weekActivities = useMemo(() => data.activities.filter((item) => weekKey(new Date(item.startedAt)) === weekKey(new Date())), [data.activities]);
  const sortedActivities = useMemo(() => [...data.activities].sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [data.activities]);
  const addActivity = (event: FormEvent) => {
    event.preventDefault(); if (!draft?.title.trim()) return;
    const { date, ...details } = draft;
    const activity: Activity = { ...details, id: createId(), startedAt: new Date(`${date}T12:00:00`).toISOString(), source: 'manual' };
    setData((previous) => ({ ...previous, activities: [activity, ...previous.activities] }));
    setDraft(null); setNotice('Passet sparades i träningsloggen.');
  };
  const updatePlan = (session: PlannedSession | 'new') => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const next: PlannedSession = {
      id: session === 'new' ? createId() : session.id,
      day: Number(form.get('day')), title: String(form.get('title')).trim(), type: form.get('type') as ActivityType,
      durationMinutes: Number(form.get('durationMinutes')), distanceKm: Number(form.get('distanceKm')) || undefined, focus: String(form.get('focus')).trim(),
    };
    if (!next.title || !Number.isFinite(next.durationMinutes) || next.durationMinutes < 1) return;
    setData((previous) => ({ ...previous, plan: [...previous.plan.filter((item) => item.id !== next.id), next].sort((a, b) => a.day - b.day) }));
    setEditing(null); setNotice('Veckoplanen sparades.');
  };
  const removePlan = (id: string) => {
    if (!window.confirm('Ta bort passet från veckoplanen? Genomförda pass i loggen påverkas inte.')) return;
    setData((previous) => ({ ...previous, plan: previous.plan.filter((item) => item.id !== id) })); setEditing(null); setNotice('Passet togs bort från planen.');
  };
  const addPlan = (day = 0) => { setNewPlanDay(day); setEditing('new'); };
  const deleteActivity = (id: string) => {
    if (!window.confirm('Ta bort passet från träningsloggen?')) return;
    setData((previous) => ({ ...previous, activities: previous.activities.filter((item) => item.id !== id) })); setNotice('Passet togs bort ur loggen.');
  };
  const saveGoal = (goal: TrainingGoal) => {
    setData((previous) => ({ ...previous, goal: { ...goal, lockedAt: new Date().toISOString() } }));
    setNotice('Dina mål sparades. De ändras bara när du själv gör det.');
  };
  const generatePlan = (goal: TrainingGoal) => {
    if (!goal.targets.length) { setNotice('Lägg till minst ett mätbart mål först.'); return; }
    if (data.plan.length && !window.confirm('Ersätta den nuvarande veckoplanen med ett första förslag utifrån dina mål?')) return;
    const savedGoal = { ...goal, lockedAt: new Date().toISOString() };
    setData((previous) => ({ ...previous, goal: savedGoal, plan: createPlanSuggestion(savedGoal) }));
    setTab('plan'); setNotice('Ett första veckoförslag skapades. Du kan redigera varje pass.');
  };
  const importData = async (file?: File) => {
    if (!file) return;
    try { setData(await readBackup(file)); setNotice('Atlas-backupen importerades.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Kunde inte läsa backupfilen.'); }
    if (importRef.current) importRef.current.value = '';
  };

  const tabs: { id: Tab; label: string; Icon: typeof ActivityIcon }[] = [
    { id: 'today', label: 'Idag', Icon: ActivityIcon }, { id: 'plan', label: 'Vecka', Icon: CalendarDays },
    { id: 'log', label: 'Logg', Icon: History }, { id: 'goal', label: 'Mål', Icon: Flag },
  ];
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#today" onClick={() => setTab('today')} aria-label="Atlas, startsida"><span className="brand-mark"><ActivityIcon size={19}/></span><span>ATLAS</span></a><span className="topline">Träning på dina villkor</span><button className="backup-icon" aria-label="Exportera backup" title="Exportera backup" onClick={() => downloadBackup(data)}><ArrowDownToLine size={18}/></button></header>
    <main>
      {tab === 'today' && <Today data={data} completed={weekActivities} onLog={(session) => setDraft(emptyDraft(session))} onTab={setTab}/>}
      {tab === 'plan' && <Plan data={data} onEdit={setEditing} onAdd={addPlan} onLog={(session) => setDraft(emptyDraft(session))}/>}
      {tab === 'log' && <Log activities={sortedActivities} onAdd={() => setDraft(emptyDraft())} onDelete={deleteActivity}/>}
      {tab === 'goal' && <Goal data={data} onSave={saveGoal} onGeneratePlan={generatePlan} onExport={() => downloadBackup(data)} onImport={() => importRef.current?.click()}/>}
    </main>
    <nav className="bottom-nav" aria-label="Huvudmeny">{tabs.map(({ id, label, Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
    {draft && <ActivityModal draft={draft} setDraft={setDraft} onSubmit={addActivity} onClose={() => setDraft(null)}/>}
    {editing && <PlanModal session={editing === 'new' ? undefined : editing} defaultDay={newPlanDay} onSubmit={updatePlan(editing)} onClose={() => setEditing(null)} onDelete={editing === 'new' ? undefined : () => removePlan(editing.id)}/>}
    <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importData(event.currentTarget.files?.[0])}/>
  </div>;
}

function Today({ data, completed, onLog, onTab }: { data: AtlasData; completed: Activity[]; onLog: (session: PlannedSession) => void; onTab: (tab: Tab) => void }) {
  const today = new Date(); const todaysSessions = data.plan.filter((session) => session.day === (today.getDay() + 6) % 7);
  const shortDate = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }).format(today);
  return <section className="page">
    <div className="eyebrow">{shortDate}</div><h1>Din träning,<br/><span>i rätt riktning.</span></h1>
    <div className="goal-banner"><div className="goal-icon"><Flag size={19}/></div><div><small>DINA MÄTBARA MÅL</small><strong>{goalTitle(data.goal.targets)}</strong><span>{targetSummary(data.goal.targets)}</span><span>{data.goal.sessionsPerWeek || '—'} pass/vecka · {data.goal.recommendedSessionsPerWeek ? `förslag ${data.goal.recommendedSessionsPerWeek}` : 'lägg in mål för ett förslag'}</span></div><button aria-label="Visa mål" onClick={() => onTab('goal')}><ChevronRight size={18}/></button></div>
    <div className="section-head"><div><div className="eyebrow">DEN HÄR VECKAN</div><h2>Jämnhet före perfektion</h2></div><button className="text-action" onClick={() => onTab('plan')}>Planera <ChevronRight size={15}/></button></div>
    <div className="week-summary"><div className="week-numbers"><div className="count"><strong>{completed.length}</strong><span>genomförda</span></div><div className="count"><strong>{data.goal.sessionsPerWeek || '—'}</strong><span>veckomål</span></div></div><div className="progress-track"><i style={{ width: `${data.goal.sessionsPerWeek ? Math.min(100, (completed.length / data.goal.sessionsPerWeek) * 100) : 0}%` }}/></div><p>Planen får anpassas. Dina mätbara mål ändras bara när du själv ändrar dem.</p></div>
    <div className="section-head upcoming-head"><div><div className="eyebrow">IDAG</div><h2>{todaysSessions.length ? 'Planerat pass' : 'Lämna plats för återhämtning'}</h2></div></div>
    {todaysSessions.length ? todaysSessions.map((session) => <SessionCard key={session.id} session={session} onLog={() => onLog(session)} today/>) : <div className="rest-card"><div className="rest-icon"><Zap size={18}/></div><div><strong>Ingen träning planerad idag</strong><span>Se veckans pass eller lägg till ett när det passar.</span></div><button aria-label="Öppna plan" onClick={() => onTab('plan')}><ChevronRight size={18}/></button></div>}
    <div className="section-head next-head"><div><div className="eyebrow">VECKANS UPPLÄGG</div><h2>Planerade pass</h2></div></div>
    <div className="mini-plan">{[...data.plan].sort((a, b) => a.day - b.day).map((session) => <button className="mini-session" key={session.id} onClick={() => onLog(session)}><span className="mini-day">{weekDays[session.day]}</span><span className="mini-title">{session.title}</span><span className="mini-type">{typeLabel(session.type)}</span><ChevronRight size={16}/></button>)}{data.plan.length === 0 && <p className="empty">Din plan är tom. Lägg till pass som passar ditt mål.</p>}</div>
    <div className="principle"><ShieldCheck size={17}/><span><b>Atlas håller kursen.</b> Inga AI-förslag kan ändra ditt mål eller din plan utan att du själv väljer det.</span></div>
  </section>;
}

function SessionCard({ session, onLog, today = false }: { session: PlannedSession; onLog: () => void; today?: boolean }) {
  return <article className={`session-card ${today ? 'featured' : ''}`}><div className="session-top"><span className={`type-dot type-${session.type}`}/><span>{typeLabel(session.type)}</span><span className="dot-sep">·</span><span>{weekDays[session.day]}</span><span className="duration">{session.durationMinutes} min</span></div><h3>{session.title}</h3><p>{session.focus || 'Följ ditt upplägg i en takt som fungerar.'}</p><button className="button-dark" onClick={onLog}><Plus size={16}/>Registrera genomfört pass</button></article>;
}

function Plan({ data, onEdit, onAdd, onLog }: { data: AtlasData; onEdit: (session: PlannedSession) => void; onAdd: (day?: number) => void; onLog: (session: PlannedSession) => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = mondayOf(new Date()); weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const dates = weekDays.map((_, day) => { const date = new Date(weekStart); date.setDate(date.getDate() + day); return date; });
  const plannedMinutes = data.plan.reduce((sum, session) => sum + session.durationMinutes, 0);
  const runKm = data.plan.reduce((sum, session) => sum + (session.type === 'running' ? session.distanceKm ?? 0 : 0), 0);
  const weekLabel = `${formatDate(localDate(dates[0]))} – ${formatDate(localDate(dates[6]))}`;
  const isCurrentWeek = weekOffset === 0;
  return <section className="page">
    <div className="eyebrow">VECKOKALENDER</div><h1>Din träningsvecka.</h1>
    <div className="plan-note"><ShieldCheck size={19}/><p>Målen styr planförslaget, men de ändras inte av planen. Det här är en första veckostruktur; progression och periodisering behöver fler uppgifter om ditt nuläge.</p></div>
    <div className="calendar-toolbar"><button className="icon-action" onClick={() => setWeekOffset((offset) => offset - 1)} aria-label="Föregående vecka"><ChevronLeft size={18}/></button><div><strong>{weekLabel}</strong><span>{isCurrentWeek ? 'Den här veckan' : 'Veckomallen visas för valt datum'}</span></div><button className="icon-action" onClick={() => setWeekOffset((offset) => offset + 1)} aria-label="Nästa vecka"><ChevronRight size={18}/></button></div>
    <div className="calendar-summary"><strong>{data.plan.length} pass</strong><span>{data.plan.filter((session) => session.type === 'strength').length} styrka</span><span>{data.plan.filter((session) => session.type === 'running').length} löpning{runKm ? ` · ${runKm.toLocaleString('sv-SE')} km` : ''}</span><span>{plannedMinutes} min</span></div>
    <div className="section-head calendar-section-head"><div><div className="eyebrow">DIN MALL</div><h2>Pass och vilodagar</h2></div><button className="add-button" onClick={() => onAdd((new Date().getDay() + 6) % 7)}><Plus size={16}/> Lägg till</button></div>
    <div className="calendar-week">{weekDays.map((day, index) => {
      const sessions = data.plan.filter((session) => session.day === index);
      const isToday = isCurrentWeek && index === (new Date().getDay() + 6) % 7;
      const date = dates[index];
      return <div className={`calendar-day ${isToday ? 'is-today' : ''}`} key={day}>
        <div className="calendar-date"><span>{day}</span><strong>{date.getDate()}</strong></div>
        <div className="calendar-day-content">{sessions.length ? sessions.map((session) => <article className={`calendar-session session-${session.type}`} key={session.id}>
          <button className="calendar-session-main" onClick={() => onEdit(session)}><strong>{session.title}</strong><span>{session.distanceKm ? `${session.distanceKm} km · ` : ''}{session.durationMinutes} min</span></button>
          <div className="calendar-session-actions"><button className="calendar-log" onClick={() => onLog(session)} aria-label={`Logga ${session.title}`}><Check size={14}/></button><button className="calendar-edit" onClick={() => onEdit(session)} aria-label={`Redigera ${session.title}`}><Edit3 size={14}/></button></div>
        </article>) : <div className="rest-day"><span>Vila / inget planerat</span><button onClick={() => onAdd(index)} aria-label={`Lägg till pass ${day}`}><Plus size={15}/></button></div>}</div>
      </div>;
    })}</div>
    <div className="calendar-footer"><span>Veckoplanen upprepas som en mall. Redigera den när du vill ändra strukturen.</span></div>
  </section>;
}

function Log({ activities, onAdd, onDelete }: { activities: Activity[]; onAdd: () => void; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState<'all' | ActivityType>('all');
  const visible = activities.filter((item) => filter === 'all' || item.type === filter);
  const minutes = visible.reduce((sum, item) => sum + item.durationMinutes, 0);
  return <section className="page">
    <div className="eyebrow">GENOMFÖRD TRÄNING</div><h1>Din träningslogg.</h1>
    <div className="log-summary"><div><strong>{visible.length}</strong><span>pass registrerade</span></div><div><strong>{minutes}</strong><span>minuter totalt</span></div><button className="round-add" onClick={onAdd} aria-label="Lägg till pass"><Plus size={20}/></button></div>
    <div className="filters"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Alla</button>{ACTIVITY_TYPES.map((item) => <button key={item.value} className={filter === item.value ? 'selected' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
    <div className="activity-list">{visible.map((item) => <article className="activity-row" key={item.id}><div className={`activity-icon type-${item.type}`}>{item.type === 'strength' ? <Dumbbell size={17}/> : item.type === 'running' ? <Route size={17}/> : <ActivityIcon size={17}/>}</div><div className="activity-main"><div className="activity-meta">{formatDate(item.startedAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })} · {typeLabel(item.type)}</div><strong>{item.title}</strong><span>{item.durationMinutes} min{item.effort ? ` · Ansträngning ${item.effort}/10` : ''}{item.distanceKm ? ` · ${item.distanceKm} km` : ''}</span>{item.notes && <p>{item.notes}</p>}</div><button className="delete-action" aria-label={`Ta bort ${item.title}`} onClick={() => onDelete(item.id)}><Trash2 size={16}/></button></article>)}{visible.length === 0 && <div className="empty-card"><History size={22}/><b>Inga pass i loggen ännu</b><span>Registrera ett pass när du tränat. Planen ligger kvar separat.</span><button className="button-dark" onClick={onAdd}><Plus size={15}/> Lägg till pass</button></div>}</div>
  </section>;
}

function Goal({ data, onSave, onGeneratePlan, onExport, onImport }: { data: AtlasData; onSave: (goal: TrainingGoal) => void; onGeneratePlan: (goal: TrainingGoal) => void; onExport: () => void; onImport: () => void }) {
  const [targets, setTargets] = useState<PerformanceTarget[]>(data.goal.targets);
  const [availableDays, setAvailableDays] = useState<number[]>(data.goal.availableDays);
  const [description, setDescription] = useState(data.goal.description);
  const [sessionOverride, setSessionOverride] = useState<number | null>(data.goal.sessionsPerWeek !== data.goal.recommendedSessionsPerWeek ? data.goal.sessionsPerWeek : null);
  const [newLift, setNewLift] = useState<StrengthLift>('deadlift');
  const [newRun, setNewRun] = useState<RunningEvent>('10k');
  const [error, setError] = useState('');
  const recommendation = recommendSessionsPerWeek(targets, availableDays);
  const sessions = sessionOverride ?? recommendation;

  useEffect(() => {
    setTargets(data.goal.targets); setAvailableDays(data.goal.availableDays); setDescription(data.goal.description);
    setSessionOverride(data.goal.sessionsPerWeek !== data.goal.recommendedSessionsPerWeek ? data.goal.sessionsPerWeek : null);
    setError('');
  }, [data.goal.lockedAt]);

  const makeGoal = (): TrainingGoal => ({
    ...data.goal, title: goalTitle(targets), description, targets, availableDays,
    sessionsPerWeek: sessions, recommendedSessionsPerWeek: recommendation,
  });
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!targets.length) { setError('Lägg till minst ett konkret mål.'); return; }
    if (targets.some((target) => target.category === 'strength' ? target.targetKg <= 0 : target.targetSeconds <= 0)) { setError('Fyll i ett målvärde för varje mål. Löpning anges som minuter:sekunder.'); return; }
    if (!availableDays.length) { setError('Välj minst en dag då du kan träna.'); return; }
    if (!Number.isInteger(sessions) || sessions < 1 || sessions > availableDays.length) { setError('Antalet pass måste rymmas inom de dagar du valt.'); return; }
    setError(''); onSave(makeGoal());
  };
  const addStrengthTarget = () => {
    if (targets.some((target) => target.category === 'strength' && target.metric === newLift)) { setError('Det målet finns redan.'); return; }
    setTargets((items) => [...items, { id: createId(), category: 'strength', metric: newLift, targetKg: 0 }]); setError('');
  };
  const addRunningTarget = () => {
    if (targets.some((target) => target.category === 'running' && target.metric === newRun)) { setError('Det målet finns redan.'); return; }
    setTargets((items) => [...items, { id: createId(), category: 'running', metric: newRun, targetSeconds: 0 }]); setError('');
  };
  const updateTarget = (next: PerformanceTarget) => setTargets((items) => items.map((item) => item.id === next.id ? next : item));
  const removeTarget = (id: string) => { setTargets((items) => items.filter((item) => item.id !== id)); setError(''); };
  const toggleDay = (day: number) => {
    setAvailableDays((days) => days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort((a, b) => a - b));
    setSessionOverride(null);
  };
  const categoryTargets = (category: 'strength' | 'running') => targets.filter((target) => target.category === category);

  return <section className="page">
    <div className="eyebrow">MÅL OCH TRÄNINGSRAMAR</div><h1>Mätbara mål.<br/><span>Din riktning.</span></h1>
    <div className="principle goal-principle"><ShieldCheck size={19}/><span><b>Målen är dina.</b> Atlas får föreslå och ändra träningsplanen, men flyttar aldrig dina målvärden utan att du själv ändrar dem.</span></div>
    <form className="goal-form" onSubmit={save}>
      <section className="goal-group"><div className="goal-group-heading"><div><div className="eyebrow">STYRKA</div><h2>Välj lyft och målvikt</h2></div><Dumbbell size={20}/></div>
        {categoryTargets('strength').map((target) => <TargetCard key={`${target.id}-${data.goal.lockedAt}`} target={target} onChange={updateTarget} onRemove={() => removeTarget(target.id)}/>)}
        <div className="add-target-row"><select aria-label="Välj styrkemål" value={newLift} onChange={(event) => setNewLift(event.target.value as StrengthLift)}>{STRENGTH_LIFTS.map((lift) => <option key={lift.value} value={lift.value}>{lift.label} · 1RM</option>)}</select><button type="button" className="button-outline" onClick={addStrengthTarget}><Plus size={15}/> Lägg till</button></div>
      </section>
      <section className="goal-group"><div className="goal-group-heading"><div><div className="eyebrow">KONDITION</div><h2>Välj distans och måltid</h2></div><Route size={20}/></div>
        {categoryTargets('running').map((target) => <TargetCard key={`${target.id}-${data.goal.lockedAt}`} target={target} onChange={updateTarget} onRemove={() => removeTarget(target.id)}/>)}
        <div className="add-target-row"><select aria-label="Välj konditionsmål" value={newRun} onChange={(event) => setNewRun(event.target.value as RunningEvent)}>{RUNNING_EVENTS.map((event) => <option key={event.value} value={event.value}>{event.label}</option>)}</select><button type="button" className="button-outline" onClick={addRunningTarget}><Plus size={15}/> Lägg till</button></div>
      </section>
      <section className="goal-group"><div className="goal-group-heading"><div><div className="eyebrow">DIN VECKA</div><h2>Vilka dagar kan du träna?</h2></div><CalendarDays size={20}/></div>
        <p className="field-help">En enkel startregel just nu: 3 pass för ett träningsområde eller 4 om du valt både styrka och löpning, högst så många dagar du markerat. Det är ett grovt första förslag, inte en personlig träningsordination. Nuläge, träningsvana, återhämtning och måldatum behövs för en genomarbetad plan.</p>
        <div className="day-picker">{weekDays.map((day, index) => <label key={day} className={availableDays.includes(index) ? 'day-selected' : ''}><input type="checkbox" checked={availableDays.includes(index)} onChange={() => toggleDay(index)}/><span>{day}</span></label>)}</div>
        <div className="recommendation-card"><div><span className="eyebrow">ATLAS FÖRSLAG</span><strong>{recommendation ? `${recommendation} pass per vecka` : 'Välj mål och träningsdagar'}</strong></div><label>Mitt val<input aria-label="Pass per vecka" type="number" min={1} max={Math.max(1, availableDays.length)} value={sessions || ''} onChange={(event) => setSessionOverride(event.target.value ? Number(event.target.value) : null)} disabled={!recommendation}/></label></div>
        {sessionOverride !== null && sessionOverride !== recommendation && <button type="button" className="reset-recommendation" onClick={() => setSessionOverride(null)}>Använd Atlas förslag ({recommendation})</button>}
      </section>
      <label>Vad ska planen ta hänsyn till? <span className="optional">(valfritt)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={280} placeholder="Till exempel annan träning, tillgänglig utrustning eller prioriteringar."/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button-dark save-goal" type="submit">Spara mina mål</button>
      <button className="button-outline goal-plan-button" type="button" onClick={() => {
        if (!targets.length || targets.some((target) => target.category === 'strength' ? target.targetKg <= 0 : target.targetSeconds <= 0) || !availableDays.length || !Number.isInteger(sessions) || sessions < 1 || sessions > availableDays.length) {
          setError('Fyll i målvärden och välj träningsdagar innan planen skapas.'); return;
        }
        setError(''); onGeneratePlan(makeGoal());
      }}>Skapa första veckoförslaget</button>
    </form>
    <div className="data-card"><div className="eyebrow">DINA DATA</div><h2>Din träning tillhör dig.</h2><p>Informationen sparas bara i den här webbläsaren. Exportera en backup eller importera tidigare Atlas-data. Inget konto eller någon synkning är aktiv i den här versionen.</p><div className="data-actions"><button className="button-outline" onClick={onExport}><ArrowDownToLine size={16}/> Exportera backup</button><button className="button-outline" onClick={onImport}><ArrowUpFromLine size={16}/> Importera backup</button></div></div>
    <div className="about-card"><span className="about-mark"><ActivityIcon size={18}/></span><div><b>Atlas · Grundversion</b><span>Den här versionen gör mål och veckostruktur konkreta. Den skapar ännu inte en full periodiserad träningsplan.</span></div></div>
  </section>;
}

function TargetCard({ target, onChange, onRemove }: { target: PerformanceTarget; onChange: (target: PerformanceTarget) => void; onRemove: () => void }) {
  const [currentText, setCurrentText] = useState(target.category === 'strength' ? target.currentKg?.toString() ?? '' : secondsToClock(target.currentSeconds));
  const [targetText, setTargetText] = useState(target.category === 'strength' ? String(target.targetKg || '') : secondsToClock(target.targetSeconds));
  useEffect(() => {
    setCurrentText(target.category === 'strength' ? target.currentKg?.toString() ?? '' : secondsToClock(target.currentSeconds));
    setTargetText(target.category === 'strength' ? String(target.targetKg || '') : secondsToClock(target.targetSeconds));
  }, [target.id]);
  const title = target.category === 'strength' ? `${liftLabel(target.metric)} · 1RM` : `${runningEvent(target.metric).label} · tid`;
  const updateDate = (targetDate: string) => onChange({ ...target, targetDate: targetDate || undefined } as PerformanceTarget);
  return <article className={`target-card target-${target.category}`}>
    <div className="target-card-heading"><div><span className="target-category-label">{target.category === 'strength' ? 'STYRKA' : 'KONDITION'}</span><strong>{title}</strong></div><button type="button" className="delete-action" onClick={onRemove} aria-label={`Ta bort ${title}`}><Trash2 size={16}/></button></div>
    <div className="target-value-grid">
      {target.category === 'strength' ? <>
        <label>Nuläge (kg) <span className="optional">(valfritt)</span><input type="number" min={0} step="0.5" inputMode="decimal" value={currentText} onChange={(event) => { const value = event.target.value; setCurrentText(value); onChange({ ...target, currentKg: value ? Number(value) : undefined }); }}/></label>
        <label>Mål (kg)<input type="number" min={1} step="0.5" inputMode="decimal" value={targetText} onChange={(event) => { const value = event.target.value; setTargetText(value); onChange({ ...target, targetKg: Number(value) || 0 }); }}/></label>
      </> : <>
        <label>Nuläge (min:sek) <span className="optional">(valfritt)</span><input type="text" inputMode="numeric" placeholder="55:00" value={currentText} onChange={(event) => { const value = event.target.value; setCurrentText(value); onChange({ ...target, currentSeconds: clockToSeconds(value) ?? undefined }); }}/></label>
        <label>Måltid (min:sek)<input type="text" inputMode="numeric" placeholder="45:00" value={targetText} onChange={(event) => { const value = event.target.value; setTargetText(value); onChange({ ...target, targetSeconds: clockToSeconds(value) ?? 0 }); }}/></label>
      </>}
      <label>Måldatum <span className="optional">(valfritt)</span><input type="date" value={target.targetDate ?? ''} onChange={(event) => updateDate(event.target.value)}/></label>
    </div>
  </article>;
}

function clockToSeconds(value: string) {
  const match = value.trim().match(/^(\d{1,3}):(\d{1,2})$/);
  if (!match || Number(match[2]) > 59) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}
function secondsToClock(value?: number) { return value ? `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}` : ''; }

function ActivityModal({ draft, setDraft, onSubmit, onClose }: { draft: ActivityDraft; setDraft: (draft: ActivityDraft | null) => void; onSubmit: (event: FormEvent) => void; onClose: () => void }) {
  const change = <K extends keyof ActivityDraft>(key: K, value: ActivityDraft[K]) => setDraft({ ...draft, [key]: value });
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={onSubmit}><div className="modal-heading"><div><div className="eyebrow">TRÄNINGSLOGG</div><h2>Registrera pass</h2></div><button type="button" className="icon-action" onClick={onClose} aria-label="Stäng"><X size={19}/></button></div><label>Namn på passet<input autoFocus maxLength={80} required value={draft.title} onChange={(event) => change('title', event.target.value)}/></label><div className="form-grid"><label>Träningstyp<select value={draft.type} onChange={(event) => change('type', event.target.value as ActivityType)}>{ACTIVITY_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label><label>Datum<input type="date" value={draft.date} onChange={(event) => change('date', event.target.value)}/></label><label>Tid (min)<input type="number" min={1} max={1440} required value={draft.durationMinutes} onChange={(event) => change('durationMinutes', Number(event.target.value))}/></label><label>Ansträngning (1–10)<input type="number" min={1} max={10} value={draft.effort ?? 6} onChange={(event) => change('effort', Number(event.target.value))}/></label><label>Distans (km)<input type="number" min={0} step="0.1" value={draft.distanceKm ?? ''} onChange={(event) => change('distanceKm', event.target.value === '' ? undefined : Number(event.target.value))}/></label></div><label>Anteckning <span className="optional">(valfritt)</span><textarea rows={2} maxLength={400} value={draft.notes ?? ''} onChange={(event) => change('notes', event.target.value)}/></label><div className="modal-actions"><button type="button" className="button-outline" onClick={onClose}>Avbryt</button><button className="button-dark" type="submit"><Check size={16}/> Spara i loggen</button></div></form></div>;
}

function PlanModal({ session, defaultDay = 0, onSubmit, onClose, onDelete }: { session?: PlannedSession; defaultDay?: number; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void; onDelete?: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={onSubmit}><div className="modal-heading"><div><div className="eyebrow">VECKOPLAN</div><h2>{session ? 'Redigera pass' : 'Lägg till pass'}</h2></div><button type="button" className="icon-action" onClick={onClose} aria-label="Stäng"><X size={19}/></button></div><label>Namn på passet<input name="title" maxLength={80} defaultValue={session?.title ?? ''} required autoFocus/></label><div className="form-grid"><label>Veckodag<select name="day" defaultValue={session?.day ?? defaultDay}>{weekDays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label><label>Träningstyp<select name="type" defaultValue={session?.type ?? 'strength'}>{ACTIVITY_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label><label>Planerad tid (min)<input name="durationMinutes" type="number" min={1} max={1440} defaultValue={session?.durationMinutes ?? 45} required/></label><label>Distans (km)<input name="distanceKm" type="number" min={0} step="0.1" defaultValue={session?.distanceKm ?? ''}/></label></div><label>Fokus<input name="focus" maxLength={120} defaultValue={session?.focus ?? ''} placeholder="Till exempel lugn distans"/></label><div className="modal-actions">{onDelete && <button type="button" className="delete-text" onClick={onDelete}><Trash2 size={15}/> Ta bort</button>}<span className="modal-spacer"/><button type="button" className="button-outline" onClick={onClose}>Avbryt</button><button className="button-dark" type="submit"><Check size={16}/> Spara pass</button></div></form></div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
