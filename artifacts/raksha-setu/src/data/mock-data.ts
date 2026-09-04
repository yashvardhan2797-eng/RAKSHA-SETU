export type Severity = 'Critical' | 'High' | 'Moderate' | 'Low';
export type IncidentStatus = 'Active' | 'Dispatched' | 'Monitoring' | 'Resolved';

export type Incident = {
  id: string;
  code: string;
  type: string;
  severity: Severity;
  status: IncidentStatus;
  location: string;
  zone: string;
  reportedAt: string;
  updatedAt: string;
  caller: string;
  callerPhone: string;
  summary: string;
  assignments: string[];
  responseMinutes: number;
};

export const incidents: Incident[] = [
  { id: 'INC-2481', code: 'INC-2481', type: 'Multi-vehicle collision', severity: 'Critical', status: 'Dispatched', location: 'NH-48, Sector 18 flyover', zone: 'North corridor', reportedAt: '08:42', updatedAt: '08:49', caller: 'Aarav Mehta', callerPhone: '+91 98••• 4421', summary: 'Three vehicles involved. One lane blocked and possible entrapment reported.', assignments: ['AMB-07', 'PAT-12', 'RSP-04'], responseMinutes: 7 },
  { id: 'INC-2480', code: 'INC-2480', type: 'Medical emergency', severity: 'High', status: 'Active', location: 'Shanti Towers, Block C', zone: 'Central district', reportedAt: '08:36', updatedAt: '08:44', caller: 'Meera Shah', callerPhone: '+91 97••• 1038', summary: 'Unresponsive adult, building security awaiting response team at lobby.', assignments: ['AMB-03', 'RSP-02'], responseMinutes: 8 },
  { id: 'INC-2479', code: 'INC-2479', type: 'Structural hazard', severity: 'High', status: 'Monitoring', location: 'Old market, Gate 2', zone: 'East district', reportedAt: '08:18', updatedAt: '08:38', caller: 'Rohan Das', callerPhone: '+91 99••• 2284', summary: 'Falling facade debris after overnight rain. Crowd moved behind barricade.', assignments: ['PAT-06', 'RSP-06'], responseMinutes: 20 },
  { id: 'INC-2478', code: 'INC-2478', type: 'Fire alarm', severity: 'Moderate', status: 'Dispatched', location: 'Crescent Tech Park, Tower 4', zone: 'West district', reportedAt: '08:07', updatedAt: '08:32', caller: 'Automated panel', callerPhone: 'Control panel', summary: 'Alarm triggered on level 6. Building evacuation underway; no visible smoke.', assignments: ['FIR-09', 'RSP-01'], responseMinutes: 25 },
  { id: 'INC-2477', code: 'INC-2477', type: 'Waterlogging', severity: 'Moderate', status: 'Monitoring', location: 'Lake Road underpass', zone: 'South corridor', reportedAt: '07:54', updatedAt: '08:21', caller: 'Traffic control', callerPhone: 'Desk 04', summary: 'Road surface submerged by 20cm. Traffic diverted to service lane.', assignments: ['PAT-03'], responseMinutes: 27 },
  { id: 'INC-2476', code: 'INC-2476', type: 'Lost person', severity: 'Low', status: 'Resolved', location: 'Civic gardens, north gate', zone: 'Central district', reportedAt: '07:32', updatedAt: '08:03', caller: 'Nisha Kapoor', callerPhone: '+91 96••• 7802', summary: 'Child reunited with family by park security.', assignments: ['RSP-05'], responseMinutes: 31 },
];

