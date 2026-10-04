import React, { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity as ActivityIcon, ArrowDownToLine, ArrowUpFromLine, CalendarDays, Check, ChevronRight, Dumbbell, Edit3, Flag, History, Plus, Route, ShieldCheck, Trash2, X, Zap } from 'lucide-react';
import { localTrainingRepository, downloadBackup, readBackup } from './data';
import { ACTIVITY_TYPES, type Activity, type ActivityDraft, type ActivityType, type AtlasData, createId, type PlannedSession, typeLabel } from './domain';
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

function App() {
  const [data, setData] = useState<AtlasData>(() => localTrainingRepository.load());
  const [tab, setTab] = useState<Tab>('today');
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [editing, setEditing] = useState<PlannedSession | 'new' | null>(null);
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
      durationMinutes: Number(form.get('durationMinutes')), focus: String(form.get('focus')).trim(),
    };
    if (!next.title || !Number.isFinite(next.durationMinutes) || next.durationMinutes < 1) return;
    setData((previous) => ({ ...previous, plan: [...previous.plan.filter((item) => item.id !== next.id), next].sort((a, b) => a.day - b.day) }));
    setEditing(null); setNotice('Veckoplanen sparades.');
  };
  const removePlan = (id: string) => {
    if (!window.confirm('Ta bort passet från veckoplanen? Genomförda pass i loggen påverkas inte.')) return;
    setData((previous) => ({ ...previous, plan: previous.plan.filter((item) => item.id !== id) })); setEditing(null); setNotice('Passet togs bort från planen.');
  };
  const deleteActivity = (id: string) => {
    if (!window.confirm('Ta bort passet från träningsloggen?')) return;
    setData((previous) => ({ ...previous, activities: previous.activities.filter((item) => item.id !== id) })); setNotice('Passet togs bort ur loggen.');
  };
  const updateGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const title = String(form.get('title')).trim(); const description = String(form.get('description')).trim(); const sessionsPerWeek = Number(form.get('sessionsPerWeek'));
    if (!title || !Number.isInteger(sessionsPerWeek) || sessionsPerWeek < 1 || sessionsPerWeek > 14) return;
    setData((previous) => ({ ...previous, goal: { title, description, sessionsPerWeek, lockedAt: new Date().toISOString() } }));
    setNotice('Ditt mål uppdaterades på ditt initiativ.');
  };
  const importData = async (file?: File) => {
    if (!file) return;
    try { setData(await readBackup(file)); setNotice('Atlas-backupen importerades.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Kunde inte läsa backupfilen.'); }
    if (importRef.current) importRef.current.value = '';
  };

  const tabs: { id: Tab; label: string; Icon: typeof ActivityIcon }[] = [
    { id: 'today', label: 'Idag', Icon: ActivityIcon }, { id: 'plan', label: 'Plan', Icon: CalendarDays },
    { id: 'log', label: 'Logg', Icon: History }, { id: 'goal', label: 'Mål', Icon: Flag },
  ];
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#today" onClick={() => setTab('today')} aria-label="Atlas, startsida"><span className="brand-mark"><ActivityIcon size={19}/></span><span>ATLAS</span></a><span className="topline">Träning på dina villkor</span><button className="backup-icon" aria-label="Exportera backup" title="Exportera backup" onClick={() => downloadBackup(data)}><ArrowDownToLine size={18}/></button></header>
    <main>
      {tab === 'today' && <Today data={data} completed={weekActivities} onLog={(session) => setDraft(emptyDraft(session))} onTab={setTab}/>}
      {tab === 'plan' && <Plan data={data} onEdit={setEditing} onAdd={() => setEditing('new')} onLog={(session) => setDraft(emptyDraft(session))}/>}
      {tab === 'log' && <Log activities={sortedActivities} onAdd={() => setDraft(emptyDraft())} onDelete={deleteActivity}/>}
      {tab === 'goal' && <Goal data={data} onSubmit={updateGoal} onExport={() => downloadBackup(data)} onImport={() => importRef.current?.click()}/>}
    </main>
    <nav className="bottom-nav" aria-label="Huvudmeny">{tabs.map(({ id, label, Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
    {draft && <ActivityModal draft={draft} setDraft={setDraft} onSubmit={addActivity} onClose={() => setDraft(null)}/>}
    {editing && <PlanModal session={editing === 'new' ? undefined : editing} onSubmit={updatePlan(editing)} onClose={() => setEditing(null)} onDelete={editing === 'new' ? undefined : () => removePlan(editing.id)}/>}
    <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importData(event.currentTarget.files?.[0])}/>
  </div>;
}

function Today({ data, completed, onLog, onTab }: { data: AtlasData; completed: Activity[]; onLog: (session: PlannedSession) => void; onTab: (tab: Tab) => void }) {
  const today = new Date(); const todaysSessions = data.plan.filter((session) => session.day === (today.getDay() + 6) % 7);
  const shortDate = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }).format(today);
  return <section className="page">
    <div className="eyebrow">{shortDate}</div><h1>Din träning,<br/><span>i rätt riktning.</span></h1>
    <div className="goal-banner"><div className="goal-icon"><Flag size={19}/></div><div><small>DITT AKTIVA MÅL</small><strong>{data.goal.title}</strong><span>{data.goal.sessionsPerWeek} planerade pass per vecka</span></div><button aria-label="Visa mål" onClick={() => onTab('goal')}><ChevronRight size={18}/></button></div>
    <div className="section-head"><div><div className="eyebrow">DEN HÄR VECKAN</div><h2>Jämnhet före perfektion</h2></div><button className="text-action" onClick={() => onTab('plan')}>Planera <ChevronRight size={15}/></button></div>
    <div className="week-summary"><div className="week-numbers"><div className="count"><strong>{completed.length}</strong><span>genomförda</span></div><div className="count"><strong>{data.goal.sessionsPerWeek}</strong><span>veckomål</span></div></div><div className="progress-track"><i style={{ width: `${Math.min(100, (completed.length / data.goal.sessionsPerWeek) * 100)}%` }}/></div><p>Träningen kan flyttas när livet kommer emellan. Ditt mål ligger fast tills du själv ändrar det.</p></div>
    <div className="section-head upcoming-head"><div><div className="eyebrow">IDAG</div><h2>{todaysSessions.length ? 'Planerat pass' : 'Lämna plats för återhämtning'}</h2></div></div>
    {todaysSessions.length ? todaysSessions.map((session) => <SessionCard key={session.id} session={session} onLog={() => onLog(session)} today/>) : <div className="rest-card"><div className="rest-icon"><Zap size={18}/></div><div><strong>Ingen träning planerad idag</strong><span>Se veckans pass eller lägg till ett när det passar.</span></div><button aria-label="Öppna plan" onClick={() => onTab('plan')}><ChevronRight size={18}/></button></div>}
    <div className="section-head next-head"><div><div className="eyebrow">VECKANS UPPLÄGG</div><h2>Planerade pass</h2></div></div>
    <div className="mini-plan">{data.plan.slice(0, 4).map((session) => <button className="mini-session" key={session.id} onClick={() => onLog(session)}><span className="mini-day">{weekDays[session.day]}</span><span className="mini-title">{session.title}</span><span className="mini-type">{typeLabel(session.type)}</span><ChevronRight size={16}/></button>)}{data.plan.length === 0 && <p className="empty">Din plan är tom. Lägg till pass som passar ditt mål.</p>}</div>
    <div className="principle"><ShieldCheck size={17}/><span><b>Atlas håller kursen.</b> Inga AI-förslag kan ändra ditt mål eller din plan utan att du själv väljer det.</span></div>
  </section>;
}

