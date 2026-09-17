import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
  Activity, AlertTriangle, Ambulance as AmbulanceIcon, ArrowDownRight, ArrowUpRight, BarChart3, Bell, CarFront, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, Clock3, Command, Contact, Download, Droplet, Edit3,  FileClock, Filter, FlaskConical, Gauge,
  HeartPulse, History as HistoryIcon, Hospital as HospitalIcon, LayoutDashboard, ListFilter, Lock, LogIn, Mail, MapPin, Menu, MessageSquare,
  Navigation, Phone, Pill, Play, Radio, RefreshCw, Search, Send, Settings, Shield, Siren, SlidersHorizontal, Sparkles,
  Square, Stethoscope, Timer, Trash2, UserRound, Users, X, Zap, type LucideIcon,
} from 'lucide-react';
import { Link, Redirect, Route, Router, Switch, useLocation } from 'wouter';
import {
  ambulances as seedAmbulances, analyticsData, drivers as seedDrivers, history, hospitals as seedHospitals,
  demoOwner, incidents as seedIncidents, loginUsers, notifications as seedNotifications, policeStations as seedPoliceStations,
  responseTeams as seedResponseTeams, vehicles as seedVehicles, type Ambulance, type Driver, type Hospital,
  type Incident, type IncidentStatus, type Notification, type PoliceStation, type ResponseTeam, type Severity,
  type Vehicle, type LoginUser, type PersonalInfo, type EmergencyContact,
} from './data/mock-data';
import { SimulationStoreProvider, useSimulationStore } from './engine/SimulationStore';
import { SimulatorPage, TelemetryPage, AnalysisPage, ReportsPage, ReportDetailPage, MethodologyPage, SimulationAnalyticsSection } from './crash/pages';
import { Panel, Sparkline, AreaChart, MiniBars, Donut, GaugeRing, RankedBars } from './components/dataviz';
import { incidentLoadByRecency, riskIndexSeries, kpiSpark, severityMix, typeMix, zoneLoad, weeklyResponseMinutes } from './data/derived';
import { history as historySeed } from './data/mock-data';

type Toast = { id: number; message: string; tone?: 'success' | 'warning' | 'info' };
type Icon = LucideIcon;
type AppProps = { pushToast: (message: string, tone?: Toast['tone']) => void };

type AppStore = {
  incidents: Incident[];
  setIncidents: Dispatch<SetStateAction<Incident[]>>;
  vehicles: Vehicle[];
  setVehicles: Dispatch<SetStateAction<Vehicle[]>>;
  drivers: Driver[];
  setDrivers: Dispatch<SetStateAction<Driver[]>>;
  notifications: Notification[];
  addNotification: (title: string, description: string, tone: Notification['tone']) => void;
  ambulances: Ambulance[];
  setAmbulances: Dispatch<SetStateAction<Ambulance[]>>;
  userProfile: PersonalInfo;
  setUserProfile: Dispatch<SetStateAction<PersonalInfo>>;
};
const AppContext = createContext<AppStore | null>(null);
const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('RAKSHA SETU app state is unavailable');
  return context;
};

const pageMeta: Record<string, { title: string; description: string }> = {
  '/overview': { title: 'Overview', description: 'Real-time emergency response and road safety operations.' },
  '/incidents': { title: 'Live Incidents', description: 'Triage, dispatch and coordinate active responses.' },
  '/vehicles': { title: 'Vehicles', description: 'Monitor fleet readiness, telemetry and deployment status.' },
  '/drivers': { title: 'Drivers', description: 'Review driver safety, assignments and availability.' },
  '/emergency-services': { title: 'Emergency Services', description: 'Police, ambulance and hospital capacity in one view.' },
  '/response-team': { title: 'Response Team', description: 'Coordinate responder teams and readiness by zone.' },
  '/history': { title: 'Incident History', description: 'Review completed events and operational outcomes.' },
  '/analytics': { title: 'Analytics', description: 'Patterns and performance across the response network.' },
  '/demo': { title: 'Demo Simulator', description: 'Run a local response drill without contacting live services.' },
  '/profile': { title: 'Personal Info', description: 'Registered identity and medical profile shared during emergencies.' },
  '/settings': { title: 'Settings', description: 'Configure display, alerts and operating preferences.' },
  '/simulator': { title: 'Crash Simulator', description: 'Run deterministic crash physics with live 2D vehicle dynamics.' },
  '/telemetry': { title: 'Live Telemetry', description: 'Stream speed, acceleration and impact state from the simulation engine.' },
  '/analysis': { title: 'Crash Analysis', description: 'Physics and severity breakdown of the most recent simulation.' },
  '/reports': { title: 'Crash Reports', description: 'Stored simulation reports derived from the physics engine.' },
  '/reports/:id': { title: 'Crash Report', description: 'Detailed report for a stored crash simulation.' },
  '/methodology': { title: 'About & Methodology', description: 'Formulas, severity model, validation case and disclaimers.' },
};