export const vehicles = [
  { id: 'AMB-07', name: 'Aster 07', type: 'Advanced ambulance', status: 'En route', readiness: 96, location: 'NH-48 / Sector 18', driver: 'Vikram Singh', team: 'RSP-04', fuel: 72, lastService: '12 Jun 2024', eta: '04 min' },
  { id: 'AMB-03', name: 'Aster 03', type: 'Basic ambulance', status: 'At scene', readiness: 91, location: 'Shanti Towers', driver: 'Sana Qureshi', team: 'RSP-02', fuel: 58, lastService: '29 May 2024', eta: 'On scene' },
  { id: 'PAT-12', name: 'Sentinel 12', type: 'Patrol vehicle', status: 'En route', readiness: 88, location: 'NH-48 westbound', driver: 'Dev Patel', team: 'Patrol Alpha', fuel: 64, lastService: '05 Jun 2024', eta: '06 min' },
  { id: 'PAT-06', name: 'Sentinel 06', type: 'Patrol vehicle', status: 'Available', readiness: 100, location: 'East district station', driver: 'Ananya Rao', team: 'Patrol Bravo', fuel: 89, lastService: '18 Jun 2024', eta: 'Ready' },
  { id: 'FIR-09', name: 'Ember 09', type: 'Fire response unit', status: 'Available', readiness: 94, location: 'West station bay 2', driver: 'Kabir Joshi', team: 'Fire Alpha', fuel: 81, lastService: '10 Jun 2024', eta: 'Ready' },
  { id: 'PAT-03', name: 'Sentinel 03', type: 'Patrol vehicle', status: 'Maintenance', readiness: 41, location: 'Fleet workshop', driver: 'Unassigned', team: '—', fuel: 32, lastService: '19 Jun 2024', eta: '18 Jun' },
  { id: 'AMB-11', name: 'Aster 11', type: 'Advanced ambulance', status: 'Available', readiness: 98, location: 'Central ambulance base', driver: 'Arjun Menon', team: 'RSP-03', fuel: 93, lastService: '16 Jun 2024', eta: 'Ready' },
];

export const drivers = [
  { id: 'DRV-104', name: 'Vikram Singh', initials: 'VS', role: 'Critical care driver', status: 'On duty', shift: '06:00 — 14:00', vehicle: 'AMB-07', zone: 'North corridor', contact: '+91 98••• 3172', hours: '02h 49m' },
  { id: 'DRV-118', name: 'Sana Qureshi', initials: 'SQ', role: 'Paramedic driver', status: 'On scene', shift: '06:00 — 14:00', vehicle: 'AMB-03', zone: 'Central district', contact: '+91 99••• 5814', hours: '03h 06m' },
  { id: 'DRV-087', name: 'Dev Patel', initials: 'DP', role: 'Response driver', status: 'On duty', shift: '07:00 — 15:00', vehicle: 'PAT-12', zone: 'North corridor', contact: '+91 97••• 2289', hours: '01h 49m' },
  { id: 'DRV-091', name: 'Ananya Rao', initials: 'AR', role: 'Patrol driver', status: 'Available', shift: '06:00 — 14:00', vehicle: 'PAT-06', zone: 'East district', contact: '+91 96••• 4410', hours: '03h 12m' },
  { id: 'DRV-076', name: 'Kabir Joshi', initials: 'KJ', role: 'Fire unit driver', status: 'Available', shift: '06:00 — 14:00', vehicle: 'FIR-09', zone: 'West district', contact: '+91 98••• 9012', hours: '03h 31m' },
  { id: 'DRV-112', name: 'Arjun Menon', initials: 'AM', role: 'Critical care driver', status: 'Available', shift: '08:00 — 16:00', vehicle: 'AMB-11', zone: 'Central district', contact: '+91 99••• 6742', hours: '00h 49m' },
  { id: 'DRV-065', name: 'Ishita Roy', initials: 'IR', role: 'Response driver', status: 'Off duty', shift: '14:00 — 22:00', vehicle: 'Unassigned', zone: 'South corridor', contact: '+91 97••• 1732', hours: '—' },
];

export const ambulances = [
  { id: 'AMB-07', facility: 'Aster 07', capability: 'Advanced life support', status: 'Dispatched', location: 'NH-48, Sector 18', eta: '04 min', crew: '3 members' },
  { id: 'AMB-03', facility: 'Aster 03', capability: 'Basic life support', status: 'At scene', location: 'Shanti Towers', eta: 'On scene', crew: '2 members' },
  { id: 'AMB-11', facility: 'Aster 11', capability: 'Advanced life support', status: 'Available', location: 'Central ambulance base', eta: '—', crew: '3 members' },
  { id: 'AMB-02', facility: 'Aster 02', capability: 'Basic life support', status: 'Available', location: 'South response base', eta: '—', crew: '2 members' },
];