function SessionCard({ session, onLog, today = false }: { session: PlannedSession; onLog: () => void; today?: boolean }) {
  return <article className={`session-card ${today ? 'featured' : ''}`}><div className="session-top"><span className={`type-dot type-${session.type}`}/><span>{typeLabel(session.type)}</span><span className="dot-sep">·</span><span>{weekDays[session.day]}</span><span className="duration">{session.durationMinutes} min</span></div><h3>{session.title}</h3><p>{session.focus || 'Följ ditt upplägg i en takt som fungerar.'}</p><button className="button-dark" onClick={onLog}><Plus size={16}/>Registrera genomfört pass</button></article>;
}

function Plan({ data, onEdit, onAdd, onLog }: { data: AtlasData; onEdit: (session: PlannedSession) => void; onAdd: () => void; onLog: (session: PlannedSession) => void }) {
  const plannedMinutes = data.plan.reduce((sum, session) => sum + session.durationMinutes, 0);
  return <section className="page">
    <div className="eyebrow">VECKOPLAN</div><h1>En plan som<br/><span>går att leva med.</span></h1>
    <div className="plan-note"><ShieldCheck size={19}/><p>Planen följer ditt mål: <b>{data.goal.title}</b>. Du kan själv redigera eller flytta passen.</p></div>
    <div className="plan-stats"><div><strong>{data.plan.length}</strong><span>pass i veckan</span></div><div><strong>{plannedMinutes}</strong><span>planerade minuter</span></div><div><strong>{data.goal.sessionsPerWeek}</strong><span>veckomål</span></div></div>
    <div className="section-head"><div><div className="eyebrow">DINA PASS</div><h2>Veckans struktur</h2></div><button className="add-button" onClick={onAdd}><Plus size={16}/> Lägg till</button></div>
    <div className="plan-list">{data.plan.map((session) => <div key={session.id} className="plan-item"><div className="plan-day"><strong>{weekDays[session.day]}</strong><span>{typeLabel(session.type)}</span></div><div className="plan-content"><strong>{session.title}</strong><span>{session.focus || 'Eget fokus'} · {session.durationMinutes} min</span><div className="plan-actions"><button className="small-primary" onClick={() => onLog(session)}><Check size={14}/> Logga pass</button><button className="icon-action" onClick={() => onEdit(session)} aria-label={`Redigera ${session.title}`}><Edit3 size={16}/></button></div></div></div>)}{data.plan.length === 0 && <div className="empty-card"><CalendarDays size={22}/><b>Din veckoplan är tom</b><span>Lägg till de pass du vill ha med.</span></div>}</div>
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

function Goal({ data, onSubmit, onExport, onImport }: { data: AtlasData; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onExport: () => void; onImport: () => void }) {
  return <section className="page">
    <div className="eyebrow">DINA GRUNDINSTÄLLNINGAR</div><h1>Målet är<br/><span>ditt att styra.</span></h1>
    <div className="principle goal-principle"><ShieldCheck size={19}/><span>Atlas flyttar inte målstolparna. Ändringar sparas bara när du själv redigerar och väljer <b>Spara mitt mål</b>.</span></div>
    <form key={`${data.goal.title}-${data.goal.description}-${data.goal.sessionsPerWeek}-${data.goal.lockedAt}`} className="goal-form" onSubmit={onSubmit}><label>Mål<input name="title" defaultValue={data.goal.title} maxLength={80} required/></label><label>Vad betyder målet för dig?<textarea name="description" defaultValue={data.goal.description} rows={3} maxLength={280}/></label><label>Pass per vecka<input name="sessionsPerWeek" type="number" min={1} max={14} defaultValue={data.goal.sessionsPerWeek} required/></label><button className="button-dark save-goal" type="submit">Spara mitt mål</button></form>
    <div className="data-card"><div className="eyebrow">DINA DATA</div><h2>Din träning tillhör dig.</h2><p>Informationen sparas bara i den här webbläsaren. Exportera en backup eller importera tidigare Atlas-data. Inget konto eller någon synkning är aktiv i den här versionen.</p><div className="data-actions"><button className="button-outline" onClick={onExport}><ArrowDownToLine size={16}/> Exportera backup</button><button className="button-outline" onClick={onImport}><ArrowUpFromLine size={16}/> Importera backup</button></div></div>
    <div className="about-card"><span className="about-mark"><ActivityIcon size={18}/></span><div><b>Atlas · Grundversion</b><span>Redo att byggas ut med säker synkning och datakällor som Apple Hälsa, Health Connect, Garmin eller Strava.</span></div></div>
  </section>;
}

function ActivityModal({ draft, setDraft, onSubmit, onClose }: { draft: ActivityDraft; setDraft: (draft: ActivityDraft | null) => void; onSubmit: (event: FormEvent) => void; onClose: () => void }) {
  const change = <K extends keyof ActivityDraft>(key: K, value: ActivityDraft[K]) => setDraft({ ...draft, [key]: value });
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={onSubmit}><div className="modal-heading"><div><div className="eyebrow">TRÄNINGSLOGG</div><h2>Registrera pass</h2></div><button type="button" className="icon-action" onClick={onClose} aria-label="Stäng"><X size={19}/></button></div><label>Namn på passet<input autoFocus maxLength={80} required value={draft.title} onChange={(event) => change('title', event.target.value)}/></label><div className="form-grid"><label>Träningstyp<select value={draft.type} onChange={(event) => change('type', event.target.value as ActivityType)}>{ACTIVITY_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label><label>Datum<input type="date" value={draft.date} onChange={(event) => change('date', event.target.value)}/></label><label>Tid (min)<input type="number" min={1} max={1440} required value={draft.durationMinutes} onChange={(event) => change('durationMinutes', Number(event.target.value))}/></label><label>Ansträngning (1–10)<input type="number" min={1} max={10} value={draft.effort ?? 6} onChange={(event) => change('effort', Number(event.target.value))}/></label><label>Distans (km)<input type="number" min={0} step="0.1" value={draft.distanceKm ?? ''} onChange={(event) => change('distanceKm', event.target.value === '' ? undefined : Number(event.target.value))}/></label></div><label>Anteckning <span className="optional">(valfritt)</span><textarea rows={2} maxLength={400} value={draft.notes ?? ''} onChange={(event) => change('notes', event.target.value)}/></label><div className="modal-actions"><button type="button" className="button-outline" onClick={onClose}>Avbryt</button><button className="button-dark" type="submit"><Check size={16}/> Spara i loggen</button></div></form></div>;
}

function PlanModal({ session, onSubmit, onClose, onDelete }: { session?: PlannedSession; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void; onDelete?: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={onSubmit}><div className="modal-heading"><div><div className="eyebrow">VECKOPLAN</div><h2>{session ? 'Redigera pass' : 'Lägg till pass'}</h2></div><button type="button" className="icon-action" onClick={onClose} aria-label="Stäng"><X size={19}/></button></div><label>Namn på passet<input name="title" maxLength={80} defaultValue={session?.title ?? ''} required autoFocus/></label><div className="form-grid"><label>Veckodag<select name="day" defaultValue={session?.day ?? 0}>{weekDays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label><label>Träningstyp<select name="type" defaultValue={session?.type ?? 'strength'}>{ACTIVITY_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label><label>Planerad tid (min)<input name="durationMinutes" type="number" min={1} max={1440} defaultValue={session?.durationMinutes ?? 45} required/></label></div><label>Fokus<input name="focus" maxLength={120} defaultValue={session?.focus ?? ''} placeholder="Till exempel lugn distans"/></label><div className="modal-actions">{onDelete && <button type="button" className="delete-text" onClick={onDelete}><Trash2 size={15}/> Ta bort</button>}<span className="modal-spacer"/><button type="button" className="button-outline" onClick={onClose}>Avbryt</button><button className="button-dark" type="submit"><Check size={16}/> Spara pass</button></div></form></div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