const navGroups: { label: string; items: { href: string; label: string; icon: Icon }[] }[] = [
  { label: 'Command', items: [
    { href: '/overview', label: 'Overview', icon: LayoutDashboard },
    { href: '/incidents', label: 'Live Incidents', icon: Siren },
  ] },
  { label: 'Resources', items: [
    { href: '/vehicles', label: 'Vehicles', icon: CarFront },
    { href: '/drivers', label: 'Drivers', icon: UserRound },
    { href: '/emergency-services', label: 'Emergency Services', icon: HospitalIcon },
    { href: '/response-team', label: 'Response Team', icon: Users },
  ] },
  { label: 'Review', items: [
    { href: '/history', label: 'Incident History', icon: HistoryIcon },
    { href: '/analytics', label: 'Analytics', icon: Activity },
  ] },
  { label: 'Crash Lab', items: [
    { href: '/simulator', label: 'Crash Simulator', icon: Gauge },
    { href: '/telemetry', label: 'Live Telemetry', icon: Activity },
    { href: '/analysis', label: 'Crash Analysis', icon: Zap },
    { href: '/reports', label: 'Crash Reports', icon: FileClock },
  ] },
  { label: 'Tools', items: [
    { href: '/profile', label: 'Personal Info', icon: Contact },
    { href: '/demo', label: 'Demo Simulator', icon: Play },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/methodology', label: 'About & Methodology', icon: Command },
  ] },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function toneFor(value: string) {
  const key = value.toLowerCase();
  if (key === 'medium' || key === 'moderate') return 'moderate';
  if (key === 'responding' || key === 'online' || key === 'dispatched' || key === 'on duty') return 'good';
  if (key === 'verification' || key === 'monitoring' || key === 'at scene' || key === 'busy' || key === 'driving') return 'moderate';
  if (key === 'escalated' || key === 'critical' || key === 'high' || key === 'check required') return 'critical';
  if (key === 'resolved' || key === 'safe' || key === 'available' || key === 'ready') return 'good';
  return key;
}

function StatusBadge({ label, tone }: { label: string; tone?: string }) {
  const tones: Record<string, string> = {
    critical: 'bg-red-50 text-red-700 border-red-200', high: 'bg-orange-50 text-orange-700 border-orange-200',
    moderate: 'bg-amber-50 text-amber-700 border-amber-200', low: 'bg-sky-50 text-sky-700 border-sky-200',
    good: 'bg-emerald-50 text-emerald-700 border-emerald-200', resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    verification: 'bg-violet-50 text-violet-700 border-violet-200', monitoring: 'bg-amber-50 text-amber-700 border-amber-200',
    escalated: 'bg-red-50 text-red-700 border-red-200', responding: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    online: 'bg-emerald-50 text-emerald-700 border-emerald-200', offline: 'bg-slate-100 text-slate-600 border-slate-200',
    maintenance: 'bg-slate-100 text-slate-600 border-slate-200', driving: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'off duty': 'bg-slate-100 text-slate-600 border-slate-200', 'at scene': 'bg-amber-50 text-amber-700 border-amber-200',
    available: 'bg-emerald-50 text-emerald-700 border-emerald-200', busy: 'bg-orange-50 text-orange-700 border-orange-200',
    full: 'bg-red-50 text-red-700 border-red-200', receiving: 'bg-amber-50 text-amber-700 border-amber-200',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-200', transferred: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };
  const key = (tone || toneFor(label)).toLowerCase();
  return <span data-testid={`status-${label.toLowerCase().replace(/\s/g, '-')}`} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em]', tones[key] || 'bg-slate-100 text-slate-600 border-slate-200')}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span>;
}

function MetricCard({ label, value, detail, icon: IconComponent, accent = 'teal', trend, spark }: { label: string; value: string; detail: string; icon: Icon; accent?: string; trend?: 'up' | 'down'; spark?: number[] }) {
  const colors: Record<string, string> = { teal: 'bg-cyan-50 text-cyan-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', blue: 'bg-blue-50 text-blue-700' };
  const sparks: Record<string, string> = { teal: '#f08a3e', amber: '#ffc657', red: '#ff5c5c', blue: '#f08a3e' };
  return <div data-testid={`metric-${label.toLowerCase().replace(/\s/g, '-')}`} className="relative overflow-hidden rounded-xl border border-slate-200 bg-card p-4">
    <div className="flex items-start justify-between"><div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', colors[accent])}><IconComponent size={17} /></div>{trend && <span className={cn('flex items-center gap-0.5 text-[11px] font-bold', trend === 'up' ? 'text-emerald-600' : 'text-orange-600')}>{trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {trend === 'up' ? 'vs yesterday' : 'requires attention'}</span>}</div>
    <p className="mt-4 text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">{label}</p><p className="mt-1 font-mono text-2xl font-medium tracking-tight text-slate-800">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p>
    {spark && spark.length > 1 && <div className="pointer-events-none absolute bottom-0 right-0 opacity-50"><Sparkline values={spark} color={sparks[accent] ?? '#f08a3e'} width={150} height={44} /></div>}
  </div>;
}

function SectionHeading({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="mb-4 flex items-end justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-cyan-700">{eyebrow}</p><h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-800">{title}</h2></div>{action && <button data-testid={`button-${action.toLowerCase().replace(/\s/g, '-')}`} onClick={onAction} className="inline-flex items-center gap-1 text-xs font-bold text-cyan-700 hover:text-cyan-900">{action}<ChevronRight size={14} /></button>}</div>;
}

function EmptyState({ title, detail, icon: IconComponent = ListFilter }: { title: string; detail: string; icon?: Icon }) {
  return <div data-testid="empty-state" className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center"><IconComponent size={26} className="text-slate-400" /><p className="mt-3 text-sm font-bold text-slate-700">{title}</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{detail}</p></div>;
}

function Modal({ title, children, onClose, testId = 'modal' }: { title: string; children: ReactNode; onClose: () => void; testId?: string }) {
  return <div className="fixed inset-0 z-[55] flex items-center justify-center p-4"><button aria-label="Close modal overlay" onClick={onClose} className="absolute inset-0 bg-slate-950/35" /><section data-testid={testId} className="animate-rise-in relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><h2 className="text-base font-extrabold text-slate-800">{title}</h2><button aria-label="Close modal" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button></div>{children}</section></div>;
}

function AppShell({ children, toasts, pushToast, onLogout }: { children: ReactNode; toasts: Toast[]; pushToast: AppProps['pushToast']; onLogout: () => void }) {
  const [location, setLocation] = useLocation();
  const { incidents, notifications, vehicles, drivers, ambulances } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('Jaipur Control Center');
  const [readNotifications, setReadNotifications] = useState<string[]>(notifications.filter((item) => !item.unread).map((item) => item.id));
  const meta = pageMeta[location] || pageMeta['/overview'];
  const unread = notifications.filter((item) => !readNotifications.includes(item.id)).length;
  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    const rows = [
      ...incidents.map((item) => ({ id: item.id, label: item.code, detail: `${item.type} · ${item.location}`, href: '/incidents', kind: 'Incident' })),
      ...vehicles.map((item) => ({ id: item.id, label: item.id, detail: `${item.registration} · ${item.location}`, href: '/vehicles', kind: 'Vehicle' })),
      ...drivers.map((item) => ({ id: item.id, label: item.name, detail: `${item.phone} · ${item.vehicle}`, href: '/drivers', kind: 'Driver' })),
      ...seedHospitals.map((item) => ({ id: item.id, label: item.name, detail: `${item.location} · Hospital`, href: '/emergency-services', kind: 'Hospital' })),
      ...seedPoliceStations.map((item) => ({ id: item.id, label: item.name, detail: `${item.location} · Police station`, href: '/emergency-services', kind: 'Police station' })),
      ...ambulances.map((item) => ({ id: item.id, label: item.id, detail: `${item.location} · Ambulance`, href: '/emergency-services', kind: 'Ambulance' })),
    ];
    return rows.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query)).slice(0, 7);
  }, [incidents, vehicles, drivers, ambulances, search]);
  const navigate = (href: string) => { setLocation(href); setMobileOpen(false); setSearchOpen(false); setSearch(''); };
  const markAllRead = () => { setReadNotifications(notifications.map((item) => item.id)); pushToast('All notifications marked as read', 'success'); };
  return <div className="flex min-h-[100dvh] bg-[#f2f5f7] text-slate-800">
    {mobileOpen && <button aria-label="Close navigation" data-testid="button-close-mobile-nav" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />}
    <aside className={cn('fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[#2d4050] bg-cyan-600 text-slate-300 transition-all duration-200 lg:relative lg:z-0 lg:translate-x-0', collapsed ? 'w-[76px]' : 'w-[252px]', mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
      <div className="flex h-[76px] items-center gap-3 border-b border-[#2d4050] px-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f3c44e] text-[#172634]"><Shield size={20} strokeWidth={2.5} /></div>{!collapsed && <div className="min-w-0"><p className="text-[15px] font-extrabold tracking-[.12em] text-white">RAKSHA SETU</p><p className="font-mono text-[9px] uppercase tracking-[.16em] text-slate-400">Emergency Response Platform</p></div>}<button aria-label="Close mobile navigation" onClick={() => setMobileOpen(false)} className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-white/10 lg:hidden"><X size={17} /></button></div>
      <div className="flex-1 overflow-y-auto px-3 py-5 scrollbar-thin">{navGroups.map((group) => <div key={group.label} className="mb-6">{!collapsed && <p className="mb-2 px-3 font-mono text-[9px] font-medium uppercase tracking-[.16em] text-slate-500">{group.label}</p>}<div className="space-y-1">{group.items.map(({ href, label, icon: NavIcon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, '-')}`} className={cn('group flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors', location === href ? 'bg-[#f3c44e] text-[#172634]' : 'text-slate-400 hover:bg-white/[.07] hover:text-white', collapsed && 'justify-center px-2')} title={collapsed ? label : undefined}><NavIcon size={17} strokeWidth={location === href ? 2.5 : 1.8} /><span className={cn(collapsed && 'hidden')}>{label}</span>{label === 'Live Incidents' && !collapsed && <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 font-mono text-[9px] text-white">{incidents.filter((item) => !['Resolved', 'Cancelled'].includes(item.status)).length}</span>}</Link>)}</div></div>)}</div>
      {!collapsed && <div className="mx-3 mb-4 rounded-lg border border-[#385063] bg-[#1d3141] p-3"><div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse-dot rounded-full bg-emerald-400" /><span className="text-[11px] font-bold text-slate-200">All systems operational</span></div><p className="mt-2 font-mono text-[9px] text-slate-500">Last sync · 19:36:04 IST</p></div>}
      <div className="border-t border-[#2d4050] p-3"><button aria-label="Toggle sidebar" data-testid="button-collapse-sidebar" onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-white/[.07] hover:text-white">{collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse menu</span></>}</button></div>
    </aside>
    <main className="flex min-w-0 flex-1 flex-col"><header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-7"><div className="flex min-w-0 items-center gap-3"><button aria-label="Open navigation" data-testid="button-open-mobile-nav" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button><div className="min-w-0"><h1 data-testid="text-page-title" className="truncate text-lg font-extrabold tracking-tight text-slate-800">{meta.title}</h1><p data-testid="text-page-description" className="hidden truncate text-xs text-slate-500 sm:block">{meta.description}</p></div></div>
      <div className="flex items-center gap-1.5 sm:gap-3"><div className={cn('relative hidden items-center rounded-lg border border-slate-200 bg-slate-50 sm:flex', searchOpen ? 'w-72' : 'w-9')}><button aria-label="Toggle search" data-testid="button-toggle-search" onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearch(''); }} className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-500 hover:text-cyan-700"><Search size={16} /></button>{searchOpen && <><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search incidents, vehicles, drivers…" data-testid="input-global-search" className="w-full bg-transparent pr-3 text-xs outline-none placeholder:text-slate-400" />{search && <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">{results.length ? results.map((result) => <button key={`${result.kind}-${result.id}`} data-testid={`search-result-${result.id}`} onClick={() => navigate(result.href)} className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"><span className="mt-0.5 rounded bg-cyan-50 px-1.5 py-1 font-mono text-[9px] font-bold text-cyan-700">{result.kind}</span><span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-700">{result.label}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{result.detail}</span></span></button>) : <p className="p-4 text-xs text-slate-500">No records found.</p>}</div>}</>}</div>
      <div className="relative"><button data-testid="button-location-selector" onClick={() => setLocationOpen(!locationOpen)} className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 md:flex"><MapPin size={14} className="text-cyan-700" />{selectedLocation}<ChevronDown size={13} /></button>{locationOpen && <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">{['Jaipur Control Center', 'Delhi Control Center', 'Mumbai Control Center', 'Bengaluru Control Center'].map((name) => <button key={name} onClick={() => { setSelectedLocation(name); setLocationOpen(false); pushToast(`Viewing ${name}`, 'info'); }} className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs hover:bg-slate-50', selectedLocation === name ? 'font-bold text-cyan-700' : 'text-slate-600')}>{name}{selectedLocation === name && <Check size={14} />}</button>)}</div>}</div>
      <div className="relative"><button aria-label="Notifications" data-testid="button-notifications" onClick={() => setNotificationOpen(!notificationOpen)} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Bell size={18} />{unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-white bg-red-500" />}</button>{notificationOpen && <div className="absolute right-0 top-11 z-50 w-[min(340px,calc(100vw-32px))] rounded-xl border border-slate-200 bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="text-sm font-extrabold">Notification Center</p><p className="text-[10px] text-slate-500">{unread} unread updates</p></div><button data-testid="button-mark-notifications-read" onClick={markAllRead} className="text-[10px] font-bold text-cyan-700">Mark all as read</button></div>{notifications.map((item) => <button key={item.id} data-testid={`button-notification-${item.id}`} onClick={() => { setReadNotifications((current) => [...new Set([...current, item.id])]); pushToast('Notification opened', 'info'); }} className="flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"><span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', item.tone === 'critical' ? 'bg-red-500' : item.tone === 'warning' ? 'bg-orange-500' : item.tone === 'good' ? 'bg-emerald-500' : 'bg-cyan-500')} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 text-xs font-bold"><span className="truncate">{item.title}</span>{!readNotifications.includes(item.id) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600" />}</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{item.description}</span><span className="mt-1 block font-mono text-[9px] text-slate-400">{item.time}</span></span></button>)}</div>}</div>
      <div className="relative"><button data-testid="button-profile-menu" onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d9e9eb] text-xs font-extrabold text-cyan-800">CA</span><span className="hidden text-left lg:block"><span className="block text-xs font-bold">Control Center Admin</span><span className="block font-mono text-[9px] text-slate-500">Administrator</span></span><ChevronDown size={13} className="hidden text-slate-400 lg:block" /></button>{profileOpen && <div className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"><button onClick={() => pushToast('Admin profile opened locally', 'info')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold hover:bg-slate-50"><UserRound size={14} />Profile</button><button onClick={() => navigate('/settings')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold hover:bg-slate-50"><Settings size={14} />Settings</button><button data-testid="button-sign-out" onClick={() => { setProfileOpen(false); onLogout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold hover:bg-slate-50"><Shield size={14} />Sign out</button></div>}</div></div></header><div className="flex-1 px-4 py-5 md:px-7 md:py-7">{children}</div>{toasts.length > 0 && <div className="fixed bottom-5 right-5 z-[60] flex w-[min(340px,calc(100vw-40px))] flex-col gap-2">{toasts.map((toast) => <div key={toast.id} data-testid={`toast-${toast.id}`} className="animate-rise-in flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 shadow-xl"><span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', toast.tone === 'warning' ? 'bg-amber-100 text-amber-700' : toast.tone === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-cyan-100 text-cyan-700')}>{toast.tone === 'warning' ? <Zap size={13} /> : <Check size={13} />}</span>{toast.message}</div>)}</div>}</main>
  </div>;
}

function CancellationBanner({ incident, onCancel }: { incident: Incident; onCancel: () => void }) {
  const remainingMs = cancelDeadlineMs(incident.cancelDeadline);
  const now = useNow(remainingMs !== null);
  const secondsLeft = remainingMs !== null ? Math.max(1, Math.ceil(remainingMs / 1000)) : 0;
  if (remainingMs === null) return null;
  const pct = Math.max(0, Math.min(100, ((new Date(incident.cancelDeadline!).getTime() - now) / 30_000) * 100));
  return <div data-testid="banner-cancel-window" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><Timer size={17} /></span>
        <div>
          <p className="text-xs font-extrabold text-amber-900">False-alarm cancellation window</p>
          <p className="mt-0.5 text-[11px] text-amber-800/80">Crash response can still be cancelled as a false alarm.</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span data-testid="text-cancel-countdown" className="font-mono text-xl font-extrabold tabular-nums text-amber-900">{secondsLeft}s</span>
        <button data-testid="button-cancel-false-alarm" onClick={onCancel} className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700">Cancel as false alarm</button>
      </div>
    </div>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-200"><div className="h-full rounded-full bg-amber-500 transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} /></div>
  </div>;
}

function IncidentDetail({ incident: snapshot, onClose, pushToast }: { incident: Incident; onClose: () => void; pushToast: AppProps['pushToast'] }) {
  const { incidents, setIncidents, setDrivers } = useAppStore();
  // Render from the live store record so store updates (cancel, expiry, status
  // changes) are reflected immediately — the prop is only the selection snapshot.
  const incident = incidents.find((item) => item.id === snapshot.id) ?? snapshot;
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  const cancelFalseAlarm = () => {
    setStatus('Cancelled');
    setIncidents((current) => current.map((item) => item.id === incident.id ? { ...item, status: 'Cancelled', cancelDeadline: undefined, cancelledAsFalseAlarm: true, summary: 'Cancelled as a false alarm inside the 30-second window. Dispatch workflow stopped.', updatedAt: new Date().toTimeString().slice(0, 5) } : item));
    // Best-effort sync to the api-server (when deployed); silently skipped offline.
    if (incident.rakshaIncidentId) {
      fetch(`/api/vehicle/incidents/${incident.rakshaIncidentId}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'false-alarm-30s-window' }) }).catch(() => {});
    }
    pushToast(`${incident.code} cancelled as false alarm — dispatch stopped`, 'success');
  };
  const riskFactors = incident.riskFactors ?? ['Sudden deceleration', 'No driver response'];
  const timeline = incident.timeline ?? [{ title: 'Incident detected', time: incident.detectionTime ?? incident.reportedAt, detail: 'Local incident signal received' }, { title: 'Control center review', time: incident.updatedAt, detail: 'Operator review in progress' }];
  const updateStatus = (nextStatus: IncidentStatus, message: string, tone: Toast['tone'] = 'success') => {
    setStatus(nextStatus);
    setIncidents((current) => current.map((item) => item.id === incident.id ? { ...item, status: nextStatus, updatedAt: '19:40' } : item));
    if (nextStatus === 'Monitoring' && incident.driver) setDrivers((current) => current.map((driver) => driver.name === incident.driver ? { ...driver, safetyStatus: 'SAFE' } : driver));
    pushToast(message, tone);
  };
  return <div className="fixed inset-0 z-50 flex justify-end"><button data-testid="button-close-incident-overlay" aria-label="Close incident detail overlay" onClick={onClose} className="absolute inset-0 bg-slate-950/30" /><aside data-testid={`drawer-incident-${incident.id}`} className="animate-rise-in relative h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-medium tracking-[.12em] text-cyan-700">{incident.code}</p><h2 className="mt-1 text-lg font-extrabold tracking-tight">{incident.type}</h2><p className="mt-1 text-xs text-slate-500">{incident.location}</p></div><button aria-label="Close incident detail" data-testid="button-close-incident-detail" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button></div>    <div className="mt-4 flex flex-wrap gap-2"><StatusBadge label={incident.severity} /><StatusBadge label={status} />{incident.cancelledAsFalseAlarm && <StatusBadge label="False alarm" tone="low" />}</div>
    {incident.cancelDeadline && status !== 'Cancelled' && <div className="mt-4"><CancellationBanner incident={incident} onCancel={cancelFalseAlarm} /></div>}
    <div className="mt-5 grid gap-3 border-y border-slate-100 py-4 sm:grid-cols-2">{[['Location', incident.location], ['Latitude', incident.latitude ?? '26.9124'], ['Longitude', incident.longitude ?? '75.7873'], ['Detected', `${incident.detectionTime ?? incident.reportedAt} IST`], ['Detection source', incident.caller], ['Vehicle', incident.vehicle ?? incident.assignments[0] ?? 'Not assigned'], ['Vehicle type', 'SUV'], ['Driver', incident.driver ?? 'Response lead pending'], ['Assigned team', incident.assignedTeam ?? 'Unassigned'], ['Nearest ambulance', incident.nearestAmbulance ?? 'AMB-108'], ['Nearest hospital', incident.nearestHospital ?? 'City Emergency Hospital'], ['Risk score', `${incident.riskScore ?? 52}/100`]].map(([label, value]) => <div key={label}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={cn('mt-1 text-xs font-bold', label === 'Risk score' && Number(String(value).split('/')[0]) >= 80 ? 'text-red-600' : label === 'Vehicle' ? 'font-mono text-cyan-700' : 'text-slate-700')}>{value}</p></div>)}</div>
    {(incident.latitude && incident.longitude) && <div className="mt-3"><a href={`https://www.openstreetmap.org/?mlat=${incident.latitude}&mlon=${incident.longitude}#map=16/${incident.latitude}/${incident.longitude}`} target="_blank" rel="noreferrer" data-testid="link-incident-map" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-slate-100"><Navigation size={14} />Open crash location on map — {incident.latitude}, {incident.longitude}</a></div>}
    {incident.owner && <div className="mt-5 rounded-xl border border-red-100 bg-red-50/40 p-4">
      <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-red-700"><Contact size={13} />Registered owner · medical profile</p><span className="rounded-full bg-white px-2 py-1 font-mono text-[9px] font-bold text-slate-500">SHARED AT SCENE</span></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">{([['Blood group', incident.owner.bloodGroup, Droplet], ['Gender', incident.owner.gender, UserRound], ['Age', `${incident.owner.age} yrs`, UserRound]] as const).map(([label, value, IconComponent]) => <div key={label} className="rounded-lg bg-white p-2.5"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400"><IconComponent size={11} />{label}</p><p className="mt-1 text-xs font-extrabold text-slate-800">{value}</p></div>)}</div>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-lg bg-white p-2.5"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400"><Stethoscope size={11} />Known diseases</p><p className="mt-1 text-xs font-bold text-slate-700">{incident.owner.disease || 'None declared'}</p></div>
        <div className="rounded-lg bg-white p-2.5"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400"><Pill size={11} />Medication</p><p className="mt-1 text-xs font-bold text-slate-700">{incident.owner.medication || 'None declared'}</p></div>
        <div className="rounded-lg bg-white p-2.5 sm:col-span-2"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400"><MapPin size={11} />Address</p><p className="mt-1 text-xs font-bold text-slate-700">{incident.owner.address}</p></div>
      </div>
      <div className="mt-2.5 space-y-2">{incident.owner.emergencyContacts.map((contact) => <div key={contact.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2.5"><div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Emergency contact{contact.isPrimary ? ' · PRIMARY' : ''}</p><p className="mt-1 text-xs font-bold text-slate-700">{contact.name} <span className="font-normal text-slate-500">({contact.relation})</span></p></div><a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-[10px] font-bold text-[#06121c]"><Phone size={12} />{contact.phone}</a></div>)}</div>
    </div>}
    {incident.contactNotifications && incident.contactNotifications.length > 0 && <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Emergency contacts notified</p>
      <div className="mt-2.5 space-y-2">{incident.contactNotifications.map((entry, index) => <div key={`${entry.phone}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700">{entry.contactName}</p><p className="font-mono text-[10px] text-slate-500">{entry.phone}</p></div><div className="flex items-center gap-2"><StatusBadge label={entry.status === 'simulated' ? 'Simulated' : entry.status === 'sent' ? 'Sent' : entry.status === 'failed' ? 'Failed' : 'Queued'} tone={entry.status === 'sent' ? 'good' : entry.status === 'failed' ? 'critical' : 'monitoring'} /><span className="font-mono text-[9px] text-slate-400">{entry.at}</span></div></div>)}</div>
    </div>}
    <div className="mt-5 rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Situation note</p><p className={cn('mt-1 text-xs leading-5 text-slate-600', !expanded && 'line-clamp-2')}>{incident.summary}</p><button data-testid="button-toggle-incident-summary" onClick={() => setExpanded(!expanded)} className="mt-2 text-[10px] font-bold text-cyan-700">{expanded ? 'Show less' : 'Read full note'}</button></div>
    <div className="mt-5"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Risk factors</p><div className="space-y-2">{riskFactors.map((factor) => <div key={factor} className="flex items-center gap-2 text-xs text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" />{factor}</div>)}</div></div>
    <div className="mt-5"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Incident timeline</p><div className="space-y-3">{timeline.map((event, index) => <div key={`${event.title}-${index}`} className="flex gap-3"><span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', index === timeline.length - 1 ? 'bg-cyan-600' : 'bg-slate-300')} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-slate-700">{event.title}</p><span className="font-mono text-[9px] text-slate-400">{event.time}</span></div><p className="mt-0.5 text-[10px] text-slate-500">{event.detail}</p></div></div>)}</div></div>
    <div className="mt-6 grid grid-cols-2 gap-2 border-t border-slate-100 pt-5"><button data-testid="button-incident-assign-responder" onClick={() => updateStatus('Responding', `${incident.code}: responder assigned locally`)} className="rounded-lg bg-cyan-600 px-3 py-2.5 text-xs font-bold text-[#06121c] hover:bg-cyan-500">Assign Responder</button><button data-testid="button-incident-mark-driver-safe" onClick={() => updateStatus('Monitoring', `${incident.code}: driver marked safe locally`)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Mark Driver Safe</button><button data-testid="button-incident-escalate" onClick={() => updateStatus('Escalated', `${incident.code}: escalation recorded locally`, 'warning')} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs font-bold text-orange-700 hover:bg-orange-100">Escalate</button><button data-testid="button-incident-resolve" onClick={() => updateStatus('Resolved', `${incident.code}: incident resolved locally`)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Resolve Incident</button></div>
  </aside></div>;
}

function MapPreview({ pushToast }: AppProps) {
  const [selectedMarker, setSelectedMarker] = useState<{ label: string; detail: string; tone: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [mapQuery, setMapQuery] = useState('');
  const markers = [{ left: '20%', top: '25%', label: 'INC-2041', detail: 'Critical incident · NH-44', tone: 'bg-red-500' }, { left: '61%', top: '20%', label: 'AMB-108', detail: 'Ambulance en route', tone: 'bg-cyan-600' }, { left: '44%', top: '58%', label: 'HSP-01', detail: 'City Emergency Hospital · receiving', tone: 'bg-emerald-500' }, { left: '74%', top: '66%', label: 'PS-04', detail: 'Sector 18 Police Station · available', tone: 'bg-violet-500' }, { left: '31%', top: '72%', label: 'INC-2047', detail: 'Structural hazard · Old market', tone: 'bg-amber-500' }];
  const mapAction = (message: string) => pushToast(message, 'info');
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(22,38,58,.03)]"><div className="mb-4 flex items-end justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-cyan-700">Live map</p><h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-800">Response coverage</h2></div><div className="flex gap-1"><button title="Zoom in" onClick={() => setZoom((value) => Math.min(1.35, value + .1))} className="rounded border border-slate-200 px-2 py-1 text-sm font-bold">+</button><button title="Zoom out" onClick={() => setZoom((value) => Math.max(.8, value - .1))} className="rounded border border-slate-200 px-2 py-1 text-sm font-bold">−</button><button title="Current location" onClick={() => { setZoom(1); mapAction('Map centered on Jaipur Control Center'); }} className="rounded border border-slate-200 p-1.5 text-slate-600"><MapPin size={14} /></button><button title="Fit all markers" onClick={() => { setZoom(.9); mapAction('All response markers fitted'); }} className="rounded border border-slate-200 p-1.5 text-slate-600"><Gauge size={14} /></button></div></div><div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={13} className="text-slate-400" /><input value={mapQuery} onChange={(event) => setMapQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && mapAction(mapQuery ? `Location search: ${mapQuery}` : 'Enter a location to search')} placeholder="Search location" className="w-full bg-transparent py-2 text-xs outline-none" /></div><div data-testid="map-preview" className="relative h-[316px] overflow-hidden rounded-lg border border-slate-200 bg-[#e7eef0]"><div className="absolute inset-0 origin-center transition-transform duration-200" style={{ transform: `scale(${zoom})`, backgroundImage: 'linear-gradient(#b5c9ce 1px, transparent 1px), linear-gradient(90deg, #b5c9ce 1px, transparent 1px)', backgroundSize: '32px 32px' }} /><div className="absolute left-[12%] top-[-10%] h-[130%] w-10 rotate-[28deg] bg-white/70 shadow-sm" /><div className="absolute left-[48%] top-[-5%] h-[120%] w-7 -rotate-[16deg] bg-white/60" /><div className="absolute left-[-5%] top-[45%] h-7 w-[120%] rotate-[12deg] bg-white/70" />{markers.map((marker) => <button key={marker.label} data-testid={`button-map-marker-${marker.label}`} onClick={() => setSelectedMarker(marker)} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: marker.left, top: marker.top }}><span className={cn('block h-4 w-4 rounded-full border-[3px] border-white shadow-md transition-transform hover:scale-125', marker.tone)} /><span className="absolute left-3 top-[-4px] whitespace-nowrap rounded bg-white/95 px-1.5 py-0.5 font-mono text-[8px] font-medium text-slate-600 shadow-sm">{marker.label}</span></button>)}{selectedMarker && <div data-testid="map-marker-popover" className="absolute bottom-3 left-3 right-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-bold text-cyan-700">{selectedMarker.label}</p><p className="mt-1 text-xs font-bold text-slate-700">{selectedMarker.detail}</p></div><button aria-label="Close marker details" onClick={() => setSelectedMarker(null)} className="text-slate-400"><X size={14} /></button></div></div>}</div><div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" />Critical incidents</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-cyan-600" />Vehicles / ambulances</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Hospitals</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet-500" />Police stations</span></div></section>;
}

/** Crash-lab bench: dashboard statistics derived from stored simulation records — never hard-coded. */
function SimulationBench() {
  const { stats, records } = useSimulationStore();
  const [, setLocation] = useLocation();
  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <SectionHeading eyebrow="Crash lab" title="Crash simulation bench" action="Open simulator" onAction={() => setLocation('/simulator')} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total Simulations" value={String(stats.totalSimulations)} detail="Stored simulation runs" icon={FlaskConical} accent="blue" />
      <MetricCard label="Critical Events" value={String(stats.criticalEvents)} detail="CRITICAL severity classifications" icon={Zap} accent="red" />
      <MetricCard label="Average Est. Impact Force" value={`${stats.averageImpactForceKN.toFixed(1)} kN`} detail={`Peak ${stats.maxImpactForceKN.toFixed(1)} kN`} icon={Activity} accent="teal" />
      <MetricCard label="Average ΔV" value={`${stats.averageDeltaVKmh.toFixed(1)} km/h`} detail={`Avg deceleration ${stats.averageDecelerationMps2.toFixed(1)} m/s²`} icon={Gauge} accent="amber" />
    </div>
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left">
        <thead className="border-b border-slate-100 bg-slate-50/70"><tr>{['Event ID', 'Date', 'Vehicle Mass', 'Initial Speed', 'Impact Speed', 'ΔV', 'Deceleration', 'Est. Force', 'Severity', 'Impact Type'].map((heading) => <th key={heading} className="px-4 py-3 font-mono text-[9px] font-medium uppercase tracking-[.12em] text-slate-400">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {records.slice(0, 5).map((record) => <tr key={record.id} data-testid={`row-sim-${record.id}`} onClick={() => setLocation(`/reports/${encodeURIComponent(record.id)}`)} className="cursor-pointer transition-colors hover:bg-cyan-50/40">
            <td className="px-4 py-3 font-mono text-[10px] font-medium text-cyan-700">{record.id}</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{record.recordedAt}</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{record.input.vehicleMassKg} kg</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{record.input.initialSpeedKmh} km/h</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{record.input.impactSpeedKmh} km/h</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{record.physics.deltaVKmh.toFixed(1)} km/h</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{record.physics.decelerationMps2.toFixed(1)} m/s²</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{record.physics.estimatedForceKN.toFixed(1)} kN</td>
            <td className="px-4 py-3"><StatusBadge label={record.severity.level} tone={record.severity.level === 'CRITICAL' ? 'critical' : record.severity.level === 'HIGH' ? 'high' : record.severity.level === 'MODERATE' ? 'moderate' : 'low'} /></td>
            <td className="px-4 py-3 text-xs text-slate-600">{record.input.impactType}</td>
          </tr>)}
        </tbody>
      </table></div>
      {records.length === 0 && <div className="p-4"><EmptyState title="No simulations yet" detail="Run the Crash Simulator to create simulation records — this table and the statistics above fill from stored runs." icon={FlaskConical} /></div>}
    </div>
    <p className="mt-3 text-[10px] leading-4 text-slate-400">Simulation only — results are based on a simplified physics model and are not a certified crash reconstruction or automotive safety assessment.</p>
  </section>;
}

function Overview({ pushToast }: AppProps) {
  const { incidents, vehicles } = useAppStore();
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<Incident | null>(null);
  const [lastUpdated, setLastUpdated] = useState('Just now');
  const active = incidents.filter((item) => !['Resolved', 'Cancelled'].includes(item.status));
  const critical = active.filter((item) => item.severity === 'Critical');
  return <div className="mx-auto max-w-[1500px] space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-cyan-700">Operations overview</p><h2 className="mt-1 text-base font-extrabold text-slate-800">Live control-center picture</h2><p className="mt-1 text-xs text-slate-500">Real-time emergency response and road safety operations.</p></div><div className="flex items-center gap-3"><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-400">Last updated</p><p data-testid="text-overview-last-updated" className="mt-0.5 font-mono text-xs font-medium text-slate-700">{lastUpdated}</p></div><button data-testid="button-refresh-overview" onClick={() => { setLastUpdated(`${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST`); pushToast('Overview mock data refreshed', 'success'); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><RefreshCw size={14} />Refresh</button></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Active Incidents" value={active.length.toString().padStart(2, '0')} detail="+2 today" icon={Siren} accent="red" trend="up" spark={kpiSpark(incidents, 'incidents')} /><MetricCard label="Critical Incidents" value={critical.length.toString().padStart(2, '0')} detail="Requires immediate response" icon={Zap} accent="red" trend="down" spark={kpiSpark(incidents, 'response')} /><MetricCard label="Vehicles Online" value="124" detail="97% connected" icon={CarFront} accent="blue" trend="up" spark={kpiSpark(incidents, 'fleet')} /><MetricCard label="Response Teams" value="18" detail="15 available" icon={Users} accent="teal" trend="up" spark={kpiSpark(incidents, 'teams')} /><MetricCard label="Average Response Time" value="08:42" detail="-12% this week" icon={Clock3} accent="amber" trend="up" spark={kpiSpark(incidents, 'response')} /></div>
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <Panel testId="panel-overview-load" eyebrow="Live signal · rolling 24 h" title="Incident load & network risk index">
        <AreaChart height={210} labels={Array.from({ length: 12 }, (_, index) => `${String((new Date().getHours() - 23 + index * 2 + 24) % 24).padStart(2, '0')}h`)} series={[{ label: 'Incidents detected', values: incidentLoadByRecency(incidents, 24, 12), color: '#ff5c5c' }, { label: 'Network risk index', values: riskIndexSeries(incidents), color: '#f08a3e', area: false, dashed: true }]} />
      </Panel>
      <Panel testId="panel-overview-severity" eyebrow="Distribution · live + archived" title="Severity mix">
        <Donut items={severityMix(incidents, historySeed)} centerLabel={String(severityMix(incidents, historySeed).reduce((sum, item) => sum + item.value, 0))} centerSub="incidents on record" />
      </Panel>
    </div>
    <div className="grid gap-5 xl:grid-cols-3">
      <Panel testId="panel-overview-response" eyebrow="Performance · history-derived" title="Response time trend (min)">
        <AreaChart height={170} labels={weeklyResponseMinutes(historySeed).map((_, index) => `W${index + 1}`)} series={[{ label: 'Avg response', values: weeklyResponseMinutes(historySeed), color: '#ffc657' }]} />
      </Panel>
      <Panel testId="panel-overview-zones" eyebrow="Geography · open incidents" title="Load by zone">
        <RankedBars items={zoneLoad(incidents)} valueSuffix=" open" />
      </Panel>
      <Panel testId="panel-overview-outcomes" eyebrow="Outcome of the 30-s window" title="Cancellation outcomes">
        <div className="grid grid-cols-2 gap-2">
          <GaugeRing value={(() => { const online = vehicles.filter((item) => item.status === 'ONLINE').length; return Math.round((online / Math.max(1, vehicles.length)) * 100); })()} label={`${vehicles.filter((item) => item.status === 'ONLINE').length}/${vehicles.length}`} color="#f08a3e" sub="fleet online" />
          <GaugeRing value={Math.round((seedResponseTeams.filter((team) => team.status === 'AVAILABLE').length / Math.max(1, seedResponseTeams.length)) * 100)} label={`${seedResponseTeams.filter((team) => team.status === 'AVAILABLE').length}/${seedResponseTeams.length}`} color="#4ade80" sub="teams ready" />
        </div>
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {([['Escalated — no driver response', incidents.filter((item) => item.status === 'Escalated').length, '#ff5c5c'], ['Cancelled as false alarm', incidents.filter((item) => item.cancelledAsFalseAlarm).length, '#4ade80'], ['Awaiting driver verification', incidents.filter((item) => item.status === 'Verification').length, '#ffc657']] as const).map(([label, value, color]) => (
            <div key={label} className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-2 font-semibold text-slate-600"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span><span className="font-mono font-bold text-slate-700">{value}</span></div>
          ))}
        </div>
      </Panel>
    </div>
    <section><SectionHeading eyebrow="Live operations" title="Active incident queue" action="View all incidents" onAction={() => setLocation('/incidents')} /><div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(22,38,58,.03)]"><div className="overflow-x-auto"><table className="w-full min-w-[930px] text-left"><thead className="border-b border-slate-100 bg-slate-50/70"><tr>{['Incident ID', 'Location', 'Type', 'Severity', 'Detected', 'Status', 'Assigned Team', 'Action'].map((heading) => <th key={heading} className="px-4 py-3 font-mono text-[9px] font-medium uppercase tracking-[.12em] text-slate-400">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{incidents.map((incident) => <tr key={incident.id} data-testid={`row-overview-incident-${incident.id}`} onClick={() => setSelected(incident)} className="cursor-pointer transition-colors hover:bg-cyan-50/40"><td className="px-4 py-3 font-mono text-[10px] font-medium text-cyan-700">{incident.code}</td><td className="max-w-[170px] truncate px-4 py-3 text-xs font-semibold text-slate-700">{incident.location}</td><td className="px-4 py-3 text-xs text-slate-600">{incident.type}</td><td className="px-4 py-3"><StatusBadge label={incident.severity} /></td><td className="px-4 py-3 font-mono text-[10px] text-slate-500">{incident.reportedAt}</td><td className="px-4 py-3"><StatusBadge label={incident.status} /></td><td className="px-4 py-3 text-xs font-semibold text-slate-600">{incident.assignedTeam ?? (incident.assignments.length ? incident.assignments.join(', ') : 'Unassigned')}</td><td className="px-4 py-3"><button aria-label={`Open ${incident.code}`} onClick={(event) => { event.stopPropagation(); setSelected(incident); }} className="rounded-md p-1.5 text-cyan-700 hover:bg-cyan-50"><ChevronRight size={15} /></button></td></tr>)}</tbody></table></div></div><MapPreview pushToast={pushToast} /></div></section>
    <SimulationBench /><div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><ResponseStatus /><ActivityTimeline setLocation={setLocation} /></div><section className="rounded-xl border border-slate-200 bg-white p-5"><SectionHeading eyebrow="Command shortcuts" title="Quick actions" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><button onClick={() => setLocation('/demo')} className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/60 p-3 text-left text-xs font-bold text-red-800 hover:bg-red-50"><Siren size={16} />Simulate crash</button><button onClick={() => setLocation('/incidents')} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"><Radio size={16} className="text-cyan-700" />View incidents</button><button onClick={() => setLocation('/vehicles')} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"><CarFront size={16} className="text-cyan-700" />View vehicles</button><button onClick={() => setLocation('/emergency-services')} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"><HospitalIcon size={16} className="text-cyan-700" />Emergency services</button><button onClick={() => setLocation('/demo')} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"><Play size={16} className="text-cyan-700" />Demo simulator</button></div></section>{selected && <IncidentDetail incident={selected} onClose={() => setSelected(null)} pushToast={pushToast} />}</div>;
}

function ResponseStatus() {
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><SectionHeading eyebrow="Resource status" title="Emergency response status" /><div className="grid gap-3 sm:grid-cols-2">{[['Police', 'Available', Shield], ['Ambulances', '12 available', AmbulanceIcon], ['Hospitals', '8 ready', HospitalIcon], ['Response teams', '15 available', Users]].map(([label, value, IconComponent]) => <div key={String(label)} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-3"><div className="flex items-center gap-3"><IconComponent size={17} className="text-cyan-700" /><span className="text-xs font-bold">{String(label)}</span></div>{String(value) === 'Available' ? <StatusBadge label="Available" /> : <span className="font-mono text-xs font-medium text-slate-600">{String(value)}</span>}</div>)}</div></section>;
}

function ActivityTimeline({ setLocation }: { setLocation: (path: string) => void }) {
  const events = [{ icon: Siren, text: 'Critical crash detected', time: '2 min ago', tone: 'critical' }, { icon: UserRound, text: 'Driver verification timeout', time: '4 min ago', tone: 'high' }, { icon: AmbulanceIcon, text: 'Ambulance assigned', time: '6 min ago', tone: 'info' }, { icon: Shield, text: 'Police notified', time: '9 min ago', tone: 'info' }, { icon: CheckCircle2, text: 'Incident resolved', time: '12 min ago', tone: 'good' }];
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><SectionHeading eyebrow="Recent activity" title="Operations timeline" action="View incident history" onAction={() => setLocation('/history')} /><div className="space-y-4">{events.map((event) => { const EventIcon = event.icon; return <div key={event.text} className="flex items-center gap-3"><span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', event.tone === 'critical' ? 'bg-red-50 text-red-600' : event.tone === 'high' ? 'bg-orange-50 text-orange-600' : event.tone === 'good' ? 'bg-emerald-50 text-emerald-600' : 'bg-cyan-50 text-cyan-700')}><EventIcon size={14} /></span><p className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">{event.text}</p><span className="shrink-0 font-mono text-[9px] text-slate-400">{event.time}</span></div>; })}</div></section>;
}

function IncidentsPage({ pushToast }: AppProps) {
  const { incidents } = useAppStore();
  const [selected, setSelected] = useState<Incident | null>(null);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const filtered = incidents.filter((incident) => (filter === 'All' || incident.status === filter || incident.severity === filter) && `${incident.code} ${incident.type} ${incident.location} ${incident.assignedTeam ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="mx-auto max-w-[1500px] space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[.12em] text-red-700"><span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-red-500" />{incidents.filter((item) => !['Resolved', 'Cancelled'].includes(item.status)).length} open incidents</span></div><div className="flex gap-2"><button data-testid="button-toggle-incident-filters" onClick={() => setShowFilters(!showFilters)} className={cn('inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold', showFilters ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600')}><Filter size={14} />Filters</button><button onClick={() => pushToast('Local incident intake opened', 'info')} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-[#06121c]"><Siren size={14} />Log incident</button></div></div>{showFilters && <div className="animate-rise-in flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3"><span className="mr-1 text-[10px] font-bold uppercase tracking-[.1em] text-slate-400">Show</span>{['All', 'Critical', 'High', 'Medium', 'Low', 'Responding', 'Verification', 'Monitoring', 'Resolved'].map((item) => <button key={item} onClick={() => setFilter(item)} className={cn('rounded-full border px-3 py-1.5 text-[10px] font-bold', filter === item ? 'border-cyan-600 bg-cyan-600 text-[#06121c]' : 'border-slate-200 text-slate-600 hover:border-cyan-300')}>{item}</button>)}<div className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 px-2.5"><Search size={13} className="text-slate-400" /><input data-testid="input-incident-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search incidents" className="w-40 bg-transparent py-1.5 text-xs outline-none" /></div></div>}<div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="border-b border-slate-100 bg-slate-50/70"><tr>{['Incident', 'Severity', 'Location', 'Status', 'Units', 'Detected', 'Assigned team', ''].map((heading) => <th key={heading} className="px-4 py-3 font-mono text-[9px] font-medium uppercase tracking-[.12em] text-slate-400">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((incident) => <tr key={incident.id} data-testid={`row-incident-${incident.id}`} onClick={() => setSelected(incident)} className={cn('cursor-pointer transition-colors hover:bg-cyan-50/40', selected?.id === incident.id && 'bg-cyan-50/70')}><td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className={cn('h-2 w-2 rounded-full', incident.severity === 'Critical' ? 'bg-red-500' : incident.severity === 'High' ? 'bg-orange-500' : 'bg-amber-500')} /><div><p className="font-mono text-[10px] font-medium text-cyan-700">{incident.code}</p><p className="mt-0.5 text-xs font-bold text-slate-700">{incident.type}</p></div></div></td><td className="px-4 py-3"><StatusBadge label={incident.severity} /></td><td className="px-4 py-3"><p className="max-w-[210px] truncate text-xs font-semibold text-slate-700">{incident.location}</p><p className="mt-0.5 text-[10px] text-slate-400">{incident.zone}</p></td><td className="px-4 py-3"><div className="flex items-center gap-1.5"><StatusBadge label={incident.status} />{incident.cancelDeadline && incident.status !== 'Cancelled' && <span title="False-alarm cancellation window active" className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase text-amber-700">cancellable</span>}{incident.cancelledAsFalseAlarm && <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase text-slate-500">false alarm</span>}</div></td><td className="px-4 py-3 font-mono text-xs text-slate-600">{incident.assignments.length.toString().padStart(2, '0')}</td><td className="px-4 py-3 font-mono text-[10px] text-slate-500">{incident.detectionTime ?? incident.reportedAt}</td><td className="px-4 py-3 text-xs font-semibold text-slate-600">{incident.assignedTeam ?? 'Unassigned'}</td><td className="px-4 py-3"><ChevronRight size={15} className="text-slate-300" /></td></tr>)}</tbody></table></div>{filtered.length === 0 && <div className="p-4"><EmptyState title="No incidents match" detail="Try changing the queue filter or search term." icon={Siren} /></div>}</div>{selected && <IncidentDetail incident={selected} onClose={() => setSelected(null)} pushToast={pushToast} />}</div>;
}

function ResourceTablePage({ kind, pushToast }: { kind: 'vehicles' | 'drivers'; pushToast: AppProps['pushToast'] }) {
  const isVehicles = kind === 'vehicles';
  const { vehicles, setVehicles, drivers } = useAppStore();
  const source = isVehicles ? vehicles : drivers;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const filtered = source.filter((item) => {
    const v = item as Vehicle; const d = item as Driver;
    const searchable = isVehicles ? `${item.id} ${v.registration} ${v.name} ${v.type} ${v.location} ${v.driver}` : `${item.id} ${d.name} ${d.role} ${d.vehicle} ${d.zone} ${d.phone}`;
    return (filter === 'All' || String(item.status) === filter) && searchable.toLowerCase().includes(query.toLowerCase());
  });
  const statuses = ['All', ...Array.from(new Set(source.map((item) => String(item.status))))];
  const removeVehicle = (id: string) => {
    setVehicles((current) => current.filter((item) => item.id !== id));
    setSelected(null);
    pushToast(`${id} removed from the local fleet`, 'success');
  };
  return <div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-slate-500">{isVehicles ? `${vehicles.length} registered vehicles` : `${drivers.length} rostered drivers`} · Local mock data</p></div><div className="flex gap-2"><button onClick={() => pushToast(`${isVehicles ? 'Fleet' : 'Roster'} report prepared locally`, 'success')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Download size={14} />Export report</button>{isVehicles && <button data-testid="button-add-vehicle" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-[#06121c]"><CarFront size={14} />Add Vehicle</button>}</div></div>
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3"><div className="flex min-w-[210px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={14} className="text-slate-400" /><input data-testid={`input-${kind}-search`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isVehicles ? 'Search by vehicle, registration, driver or location' : 'Search by name, phone or assignment'} className="w-full bg-transparent py-2 text-xs outline-none" /></div><div className="flex items-center gap-1 overflow-x-auto">{statuses.map((status) => <button key={status} onClick={() => setFilter(status)} className={cn('whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold', filter === status ? 'bg-cyan-600 text-[#06121c]' : 'text-slate-500 hover:bg-slate-100')}>{status}</button>)}</div></div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead className="border-b border-slate-100 bg-slate-50/70"><tr>{(isVehicles ? ['Vehicle ID', 'Registration', 'Type / model', 'Driver', 'Location', 'Speed', 'Battery', 'Status', 'Last seen', 'Actions'] : ['Driver', 'Phone', 'Vehicle', 'Status', 'Safety status', 'Last active', 'Actions']).map((heading) => <th key={heading} className="px-4 py-3 font-mono text-[9px] font-medium uppercase tracking-[.12em] text-slate-400">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((item) => isVehicles ? <tr key={item.id} data-testid={`row-vehicle-${item.id}`} className="hover:bg-cyan-50/30"><td className="px-4 py-3 font-mono text-xs font-medium text-cyan-700">{item.id}</td><td className="px-4 py-3 font-mono text-[10px] text-slate-600">{(item as Vehicle).registration}</td><td className="px-4 py-3"><p className="text-xs font-bold text-slate-700">{item.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{(item as Vehicle).type} · {(item as Vehicle).model}</p></td><td className="px-4 py-3 text-xs font-semibold text-slate-700">{(item as Vehicle).driver}</td><td className="px-4 py-3 text-xs text-slate-600">{(item as Vehicle).location}</td><td className="px-4 py-3 font-mono text-[10px] text-slate-600">{(item as Vehicle).speed}</td><td className="px-4 py-3 font-mono text-[10px] text-slate-600">{(item as Vehicle).battery}%</td><td className="px-4 py-3"><StatusBadge label={item.status} /></td><td className="px-4 py-3 font-mono text-[10px] text-slate-500">{(item as Vehicle).lastSeen}</td><td className="px-4 py-3"><div className="flex items-center gap-1"><button title="View vehicle" onClick={() => setSelected(item.id)} className="rounded-md p-1.5 text-cyan-700 hover:bg-cyan-50"><ChevronRight size={15} /></button><button title="Edit vehicle" onClick={() => setEditing(item as Vehicle)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><Edit3 size={14} /></button><button title="Delete vehicle" onClick={() => removeVehicle(item.id)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button></div></td></tr> : <tr key={item.id} data-testid={`row-driver-${item.id}`} className="hover:bg-cyan-50/30"><td className="px-4 py-3"><button onClick={() => setSelected(item.id)} className="flex items-center gap-2.5 text-left"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d9e9eb] text-[10px] font-extrabold text-cyan-800">{(item as Driver).initials}</span><span><span className="block text-xs font-bold text-slate-700">{item.name}</span><span className="mt-0.5 block font-mono text-[9px] text-slate-400">{item.id}</span></span></button></td><td className="px-4 py-3 font-mono text-[10px] text-slate-600">{(item as Driver).phone}</td><td className="px-4 py-3 font-mono text-xs text-cyan-700">{(item as Driver).vehicle}</td><td className="px-4 py-3"><StatusBadge label={item.status} /></td><td className="px-4 py-3"><StatusBadge label={(item as Driver).safetyStatus} /></td><td className="px-4 py-3 font-mono text-[10px] text-slate-500">{(item as Driver).lastActive}</td><td className="px-4 py-3"><div className="flex items-center gap-1"><button onClick={() => setSelected(item.id)} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-bold text-cyan-700">View Profile</button><button onClick={() => pushToast(`${item.name} edit form opened locally`, 'info')} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><Edit3 size={14} /></button><button onClick={() => pushToast(`Emergency contact prepared for ${item.name}`, 'info')} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><Phone size={14} /></button></div></td></tr>)}</tbody></table></div>{filtered.length === 0 && <div className="p-4"><EmptyState title={`No ${kind} found`} detail="Try a different search or availability filter." /></div>}</div>
    {selected && <ResourceDrawer kind={kind} id={selected} onClose={() => setSelected(null)} pushToast={pushToast} />}{showAdd && <VehicleModal onClose={() => setShowAdd(false)} onSave={(vehicle) => { setVehicles((current) => [vehicle, ...current]); setShowAdd(false); pushToast(`${vehicle.id} added to the local fleet`, 'success'); }} />}{editing && <VehicleModal vehicle={editing} onClose={() => setEditing(null)} onSave={(vehicle) => { setVehicles((current) => current.map((item) => item.id === vehicle.id ? vehicle : item)); setEditing(null); pushToast(`${vehicle.id} updated locally`, 'success'); }} />}
  </div>;
}

function VehicleModal({ vehicle, onClose, onSave }: { vehicle?: Vehicle; onClose: () => void; onSave: (vehicle: Vehicle) => void }) {
  const [form, setForm] = useState<Vehicle>(vehicle ?? { id: 'VH-011', registration: 'RJ14ZZ0000', name: 'New response unit', type: 'Patrol vehicle', model: 'Mahindra Bolero', driver: 'Unassigned', deviceId: 'DEV-7711', location: 'Jaipur control center', speed: '0 km/h', battery: 100, status: 'ONLINE', lastSeen: 'Just now', readiness: 100, team: 'Unassigned', fuel: 100, lastService: '04 Sep 2026', eta: 'Ready' });
  const update = (key: keyof Vehicle, value: string | number) => setForm((current) => ({ ...current, [key]: value }));
  return <Modal title={vehicle ? 'Edit vehicle' : 'Add vehicle'} onClose={onClose} testId="modal-vehicle"><div className="mt-5 grid gap-4 sm:grid-cols-2">{[['id', 'Vehicle ID'], ['registration', 'Registration Number'], ['type', 'Vehicle Type'], ['model', 'Model'], ['driver', 'Driver'], ['deviceId', 'Device ID']].map(([key, label]) => <label key={key} className="text-xs font-bold text-slate-600">{label}<input value={String(form[key as keyof Vehicle])} onChange={(event) => update(key as keyof Vehicle, event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-cyan-500" /></label>)}<label className="text-xs font-bold text-slate-600">Status<select value={form.status} onChange={(event) => update('status', event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"><option>ONLINE</option><option>OFFLINE</option><option>MAINTENANCE</option></select></label></div><div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600">Cancel</button><button onClick={() => onSave(form)} className="rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-bold text-[#06121c]">Save Vehicle</button></div></Modal>;
}

function ResourceDrawer({ kind, id, onClose, pushToast }: { kind: 'vehicles' | 'drivers'; id: string; onClose: () => void; pushToast: AppProps['pushToast'] }) {
  const { vehicles, drivers } = useAppStore();
  const item = kind === 'vehicles' ? vehicles.find((entry) => entry.id === id) : drivers.find((entry) => entry.id === id);
  if (!item) return null;
  const vehicle = kind === 'vehicles' ? item as Vehicle : undefined;
  const driver = kind === 'drivers' ? item as Driver : undefined;
  return <div className="fixed inset-0 z-50 flex justify-end"><button aria-label="Close resource detail" onClick={onClose} className="absolute inset-0 bg-slate-950/25" /><aside className="animate-rise-in relative h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl"><button onClick={onClose} className="absolute right-5 top-5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button><p className="font-mono text-[10px] uppercase tracking-[.14em] text-cyan-700">{item.id}</p><h2 className="mt-2 text-xl font-extrabold">{item.name}</h2><p className="mt-1 text-xs text-slate-500">{vehicle?.type ?? driver?.role}</p><div className="mt-5"><StatusBadge label={String(item.status)} /></div><div className="mt-7 space-y-4">{(vehicle ? [['Registration', vehicle.registration], ['Model', vehicle.model], ['Current location', vehicle.location], ['Assigned driver', vehicle.driver], ['Device ID', vehicle.deviceId], ['Battery', `${vehicle.battery}%`], ['Last seen', vehicle.lastSeen]] : [['Phone', driver?.phone ?? ''], ['Vehicle', driver?.vehicle ?? ''], ['Safety status', driver?.safetyStatus ?? ''], ['Shift', driver?.shift ?? ''], ['Coverage zone', driver?.zone ?? ''], ['Last active', driver?.lastActive ?? '']]).map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-xs text-slate-500">{label}</span><span className="text-right text-xs font-bold text-slate-700">{value}</span></div>)}</div><div className="mt-8 grid grid-cols-2 gap-2"><button onClick={() => pushToast(vehicle ? 'Vehicle contact card copied locally' : `Emergency contact prepared for ${driver?.name}`, 'success')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2.5 text-xs font-bold text-[#06121c]"><Phone size={14} />{vehicle ? 'Contact' : 'Emergency Contact'}</button><button onClick={() => pushToast(`${item.name} edit form opened locally`, 'info')} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600">Edit</button></div></aside></div>;
}

function ServicesPage({ pushToast }: AppProps) {
  const { ambulances } = useAppStore();
  const [tab, setTab] = useState<'Ambulances' | 'Hospitals' | 'Police stations'>('Ambulances');
  const [selected, setSelected] = useState<Ambulance | Hospital | PoliceStation | null>(null);
  const list = tab === 'Ambulances' ? ambulances : tab === 'Hospitals' ? seedHospitals : seedPoliceStations;
  return <div className="mx-auto max-w-[1500px] space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Connected capacity directory · Last verified 19:36 IST</p><button onClick={() => pushToast('Service directory synced locally', 'success')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"><RefreshCw size={14} />Sync directory</button></div><div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1.5">{(['Ambulances', 'Hospitals', 'Police stations'] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={cn('flex-1 rounded-lg px-3 py-2.5 text-xs font-bold', tab === item ? 'bg-cyan-600 text-[#06121c]' : 'text-slate-500 hover:bg-slate-50')}>{item}<span className="ml-2 font-mono text-[10px] opacity-60">{item === 'Ambulances' ? ambulances.length : item === 'Hospitals' ? seedHospitals.length : seedPoliceStations.length}</span></button>)}</div><section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead className="border-b border-slate-100 bg-slate-50/70"><tr>{(tab === 'Ambulances' ? ['Ambulance ID', 'Location', 'Status', 'ETA', 'Assigned Incident'] : tab === 'Hospitals' ? ['Hospital', 'Location', 'Emergency capacity', 'Distance', 'Status'] : ['Station name', 'Location', 'Contact', 'Distance', 'Status']).map((label) => <th key={label} className="px-4 py-3 font-mono text-[9px] font-medium uppercase tracking-[.12em] text-slate-400">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{list.map((item) => <tr key={item.id} onClick={() => setSelected(item)} className="cursor-pointer hover:bg-cyan-50/30"><td className="px-4 py-4"><p className="text-xs font-bold">{'facility' in item ? `${item.id} · ${item.facility}` : item.name}</p><p className="mt-1 text-[10px] text-cyan-700">{'capability' in item ? item.capability : 'type' in item ? item.type : ''}</p></td><td className="px-4 py-4 text-xs text-slate-600">{'location' in item ? item.location : ''}</td><td className="px-4 py-4">{'assignedIncident' in item ? <StatusBadge label={item.status} /> : 'beds' in item ? <span className="font-mono text-xs text-slate-700">{item.beds}</span> : <span className="text-xs text-slate-600">{item.contact}</span>}</td><td className="px-4 py-4 font-mono text-xs text-slate-600">{'eta' in item ? item.eta : item.distance}</td><td className="px-4 py-4">{'assignedIncident' in item ? <span className="font-mono text-xs text-cyan-700">{item.assignedIncident}</span> : <StatusBadge label={item.status} />}</td></tr>)}</tbody></table></div></section>{selected && <ServiceModal item={selected} onClose={() => setSelected(null)} pushToast={pushToast} />}</div>;
}

function ServiceModal({ item, onClose, pushToast }: { item: Ambulance | Hospital | PoliceStation; onClose: () => void; pushToast: AppProps['pushToast'] }) {
  const title = 'facility' in item ? `${item.id} · ${item.facility}` : item.name;
  const entries = 'facility' in item ? [['Capability', item.capability], ['Location', item.location], ['ETA', item.eta], ['Crew', item.crew], ['Assigned incident', item.assignedIncident]] : 'beds' in item ? [['Location', item.location], ['Type', item.type], ['Emergency capacity', item.beds], ['Distance', item.distance], ['Contact', item.contact]] : [['Location', item.location], ['Type', item.type], ['Unit capacity', item.unit], ['Distance', item.distance], ['Contact', item.contact]];
  return <Modal title={title} onClose={onClose} testId="modal-service"><div className="mt-5"><StatusBadge label={item.status} /><div className="mt-6 space-y-4">{entries.map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-xs text-slate-500">{label}</span><span className="text-right text-xs font-bold text-slate-700">{value}</span></div>)}</div><button onClick={() => pushToast(`${title} contact card opened locally`, 'success')} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2.5 text-xs font-bold text-[#06121c]"><Phone size={14} />Open contact card</button></div></Modal>;
}

function TeamsPage({ pushToast }: AppProps) {
  const [filter, setFilter] = useState('All');
  const statuses = ['All', 'AVAILABLE', 'RESPONDING', 'MONITORING', 'OFF DUTY'];
  const list = seedResponseTeams.filter((team) => filter === 'All' || team.status === filter);
  return <div className="mx-auto max-w-[1500px] space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="font-mono text-xs font-medium text-slate-600">{seedResponseTeams.length} teams registered</span><span className="h-1 w-1 rounded-full bg-slate-300" /><span className="font-mono text-xs text-emerald-600">{seedResponseTeams.filter((team) => team.status === 'AVAILABLE').length} available now</span></div><button onClick={() => pushToast('Broadcast composer opened locally', 'info')} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-[#06121c]"><Send size={14} />Broadcast update</button></div><div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">{statuses.map((status) => <button key={status} onClick={() => setFilter(status)} className={cn('whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold', filter === status ? 'bg-cyan-600 text-[#06121c]' : 'text-slate-500 hover:bg-slate-50')}>{status === 'All' ? status : status.replace('OFF DUTY', 'Off duty').toLowerCase().replace(/^\w/, (char) => char.toUpperCase())}</button>)}</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((team) => <article key={team.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] text-cyan-700">{team.id}</p><h2 className="mt-1 text-sm font-extrabold">{team.name}</h2></div><StatusBadge label={team.status} /></div><p className="mt-4 text-xs font-semibold text-slate-600">{team.members} members · {team.location}</p><div className="mt-4 space-y-3 border-t border-slate-100 pt-4"><div className="flex justify-between text-xs"><span className="text-slate-500">Specialty</span><span className="font-bold">{team.specialty}</span></div><div className="flex justify-between text-xs"><span className="text-slate-500">Team lead</span><span className="font-bold">{team.lead}</span></div><div><div className="mb-1.5 flex justify-between text-[10px]"><span className="text-slate-500">Readiness</span><span className="font-mono">{team.readiness}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={cn('h-full rounded-full', team.readiness > 90 ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${team.readiness}%` }} /></div></div></div><div className="mt-5 grid grid-cols-3 gap-2"><button onClick={() => pushToast(`${team.name} assignment panel opened locally`, 'info')} className="rounded-lg bg-cyan-600 px-2 py-2 text-[10px] font-bold text-[#06121c]">Assign Incident</button><button onClick={() => pushToast(`${team.name} roster opened locally`, 'info')} className="rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-bold text-slate-600">View Team</button><button onClick={() => pushToast(`${team.name} status controls opened locally`, 'info')} className="rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-bold text-slate-600">Change Status</button></div></article>)}</div>{list.length === 0 && <EmptyState title="No teams in this state" detail="Change the availability filter to see other response teams." icon={Users} />}</div>;
}

function HistoryPage({ pushToast }: AppProps) {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('All');
  const [type, setType] = useState('All');
  const [location, setLocation] = useState('All');
  const [status, setStatus] = useState('All');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const types = Array.from(new Set(history.map((item) => item.type)));
  const locations = Array.from(new Set(history.map((item) => item.location)));
  const filtered = history.filter((item) => (severity === 'All' || item.severity === severity) && (type === 'All' || item.type === type) && (location === 'All' || item.location === location) && (status === 'All' || item.status === status) && `${item.id} ${item.type} ${item.location} ${item.date}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  const pageSize = 5;
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const selectClass = 'rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-bold text-slate-600 outline-none';
  return <div className="mx-auto max-w-[1500px] space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Showing historical incidents · {history.length} local records</p><button onClick={() => pushToast('History export prepared locally', 'success')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"><Download size={14} />Export log</button></div><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-wrap gap-2"><div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={14} className="text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by ID, date, type or location" className="w-full bg-transparent py-2 text-xs outline-none" /></div><select aria-label="Filter by severity" value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(1); }} className={selectClass}><option value="All">All severity</option>{['Critical', 'High', 'Medium', 'Low'].map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by incident type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} className={selectClass}><option value="All">All types</option>{types.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by location" value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }} className={cn(selectClass, 'max-w-44')}><option value="All">All locations</option>{locations.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={selectClass}><option value="All">All status</option>{['RESOLVED', 'CANCELLED', 'TRANSFERRED'].map((item) => <option key={item}>{item}</option>)}</select><button onClick={() => setSortDesc(!sortDesc)} className={cn(selectClass, 'inline-flex items-center gap-1')}><SlidersHorizontal size={12} />{sortDesc ? 'Newest first' : 'Oldest first'}</button></div></div><section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="border-b border-slate-100 bg-slate-50/70"><tr>{['Incident ID', 'Date', 'Location', 'Type', 'Severity', 'Response time', 'Status'].map((label) => <th key={label} className="px-4 py-3 font-mono text-[9px] font-medium uppercase tracking-[.12em] text-slate-400">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-4 font-mono text-xs font-medium text-cyan-700">{item.id}</td><td className="px-4 py-4 font-mono text-[10px] text-slate-500">{item.date}</td><td className="px-4 py-4 text-xs text-slate-600">{item.location}</td><td className="px-4 py-4 text-xs font-bold">{item.type}</td><td className="px-4 py-4"><StatusBadge label={item.severity} /></td><td className="px-4 py-4 font-mono text-xs text-slate-600">{item.responseTime}</td><td className="px-4 py-4"><StatusBadge label={item.status} /></td></tr>)}</tbody></table></div>{visible.length === 0 && <div className="p-4"><EmptyState title="No matching history" detail="No completed incident matches the current filters." icon={FileClock} /></div>}<div className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><span className="text-[10px] text-slate-500">{filtered.length} results</span><div className="flex items-center gap-2"><button aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded border border-slate-200 p-1.5 text-slate-500 disabled:opacity-40"><ChevronLeft size={14} /></button><span className="font-mono text-[10px] text-slate-600">Page {page} of {pageCount}</span><button aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded border border-slate-200 p-1.5 text-slate-500 disabled:opacity-40"><ChevronRight size={14} /></button></div></div></section></div>;
}

function AnalyticsPage() {
  const [range, setRange] = useState('Last 30 days');
  const [, setLocation] = useLocation();
  const { incidents } = useAppStore();
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return <div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{range === 'Last 30 days' ? '01 Aug — 30 Aug 2026' : '24 Aug — 30 Aug 2026'} · Compared with previous period</p><button onClick={() => setRange(range === 'Last 30 days' ? 'Last 7 days' : 'Last 30 days')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><SlidersHorizontal size={14} />{range}<ChevronDown size={13} /></button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Total Incidents" value="184" detail="+12.4% from previous period" icon={Siren} accent="red" trend="up" spark={kpiSpark(incidents, 'incidents')} /><MetricCard label="Resolved Incidents" value="169" detail="91.8% resolution rate" icon={CheckCircle2} accent="teal" trend="up" spark={kpiSpark(incidents, 'response')} /><MetricCard label="Average Response Time" value="08:42" detail="1m 18s faster than target" icon={Clock3} accent="amber" trend="up" /><MetricCard label="Emergency Escalations" value="27" detail="14.7% of all incidents" icon={Zap} accent="red" /><MetricCard label="Driver Safe Rate" value="96.4%" detail="Across active fleet" icon={HeartPulse} accent="blue" trend="up" /></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel testId="panel-analytics-volume" eyebrow="Incidents by day" title="Incoming incident volume">
        <AreaChart series={[{ label: 'Incidents', values: analyticsData.incidentsByDay, color: '#ff5c5c' }]} labels={dayLabels} />
      </Panel>
      <Panel testId="panel-analytics-response" eyebrow="Average response time" title="Response time by day">
        <AreaChart series={[{ label: 'Minutes', values: analyticsData.responseTime, color: '#f08a3e' }]} labels={dayLabels} valueSuffix=" min" />
      </Panel>
      <Panel testId="panel-analytics-severity" eyebrow="Distribution · derived from records" title="Severity mix">
        <RankedBars items={severityMix(incidents, history)} valueSuffix="" />
      </Panel>
      <Panel testId="panel-analytics-types" eyebrow="Incident types" title="Where response effort goes">
        <Donut items={typeMix(history)} centerLabel={String(typeMix(history).reduce((sum, item) => sum + item.value, 0))} centerSub="records" />
      </Panel>
      <Panel testId="panel-analytics-teams" className="lg:col-span-2" eyebrow="Response performance" title="Team performance score">
        <MiniBars values={analyticsData.performance} labels={['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']} color="#4ade80" valueSuffix="%" />
      </Panel>
      <Panel testId="panel-analytics-lab" className="lg:col-span-2" eyebrow="Crash lab" title="Crash-simulation analytics" action="Open Crash Simulator" onAction={() => setLocation('/simulator')}>
        <SimulationAnalyticsSection />
      </Panel>
    </div>
  </div>;
}

function DemoPage({ pushToast }: AppProps) {
  const { incidents, setIncidents, setAmbulances, addNotification, userProfile, setUserProfile } = useAppStore();
  const [scenarioIncidentId, setScenarioIncidentId] = useState<string | null>(null);
  const [statusLines, setStatusLines] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const steps = ['Normal Driving', 'Simulate Crash', 'Driver Responds', 'Driver No Response', 'Emergency Escalation', 'Assign Ambulance', 'Resolve Incident'];
  const currentId = scenarioIncidentId ?? incidents[0]?.id;
  const execute = (action: string) => {
    if (action === 'Normal Driving') { setStatusLines({ driving: 'Vehicle telemetry nominal — simulated' }); setStep(0); pushToast('Normal driving state loaded', 'info'); return; }
    if (action === 'Simulate Crash') {
      // Max-based so ids stay unique even after the simulator is reset mid-session.
      const maxUsed = Math.max(2050, ...incidents.filter((item) => /^INC-205\d$/.test(item.id)).map((item) => Number(item.id.slice(4))));
      const id = `INC-${maxUsed + 1}`;
      const newIncident: Incident = { id, code: id, type: 'Possible vehicle crash', severity: 'Critical', status: 'Verification', location: 'NH-44, Jaipur Sector', zone: 'North corridor', reportedAt: '19:42', updatedAt: '19:42', caller: 'Demo crash sensor', callerPhone: 'Simulated telemetry', summary: 'Demo crash generated locally for presentation. No emergency service has been contacted.', assignments: [], responseMinutes: 0, riskScore: 92, detectionTime: '19:42:10', latitude: '26.9124', longitude: '75.7873', riskFactors: ['Sudden deceleration', 'No driver response yet'], owner: demoOwner, cancelDeadline: new Date(Date.now() + 30_000).toISOString() };
      // Simulated dispatch log (flow step 7A): every saved contact is "notified" in demo mode.
      const notified = userProfile.emergencyContacts.map((contact) => ({ incidentCode: id, contactId: contact.id, contactName: contact.name || 'Unnamed contact', phone: contact.phone, status: 'simulated' as const, at: new Date().toLocaleTimeString('en-IN', { hour12: false }) }));
      setUserProfile((current) => ({ ...current, notificationLog: [...notified, ...(current.notificationLog ?? [])].slice(0, 25) }));
      setIncidents((current) => [newIncident, ...current]); setScenarioIncidentId(id); setStatusLines({ detected: 'CRITICAL INCIDENT DETECTED', verification: 'Driver verification pending', contacts: `NOTIFIED (SIMULATED) — ${notified.length} contact${notified.length === 1 ? '' : 's'}` }); setStep(1); addNotification('Critical crash detected', `${id} created in Demo Mode — contacts queued, no live services contacted.`, 'critical'); pushToast(`CRITICAL INCIDENT DETECTED · ${notified.length} contact(s) queued`, 'warning'); return;
    }
    if (!currentId) return;
    if (action === 'Driver Responds') { setIncidents((current) => current.map((item) => item.id === currentId ? { ...item, status: 'Cancelled', summary: 'Driver responded and confirmed they are safe. Demo incident cancelled.' } : item)); setStatusLines({ verification: 'SAFE', incident: 'CANCELLED' }); setStep(2); pushToast('Driver status SAFE · incident CANCELLED', 'success'); return; }
    if (action === 'Driver No Response') { setIncidents((current) => current.map((item) => item.id === currentId ? { ...item, status: 'Escalated', summary: 'No driver response received. Emergency escalation triggered in Demo Mode.' } : item)); setStatusLines({ verification: 'NO RESPONSE', escalation: 'Emergency escalation triggered' }); setStep(3); addNotification('Driver verification timeout', `${currentId} escalated in Demo Mode.`, 'warning'); pushToast('Emergency escalation triggered', 'warning'); return; }
    if (action === 'Emergency Escalation') { setStatusLines({ police: 'NOTIFIED — SIMULATED', ambulance: 'DISPATCHED — SIMULATED', hospital: 'ALERTED — SIMULATED' }); setIncidents((current) => current.map((item) => item.id === currentId ? { ...item, status: 'Escalated' } : item)); setStep(4); addNotification('Emergency escalation triggered', 'Police, ambulance and hospital alerts are simulated.', 'warning'); pushToast('Police, ambulance and hospital alerts simulated', 'warning'); return; }
    if (action === 'Assign Ambulance') { setStatusLines({ ambulanceAssignment: 'Ambulance AMB-108 assigned.', eta: 'ETA: 08 min' }); setAmbulances((current) => current.map((item) => item.id === 'AMB-108' ? { ...item, status: 'DISPATCHED', assignedIncident: currentId } : item)); setIncidents((current) => current.map((item) => item.id === currentId ? { ...item, assignments: ['AMB-108'], nearestAmbulance: 'AMB-108', status: 'Responding' } : item)); setStep(5); pushToast('Ambulance AMB-108 assigned · ETA 08 min', 'success'); return; }
    if (action === 'Resolve Incident') { setIncidents((current) => current.map((item) => item.id === currentId ? { ...item, status: 'Resolved' } : item)); setStatusLines({ incident: 'RESOLVED' }); setStep(6); addNotification('Incident resolved', `${currentId} resolved in Demo Mode.`, 'good'); pushToast('Demo incident resolved locally', 'success'); }
  };
  return <div className="mx-auto max-w-[1100px] space-y-5"><div className="rounded-xl border border-amber-200 bg-[#fff8e3] p-5"><div className="flex items-start gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f3c44e] text-[#172634]"><Radio size={20} /></div><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-amber-800">DEMO MODE — SIMULATED DATA</p><h2 className="mt-1 text-base font-extrabold text-[#172634]">Emergency response simulator</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-amber-900/70">Every action changes frontend state only. Police, ambulance and hospital notifications are simulated and no live services are contacted.</p></div></div></div><div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><section className="rounded-xl border border-slate-200 bg-white p-5"><SectionHeading eyebrow="Simulation controls" title="Run a response scenario" /><div className="grid gap-2">{steps.map((action, index) => <button key={action} data-testid={`button-sim-${action.toLowerCase().replace(/\s/g, '-')}`} onClick={() => execute(action)} className={cn('flex items-center justify-between rounded-lg border px-3 py-3 text-left text-xs font-bold transition-colors', step === index ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : action === 'Simulate Crash' ? 'border-red-200 bg-red-50/60 text-red-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}><span className="flex items-center gap-2">{index === 0 ? <Gauge size={15} /> : index === 1 ? <Siren size={15} /> : index === 6 ? <CheckCircle2 size={15} /> : <ChevronRight size={15} />}{action}</span>{step >= index && index > 0 && <Check size={14} />}</button>)}</div><button onClick={() => { setStep(0); setScenarioIncidentId(null); setStatusLines({}); pushToast('Simulator reset', 'info'); }} className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800"><RefreshCw size={13} />Reset simulator</button></section><section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-cyan-700">Simulation output</p><h2 className="mt-1 text-base font-extrabold">{currentId ?? 'Awaiting scenario'}</h2></div><StatusBadge label="Demo only" tone="moderate" /></div><div className="mt-6 space-y-3">{Object.keys(statusLines).length ? Object.entries(statusLines).map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"><span className="text-xs font-bold capitalize text-slate-600">{label.replace(/([A-Z])/g, ' $1')}</span><span className={cn('text-right text-xs font-extrabold', value.includes('CRITICAL') || value.includes('NO RESPONSE') ? 'text-red-700' : 'text-cyan-700')}>{value}</span></div>) : <EmptyState title="No simulation output yet" detail="Use Simulate Crash to create a local incident and start the presentation flow." icon={Play} />}</div><div className="mt-6 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900"><b>Safety note:</b> Demo data is local to this browser session. No real emergency call, SMS, IoT event, police dispatch or ambulance dispatch is performed.</div></section></div></div>;
}

function SettingsPage({ pushToast }: AppProps) {
  const [settings, setSettings] = useState({ dark: false, compact: false, notifications: true });
  const toggle = (key: keyof typeof settings) => setSettings((current) => ({ ...current, [key]: !current[key] }));
  const Toggle = ({ label, detail, setting }: { label: string; detail: string; setting: keyof typeof settings }) => <button onClick={() => { toggle(setting); pushToast(`${label} ${settings[setting] ? 'disabled' : 'enabled'}`, 'info'); }} className="flex w-full items-center justify-between gap-4 py-3 text-left"><span><span className="block text-xs font-bold">{label}</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{detail}</span></span><span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', settings[setting] ? 'bg-cyan-600' : 'bg-slate-300')}><span className={cn('absolute top-1 h-3 w-3 rounded-full bg-white transition-transform', settings[setting] ? 'translate-x-5' : 'translate-x-1')} /></span></button>;
  return <div className="mx-auto max-w-[1000px] space-y-5"><section className="rounded-xl border border-slate-200 bg-white p-5"><SectionHeading eyebrow="Demo Configuration" title="Emergency configuration" /><div className="grid gap-3 sm:grid-cols-2">{[['112', 'Unified Emergency'], ['100', 'Police'], ['108', 'Ambulance'], ['101', 'Fire']].map(([number, label]) => <div key={number} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"><div><p className="font-mono text-sm font-bold text-cyan-700">{number}</p><p className="text-[10px] text-slate-500">{label}</p></div><span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-bold uppercase text-amber-800">Demo only</span></div>)}</div></section><section className="rounded-xl border border-slate-200 bg-white p-5"><SectionHeading eyebrow="Control Center" title="Operating profile" /><div className="grid gap-4 sm:grid-cols-3"><label className="text-xs font-bold text-slate-600">Location<select className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"><option>Jaipur Control Center</option><option>Delhi Control Center</option><option>Mumbai Control Center</option><option>Bengaluru Control Center</option></select></label><label className="text-xs font-bold text-slate-600">Timezone<select className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"><option>Asia/Kolkata · IST (UTC+5:30)</option></select></label><label className="text-xs font-bold text-slate-600">Language<select className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"><option>English</option><option>हिन्दी</option></select></label></div></section><section className="rounded-xl border border-slate-200 bg-white p-5"><SectionHeading eyebrow="Interface" title="Display and alerts" /><div className="divide-y divide-slate-100"><Toggle label="Dark mode" detail="Use a lower-light control room appearance on this device." setting="dark" /><Toggle label="Compact mode" detail="Reduce row height when scanning large data tables." setting="compact" /><Toggle label="Notifications" detail="Show local toast and notification center updates." setting="notifications" /></div><div className="mt-5 flex justify-end border-t border-slate-100 pt-4"><button onClick={() => pushToast('Preferences saved to this browser session', 'success')} className="rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-bold text-[#06121c] hover:bg-cyan-500">Save preferences</button></div></section></div>;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function cancelDeadlineMs(deadline: string | undefined): number | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  return ms > 0 ? ms : null;
}

/** Expires cancellation windows: when 30s pass, dispatch is confirmed and the option disappears. */
function CancelWindowSweep() {
  const { incidents, setIncidents } = useAppStore();
  const anyActive = incidents.some((item) => item.cancelDeadline);
  useEffect(() => {
    if (!anyActive) return;
    const timer = window.setInterval(() => {
      setIncidents((current) => {
        const expired = current.some((item) => item.cancelDeadline && new Date(item.cancelDeadline).getTime() <= Date.now());
        if (!expired) return current;
        return current.map((item) => {
          if (!item.cancelDeadline || new Date(item.cancelDeadline).getTime() > Date.now()) return item;
          return { ...item, cancelDeadline: undefined, timeline: [...(item.timeline ?? []), { title: 'Cancellation window closed', time: new Date().toTimeString().slice(0, 8), detail: '30-second false-alarm window expired — dispatch workflow confirmed' }] };
        });
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [anyActive, setIncidents]);
  return null;
}

function LoginPage({ onLogin, pushToast }: { onLogin: (user: LoginUser) => void; pushToast: AppProps['pushToast'] }) {
  const [email, setEmail] = useState('admin@rakshasetu.in');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const user = loginUsers.find((entry) => entry.email.toLowerCase() === email.trim().toLowerCase() && entry.password === password);
    if (!user) { setError('Invalid email or password. Try the demo credentials shown below.'); return; }
    pushToast(`Welcome back, ${user.displayName}`, 'success');
    onLogin(user);
  };
  return <div className="flex min-h-[100dvh] items-center justify-center p-4"><div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-[0_30px_80px_rgba(0,0,0,.5)] lg:grid-cols-2">
    <div className="grid-noise hidden flex-col justify-between border-r border-slate-200 bg-slate-950/60 p-8 lg:flex">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950"><Shield size={22} strokeWidth={2.5} /></div><div><p className="text-base font-extrabold tracking-[.12em] text-white">RAKSHA SETU</p><p className="font-mono text-[9px] uppercase tracking-[.16em] text-slate-400">Emergency Response Platform</p></div></div>
      <div><h2 className="text-xl font-extrabold leading-snug text-white">Every second counts.<br />Respond with confidence.</h2><p className="mt-3 text-xs leading-5 text-slate-400">Crash detection, driver verification with a 30-second false-alarm window, live geo-location and medical profiles — one control center for the whole response network.</p>
        <div className="mt-6 space-y-2.5">{[['30s', 'False-alarm cancellation window'], ['GPS', 'Live crash geo-location'], ['24×7', 'Medical profile at the scene']].map(([big, label]) => <div key={big} className="flex items-center gap-3"><span className="w-14 shrink-0 rounded-lg bg-amber-500/15 px-2 py-1 text-center font-mono text-[11px] font-bold text-amber-500">{big}</span><span className="text-xs text-slate-300">{label}</span></div>)}</div></div>
      <p className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">Demo environment · simulated data only</p>
    </div>
    <form onSubmit={submit} className="bg-white p-8"><h1 className="text-lg font-extrabold tracking-tight text-slate-800">Sign in</h1><p className="mt-1 text-xs text-slate-500">Access the control center dashboard.</p>
      <label className="mt-6 block text-xs font-bold text-slate-600">Email<input type="email" required value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="you@rakshasetu.in" data-testid="input-login-email" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pl-9 text-xs outline-none focus:border-cyan-500" /></label>
      <label className="mt-4 block text-xs font-bold text-slate-600">Password<div className="relative mt-1.5"><Lock size={14} className="absolute left-3 top-3.5 text-slate-400" /><input type={showPassword ? 'text' : 'password'} required value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} placeholder="Enter your password" data-testid="input-login-password" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pl-9 text-xs outline-none focus:border-cyan-500" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-[10px] font-bold text-cyan-700">{showPassword ? 'HIDE' : 'SHOW'}</button></div></label>
      {error && <p data-testid="text-login-error" className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700"><AlertTriangle size={13} />{error}</p>}
      <button type="submit" data-testid="button-login-submit" className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-xs font-bold text-[#06121c] hover:bg-cyan-500"><LogIn size={15} />Sign in to control center</button>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Demo credentials</p><div className="mt-2 space-y-1 font-mono text-[10px] text-slate-600">{loginUsers.map((user) => <p key={user.email}>{user.email} · {user.password} <span className="text-slate-400">({user.role})</span></p>)}</div></div>
      <p className="mt-4 text-center text-[10px] text-slate-400">Protected demo · no real emergency services are contacted.</p>
    </form>
  </div></div>;
}

function GeolocationPanel({ pushToast }: AppProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number; at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const locate = () => {
    if (!('geolocation' in navigator)) { setError('Geolocation is not supported on this device.'); return; }
    setLoading(true); setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => { setCoords({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, at: new Date().toLocaleTimeString('en-IN', { hour12: false }) }); setLoading(false); pushToast('Live location captured', 'success'); },
      () => { setError('Location permission denied — enter the address manually above.'); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const link = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  return <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live GPS position</p><p className="mt-1 text-xs font-bold text-slate-700">{coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Not captured yet'}</p>{coords && <p className="mt-0.5 font-mono text-[9px] text-slate-400">±{Math.round(coords.accuracy)}m accuracy · captured {coords.at}</p>}{error && <p className="mt-1 text-[10px] font-semibold text-red-600">{error}</p>}</div>
      <div className="flex gap-2"><button onClick={locate} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-[10px] font-bold text-[#06121c] hover:bg-cyan-500 disabled:opacity-50"><Navigation size={12} />{loading ? 'Locating…' : 'Capture location'}</button>{coords && <a href={link(coords.lat, coords.lng)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600">Open map</a>}</div></div>
  </div>;
}

function ProfilePage({ pushToast }: AppProps) {
  const { userProfile, setUserProfile, incidents } = useAppStore();
  const [saved, setSaved] = useState(false);
  const update = (key: keyof PersonalInfo, value: string) => setUserProfile((current) => ({ ...current, [key]: value }));
  const updateContact = (id: string, key: keyof EmergencyContact, value: string | boolean) => {
    setUserProfile((current) => ({ ...current, emergencyContacts: current.emergencyContacts.map((contact) => contact.id === id ? { ...contact, [key]: value } : contact) }));
    setSaved(false);
  };
  const addContact = () => {
    setUserProfile((current) => ({ ...current, emergencyContacts: [...current.emergencyContacts, { id: `EC-${Date.now()}`, name: '', relation: '', phone: '', isPrimary: current.emergencyContacts.length === 0 }] }));
    setSaved(false);
  };
  const removeContact = (id: string) => {
    setUserProfile((current) => {
      const remaining = current.emergencyContacts.filter((contact) => contact.id !== id);
      return { ...current, emergencyContacts: remaining.some((contact) => contact.isPrimary) || remaining.length === 0 ? remaining : remaining.map((contact, index) => index === 0 ? { ...contact, isPrimary: true } : contact) };
    });
    setSaved(false);
    pushToast('Emergency contact removed', 'info');
  };
  const markPrimary = (id: string) => {
    setUserProfile((current) => ({ ...current, emergencyContacts: current.emergencyContacts.map((contact) => ({ ...contact, isPrimary: contact.id === id })) }));
    setSaved(false);
  };
  const crashIncidents = incidents.filter((item) => item.latitude && item.longitude && !['Resolved', 'Cancelled'].includes(item.status));
  const field = (key: keyof PersonalInfo, label: string, placeholder: string, type = 'text') => <label className="text-xs font-bold text-slate-600">{label}<input type={type} value={String(userProfile[key])} onChange={(event) => { update(key, event.target.value); setSaved(false); }} placeholder={placeholder} data-testid={`input-profile-${key}`} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-cyan-500" /></label>;
  return <div className="mx-auto max-w-[1100px] space-y-5">
    <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d9e9eb] text-sm font-extrabold text-cyan-800">{userProfile.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><h2 className="text-base font-extrabold text-slate-800">{userProfile.fullName}</h2><p className="text-xs text-slate-500">{userProfile.gender} · {userProfile.age} yrs · Blood group {userProfile.bloodGroup}</p></div></div><StatusBadge label={saved ? 'Saved' : 'Unsaved changes'} tone={saved ? 'good' : 'monitoring'} /></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{field('fullName', 'Full name', 'Full name')}{field('age', 'Age', 'Age', 'number')}
        <label className="text-xs font-bold text-slate-600">Gender<select value={userProfile.gender} onChange={(event) => { update('gender', event.target.value); setSaved(false); }} data-testid="select-profile-gender" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"><option>Male</option><option>Female</option><option>Other</option></select></label>
        <label className="text-xs font-bold text-slate-600">Blood group<select value={userProfile.bloodGroup} onChange={(event) => { update('bloodGroup', event.target.value); setSaved(false); }} data-testid="select-profile-blood-group" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none">{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group}>{group}</option>)}</select></label>
        {field('disease', 'Known diseases', 'e.g. Diabetes, asthma — or None')}{field('medication', 'Current medication', 'e.g. Insulin, inhaler — or None')}
        <label className="text-xs font-bold text-slate-600 sm:col-span-2">Address<textarea value={userProfile.address} onChange={(event) => { update('address', event.target.value); setSaved(false); }} rows={2} data-testid="input-profile-address" className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-cyan-500" /></label></div>
      <div className="mt-4"><GeolocationPanel pushToast={pushToast} /></div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><p className="text-[10px] text-slate-400">Shared with responders only when a crash is detected for this vehicle.</p><button data-testid="button-save-profile" onClick={() => { setSaved(true); pushToast('Personal info saved to this browser session', 'success'); }} className="rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-bold text-[#06121c] hover:bg-cyan-500">Save personal info</button></div></section>

    <section className="rounded-xl border border-slate-200 bg-white p-5"><SectionHeading eyebrow="Emergency profile" title="Crash geo-location" /><p className="mb-4 text-xs text-slate-500">Location transmitted with every crash alert for this person.</p>
      {crashIncidents.length ? <div className="space-y-3">{crashIncidents.map((incident) => <div key={incident.id} data-testid={`panel-crash-location-${incident.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50/50 p-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700"><MapPin size={16} /></span><div><p className="font-mono text-[10px] font-bold text-red-700">{incident.code} · {incident.status}</p><p className="mt-0.5 text-xs font-bold text-slate-700">{incident.location}</p><p className="mt-0.5 font-mono text-[10px] text-slate-500">{incident.latitude}, {incident.longitude}</p></div></div><div className="flex items-center gap-2"><a href={`https://www.openstreetmap.org/?mlat=${incident.latitude}&mlon=${incident.longitude}#map=16/${incident.latitude}/${incident.longitude}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600">Open map</a><span className="rounded-full bg-white px-2.5 py-1 font-mono text-[9px] font-bold text-slate-500">DETECTED {incident.detectionTime ?? incident.reportedAt}</span></div></div>)}</div> : <EmptyState title="No active crash locations" detail="When a crash is detected for this vehicle, its GPS coordinates appear here for responders." icon={MapPin} />}</section>

    <section className="rounded-xl border border-slate-200 bg-white p-5"><SectionHeading eyebrow="Emergency contacts" title="Notified during crashes" action="Add contact" onAction={addContact} />
      <p className="mb-4 text-xs text-slate-500">Everyone here receives the crash alert SMS with location, blood group and medical notes. One contact is the primary.</p>
      <div className="space-y-3">{userProfile.emergencyContacts.map((contact) => <div key={contact.id} data-testid={`panel-contact-${contact.id}`} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
        <div className="grid gap-2.5 sm:grid-cols-[1.3fr_.9fr_1.1fr_auto]">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Name<input value={contact.name} onChange={(event) => updateContact(contact.id, 'name', event.target.value)} placeholder="Contact name" data-testid={`input-contact-name-${contact.id}`} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-cyan-500" /></label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Relation<input value={contact.relation} onChange={(event) => updateContact(contact.id, 'relation', event.target.value)} placeholder="Wife, Brother…" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-cyan-500" /></label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone<input value={contact.phone} onChange={(event) => updateContact(contact.id, 'phone', event.target.value)} placeholder="+91 98765 43210" data-testid={`input-contact-phone-${contact.id}`} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-cyan-500" /></label>
          <div className="flex items-end gap-1.5">
            <button title={contact.isPrimary ? 'Primary contact' : 'Make primary'} onClick={() => markPrimary(contact.id)} className={cn('rounded-lg px-2.5 py-2 text-[10px] font-bold', contact.isPrimary ? 'bg-emerald-100 text-emerald-700' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-100')}>{contact.isPrimary ? '★ PRIMARY' : '☆ SET PRIMARY'}</button>
            <button title="Remove contact" data-testid={`button-remove-contact-${contact.id}`} onClick={() => removeContact(contact.id)} className="rounded-lg border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
          </div>
        </div>
      </div>)}{userProfile.emergencyContacts.length === 0 && <EmptyState title="No emergency contacts" detail="Add at least one contact so responders and crash alerts can reach your family." icon={Phone} />}</div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5"><SectionHeading eyebrow="Dispatch log" title="Contact notification history" /><p className="mb-4 text-xs text-slate-500">Who was alerted for each crash and whether the SMS was sent, simulated (demo mode) or failed.</p>
      {userProfile.notificationLog && userProfile.notificationLog.length ? <div className="overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-left"><thead className="border-b border-slate-100 bg-slate-50/70"><tr>{['Incident', 'Contact', 'Phone', 'Status', 'Time'].map((heading) => <th key={heading} className="px-4 py-3 font-mono text-[9px] font-medium uppercase tracking-[.12em] text-slate-400">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{userProfile.notificationLog.map((entry, index) => <tr key={`${entry.incidentCode}-${entry.contactId}-${index}`} data-testid={`row-notification-${index}`}><td className="px-4 py-3 font-mono text-[10px] font-medium text-cyan-700">{entry.incidentCode}</td><td className="px-4 py-3 text-xs font-bold text-slate-700">{entry.contactName}</td><td className="px-4 py-3 font-mono text-[10px] text-slate-600">{entry.phone}</td><td className="px-4 py-3"><StatusBadge label={entry.status === 'simulated' ? 'Simulated' : entry.status === 'sent' ? 'Sent' : entry.status === 'failed' ? 'Failed' : 'Queued'} tone={entry.status === 'sent' ? 'good' : entry.status === 'failed' ? 'critical' : 'monitoring'} /></td><td className="px-4 py-3 font-mono text-[10px] text-slate-500">{entry.at}</td></tr>)}</tbody></table></div> : <EmptyState title="No dispatches yet" detail="When a crash alert goes out, every notified contact appears here with its delivery status." icon={MessageSquare} />}</section>
  </div>;
}

function RoutedApp({ pushToast }: AppProps) {
  // NOTE: children form (not `component={() => <X />}`) so page components keep a
  // stable identity — inline arrows remount the page on every parent re-render,
  // which reset local UI state (drawers, countdowns, form drafts).
  // NOTE: the base-aware <Router> lives in <BaseRouter> at the app root (wrapping
  // the shell too), so every Link — sidebar included — keeps the sub-path prefix.
  return <Switch>
    <Route path="/"><Redirect to="/overview" /></Route>
    <Route path="/overview"><Overview pushToast={pushToast} /></Route>
    <Route path="/incidents"><IncidentsPage pushToast={pushToast} /></Route>
    <Route path="/vehicles"><ResourceTablePage kind="vehicles" pushToast={pushToast} /></Route>
    <Route path="/drivers"><ResourceTablePage kind="drivers" pushToast={pushToast} /></Route>
    <Route path="/emergency-services"><ServicesPage pushToast={pushToast} /></Route>
    <Route path="/response-team"><TeamsPage pushToast={pushToast} /></Route>
    <Route path="/history"><HistoryPage pushToast={pushToast} /></Route>
    <Route path="/analytics"><AnalyticsPage /></Route>
    <Route path="/demo"><DemoPage pushToast={pushToast} /></Route>
    <Route path="/settings"><SettingsPage pushToast={pushToast} /></Route>
    <Route path="/profile"><ProfilePage pushToast={pushToast} /></Route>
    <Route path="/simulator"><SimulatorPage pushToast={pushToast} /></Route>
    <Route path="/telemetry"><TelemetryPage /></Route>
    <Route path="/analysis"><AnalysisPage /></Route>
    <Route path="/reports"><ReportsPage pushToast={pushToast} /></Route>
    <Route path="/reports/:id"><ReportDetailPage pushToast={pushToast} /></Route>
    <Route path="/methodology"><MethodologyPage /></Route>
    <Route><NotFoundPage /></Route>
  </Switch>;
}

function NotFoundPage() {
  const [, setLocation] = useLocation();
  return <div className="flex min-h-[60vh] flex-col items-center justify-center text-center"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Command size={22} /></div><h1 className="mt-4 text-xl font-extrabold">Route not found</h1><p className="mt-2 text-sm text-slate-500">This control center view does not exist.</p><button onClick={() => setLocation('/overview')} className="mt-5 rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-bold text-[#06121c]">Return to overview</button></div>;
}

// One base-aware <Router> wrapping the ENTIRE app (shell, login and pages).
// Previously the Router sat lower in the tree, so the sidebar/login used wouter's
// baseless default router — every sidebar click then pushed a prefix-less URL
// (github.io/drivers instead of github.io/RAKSHA-SETU/drivers) and the content
// pane went black because no route matched.
function BaseRouter({ children }: { children: ReactNode }) {
  const routerBase = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');
  return <Router base={routerBase}>{children}</Router>;
}

function App() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [appIncidents, setAppIncidents] = useState<Incident[]>(seedIncidents);
  const [appVehicles, setAppVehicles] = useState<Vehicle[]>(seedVehicles);
  const [appDrivers, setAppDrivers] = useState<Driver[]>(seedDrivers);
  const [appNotifications, setAppNotifications] = useState<Notification[]>(seedNotifications);
  const [appAmbulances, setAppAmbulances] = useState<Ambulance[]>(seedAmbulances);
  const [appUserProfile, setAppUserProfile] = useState<PersonalInfo>(demoOwner);
  const [authUser, setAuthUser] = useState<LoginUser | null>(() => {
    try {
      const raw = window.sessionStorage.getItem('rs-auth');
      return raw ? (JSON.parse(raw) as LoginUser) : null;
    } catch { return null; }
  });
  // Self-heal legacy prefix-less URLs (old bookmarks, links from stale builds):
  // when the app is served from a sub-path but the address bar lacks it,
  // normalize the URL once so routes and links resolve again.
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    if (base !== '/' && !window.location.pathname.startsWith(base)) {
      const prefix = base.replace(/\/$/, '');
      const rest = window.location.pathname.replace(/^\/+/, '');
      window.history.replaceState(null, '', `${prefix}/${rest}${window.location.search}${window.location.hash}`);
    }
  }, []);
  const login = (user: LoginUser) => {
    setAuthUser(user);
    try { window.sessionStorage.setItem('rs-auth', JSON.stringify(user)); } catch { /* private mode */ }
  };
  const logout = () => {
    setAuthUser(null);
    try { window.sessionStorage.removeItem('rs-auth'); } catch { /* private mode */ }
    pushToast('Signed out of the control center', 'info');
  };
  const pushToast = (message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3200);
  };
  const addNotification = (title: string, description: string, tone: Notification['tone']) => {
    setAppNotifications((current) => [{ id: `N-${Date.now()}`, title, description, time: 'Just now', unread: true, tone }, ...current]);
  };
  const store: AppStore = { incidents: appIncidents, setIncidents: setAppIncidents, vehicles: appVehicles, setVehicles: setAppVehicles, drivers: appDrivers, setDrivers: setAppDrivers, notifications: appNotifications, addNotification, ambulances: appAmbulances, setAmbulances: setAppAmbulances, userProfile: appUserProfile, setUserProfile: setAppUserProfile };
  if (!authUser) return <AppContext.Provider value={store}><BaseRouter><LoginPage onLogin={login} pushToast={pushToast} /></BaseRouter></AppContext.Provider>;
  return <AppContext.Provider value={store}><CancelWindowSweep /><BaseRouter><AppShell toasts={toasts} pushToast={pushToast} onLogout={logout}><SimulationStoreProvider><RoutedApp pushToast={pushToast} /></SimulationStoreProvider></AppShell></BaseRouter></AppContext.Provider>;
}

export default App;