export const hospitals = [
  { id: 'HSP-01', name: 'Suryodaya Medical Centre', type: 'Trauma centre · Level I', status: 'Receiving', distance: '4.2 km', beds: '12 / 18', contact: 'Emergency desk · Ext 201' },
  { id: 'HSP-02', name: 'Civic General Hospital', type: 'General hospital · Level II', status: 'Ready', distance: '6.8 km', beds: '24 / 32', contact: 'Emergency desk · Ext 114' },
  { id: 'HSP-03', name: 'Nirmal Heart Institute', type: 'Specialty cardiac', status: 'Ready', distance: '8.1 km', beds: '8 / 12', contact: 'Emergency desk · Ext 303' },
];

export const policeStations = [
  { id: 'PS-04', name: 'Sector 18 Police Station', type: 'Primary response', status: 'Available', distance: '1.1 km', unit: '5 patrol units' },
  { id: 'PS-01', name: 'Central City Station', type: 'District command', status: 'Available', distance: '2.7 km', unit: '8 patrol units' },
  { id: 'PS-07', name: 'East Gate Outpost', type: 'Local outpost', status: 'Busy', distance: '3.9 km', unit: '2 patrol units' },
];

export const responseTeams = [
  { id: 'RSP-04', name: 'Response 04', specialty: 'Trauma & extrication', lead: 'Vikram Singh', status: 'Deployed', location: 'NH-48, Sector 18', members: 4, readiness: 100 },
  { id: 'RSP-02', name: 'Response 02', specialty: 'Medical first response', lead: 'Sana Qureshi', status: 'On scene', location: 'Shanti Towers', members: 3, readiness: 100 },
  { id: 'RSP-01', name: 'Response 01', specialty: 'Fire & rescue', lead: 'Kabir Joshi', status: 'Available', location: 'West station', members: 5, readiness: 96 },
  { id: 'RSP-03', name: 'Response 03', specialty: 'Medical first response', lead: 'Arjun Menon', status: 'Available', location: 'Central base', members: 3, readiness: 98 },
  { id: 'RSP-05', name: 'Response 05', specialty: 'Search & welfare', lead: 'Ishita Roy', status: 'Off duty', location: 'South corridor', members: 4, readiness: 80 },
  { id: 'RSP-06', name: 'Response 06', specialty: 'Public safety', lead: 'Ananya Rao', status: 'Monitoring', location: 'Old market', members: 4, readiness: 92 },
];

export const notifications = [
  { id: 'N-1', title: 'Critical incident escalated', description: 'INC-2481 requires trauma support at NH-48.', time: '2 min ago', unread: true, tone: 'critical' },
  { id: 'N-2', title: 'Fleet readiness updated', description: 'PAT-03 moved to maintenance status.', time: '18 min ago', unread: true, tone: 'neutral' },
  { id: 'N-3', title: 'Hospital capacity note', description: 'Suryodaya Medical Centre has 6 open trauma beds.', time: '32 min ago', unread: false, tone: 'good' },
];

export const history = [
  { id: 'INC-2476', type: 'Lost person', location: 'Civic gardens, north gate', severity: 'Low', duration: '31 min', outcome: 'Resolved', closed: 'Today, 08:03' },
  { id: 'INC-2475', type: 'Road obstruction', location: 'Millers Road, junction 4', severity: 'Moderate', duration: '46 min', outcome: 'Resolved', closed: 'Today, 07:42' },
  { id: 'INC-2474', type: 'Medical emergency', location: 'Ridgeview apartments', severity: 'High', duration: '22 min', outcome: 'Transferred', closed: 'Yesterday, 21:18' },
  { id: 'INC-2473', type: 'Fire alarm', location: 'Orchid mall, parking level', severity: 'Moderate', duration: '18 min', outcome: 'False alarm', closed: 'Yesterday, 19:44' },
  { id: 'INC-2472', type: 'Public disturbance', location: 'Lake Road promenade', severity: 'Low', duration: '54 min', outcome: 'Resolved', closed: 'Yesterday, 18:26' },
];
