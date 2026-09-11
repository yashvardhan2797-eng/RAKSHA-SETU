export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type IncidentStatus = 'Responding' | 'Verification' | 'Monitoring' | 'Escalated' | 'Resolved' | 'Cancelled';

export type IncidentTimeline = { title: string; time: string; detail: string };

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
  vehicle?: string;
  driver?: string;
  riskScore?: number;
  detectionTime?: string;
  assignedTeam?: string;
  latitude?: string;
  longitude?: string;
  nearestAmbulance?: string;
  nearestHospital?: string;
  riskFactors?: string[];
  timeline?: IncidentTimeline[];
};

export type Vehicle = {
  id: string;
  registration: string;
  name: string;
  type: string;
  model: string;
  driver: string;
  deviceId: string;
  location: string;
  speed: string;
  battery: number;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  lastSeen: string;
  readiness: number;
  team: string;
  fuel: number;
  lastService: string;
  eta: string;
};

export type Driver = {
  id: string;
  name: string;
  initials: string;
  phone: string;
  role: string;
  status: 'ONLINE' | 'DRIVING' | 'OFF DUTY';
  safetyStatus: 'SAFE' | 'MONITORING' | 'CHECK REQUIRED';
  shift: string;
  vehicle: string;
  zone: string;
  lastActive: string;
  contact: string;
  hours: string;
};

export type Ambulance = {
  id: string;
  facility: string;
  capability: string;
  status: 'AVAILABLE' | 'DISPATCHED' | 'AT SCENE' | 'OFFLINE';
  location: string;
  eta: string;
  crew: string;
  assignedIncident: string;
};

export type Hospital = {
  id: string;
  name: string;
  location: string;
  type: string;
  status: 'READY' | 'RECEIVING' | 'FULL';
  distance: string;
  beds: string;
  contact: string;
};

export type PoliceStation = {
  id: string;
  name: string;
  location: string;
  type: string;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  distance: string;
  unit: string;
  contact: string;
};

export type ResponseTeam = {
  id: string;
  name: string;
  specialty: string;
  lead: string;
  status: 'AVAILABLE' | 'RESPONDING' | 'MONITORING' | 'OFF DUTY';
  location: string;
  members: number;
  readiness: number;
};

export const incidents: Incident[] = [
  {
    id: 'INC-2041', code: 'INC-2041', type: 'Possible crash', severity: 'Critical', status: 'Responding',
    location: 'NH-44, Jaipur Sector', zone: 'North corridor', reportedAt: '19:32', updatedAt: '19:36',
    caller: 'Crash Detection System', callerPhone: 'Vehicle telemetry', summary: 'Possible vehicle crash detected after a sudden deceleration. Driver verification has timed out and the vehicle remains stationary.',
    assignments: ['AMB-108', 'PAT-12'], responseMinutes: 4, vehicle: 'RJ14 AB 2041', driver: 'Raj Sharma', riskScore: 87,
    detectionTime: '19:32:10', assignedTeam: 'Team Alpha', latitude: '26.9124', longitude: '75.7873',
    nearestAmbulance: 'AMB-108', nearestHospital: 'City Emergency Hospital',
    riskFactors: ['Sudden deceleration', 'Abnormal vehicle orientation', 'No driver response', 'Vehicle stationary'],
    timeline: [
      { time: '19:32:10', title: 'Crash detected', detail: 'Crash Detection System signal received' },
      { time: '19:32:14', title: 'GPS location captured', detail: '26.9124, 75.7873' },
      { time: '19:32:20', title: 'Driver verification requested', detail: 'Secure driver prompt sent locally' },
      { time: '19:32:38', title: 'No response', detail: 'Verification window expired' },
      { time: '19:32:40', title: 'Emergency escalation triggered', detail: 'Response workflow started in demo mode' },
    ],
  },
  {
    id: 'INC-2042', code: 'INC-2042', type: 'SOS', severity: 'High', status: 'Verification',
    location: 'Ajmer Road', zone: 'West corridor', reportedAt: '19:28', updatedAt: '19:31',
    caller: 'Amit Verma', callerPhone: '+91 98••• 2014', summary: 'SOS button activated from a moving vehicle. Operator is attempting driver verification.',
    assignments: [], responseMinutes: 3, vehicle: 'RJ14 CD 5521', driver: 'Amit Verma', riskScore: 74,
    detectionTime: '19:28:06', latitude: '26.8867', longitude: '75.7514', riskFactors: ['SOS activation', 'Driver verification pending'],
  },
  {
    id: 'INC-2043', code: 'INC-2043', type: 'Hard braking', severity: 'Medium', status: 'Monitoring',
    location: 'Tonk Road', zone: 'South corridor', reportedAt: '19:21', updatedAt: '19:25',
    caller: 'Road safety sensor', callerPhone: 'Telemetry event', summary: 'Hard braking event detected. Vehicle resumed movement after a short stop.',
    assignments: ['PAT-03'], responseMinutes: 4, vehicle: 'RJ14 EF 8830', driver: 'Neha Joshi', riskScore: 48,
    detectionTime: '19:21:44', latitude: '26.8475', longitude: '75.8046', riskFactors: ['Hard braking', 'Short roadside stop'],
  },
  {
    id: 'INC-2044', code: 'INC-2044', type: 'Medical emergency', severity: 'High', status: 'Responding',
    location: 'MI Road, Civil Lines', zone: 'Central district', reportedAt: '19:05', updatedAt: '19:14',
    caller: 'Meera Shah', callerPhone: '+91 97••• 1038', summary: 'Unresponsive adult at a commercial building. Security is waiting at the lobby entrance.',
    assignments: ['AMB-103', 'RSP-02'], responseMinutes: 9, vehicle: 'AMB-103', driver: 'Sana Qureshi', riskScore: 79,
    detectionTime: '19:05:12', assignedTeam: 'Team Bravo', nearestAmbulance: 'AMB-103', nearestHospital: 'City Emergency Hospital',
    riskFactors: ['Unresponsive patient', 'Indoor access required'],
  },
  {
    id: 'INC-2045', code: 'INC-2045', type: 'Fire alarm', severity: 'Medium', status: 'Monitoring',
    location: 'C-Scheme, Tower 4', zone: 'Central district', reportedAt: '18:54', updatedAt: '19:07',
    caller: 'Automated panel', callerPhone: 'Control panel', summary: 'Alarm triggered on level 6. Evacuation underway; no visible smoke reported.',
    assignments: ['FIR-109', 'RSP-01'], responseMinutes: 13, riskScore: 54, detectionTime: '18:54:23',
    riskFactors: ['Alarm activation', 'Multi-floor occupancy'],
  },
  {
    id: 'INC-2046', code: 'INC-2046', type: 'Road obstruction', severity: 'Medium', status: 'Responding',
    location: 'Mansarovar Link Road', zone: 'South corridor', reportedAt: '18:41', updatedAt: '18:49',
    caller: 'Traffic control', callerPhone: 'Desk 02', summary: 'Stalled freight vehicle is blocking two lanes. Diversion is in progress.',
    assignments: ['PAT-08'], responseMinutes: 8, riskScore: 42, detectionTime: '18:41:12',
    riskFactors: ['Two lanes blocked', 'Traffic queue forming'],
  },
  {
    id: 'INC-2047', code: 'INC-2047', type: 'Structural hazard', severity: 'High', status: 'Monitoring',
    location: 'Old market, Gate 2', zone: 'East district', reportedAt: '18:18', updatedAt: '18:38',
    caller: 'Rohan Das', callerPhone: '+91 99••• 2284', summary: 'Falling facade debris after overnight rain. Crowd moved behind a barricade.',
    assignments: ['PAT-06', 'RSP-06'], responseMinutes: 20, riskScore: 72, detectionTime: '18:18:40',
    riskFactors: ['Unstable facade', 'Pedestrian exposure'],
  },
  {
    id: 'INC-2048', code: 'INC-2048', type: 'Waterlogging', severity: 'Low', status: 'Monitoring',
    location: 'Lake Road underpass', zone: 'East corridor', reportedAt: '17:54', updatedAt: '18:21',
    caller: 'Traffic control', callerPhone: 'Desk 04', summary: 'Road surface submerged by 20cm. Traffic diverted to service lane.',
    assignments: ['PAT-03'], responseMinutes: 27, riskScore: 28, detectionTime: '17:54:01',
    riskFactors: ['Reduced road visibility'],
  },
  {
    id: 'INC-2049', code: 'INC-2049', type: 'Vehicle breakdown', severity: 'Low', status: 'Resolved',
    location: 'Delhi Road, mile 12', zone: 'North corridor', reportedAt: '17:32', updatedAt: '17:59',
    caller: 'Fleet telemetry', callerPhone: 'Telemetry event', summary: 'Vehicle safely moved to the shoulder and recovery support confirmed.',
    assignments: ['PAT-04'], responseMinutes: 27, riskScore: 18, detectionTime: '17:32:18',
    riskFactors: ['Shoulder obstruction'],
  },
  {
    id: 'INC-2050', code: 'INC-2050', type: 'Lost person', severity: 'Low', status: 'Resolved',
    location: 'Central Park, north gate', zone: 'Central district', reportedAt: '17:12', updatedAt: '17:43',
    caller: 'Nisha Kapoor', callerPhone: '+91 96••• 7802', summary: 'Child reunited with family by park security.',
    assignments: ['RSP-05'], responseMinutes: 31, riskScore: 15, detectionTime: '17:12:07',
    riskFactors: ['Minor involved'],
  },
];

export const vehicles: Vehicle[] = [
  { id: 'VH-001', registration: 'RJ14AB2041', name: 'Aster 07', type: 'SUV', model: 'Mahindra XUV700', driver: 'Raj Sharma', deviceId: 'DEV-7701', location: 'Jaipur Sector', speed: '64 km/h', battery: 82, status: 'ONLINE', lastSeen: '12 sec ago', readiness: 96, team: 'Team Alpha', fuel: 72, lastService: '12 Jun 2024', eta: '04 min' },
  { id: 'VH-002', registration: 'RJ14CD5521', name: 'Aster 03', type: 'SUV', model: 'Tata Safari', driver: 'Amit Verma', deviceId: 'DEV-7702', location: 'Ajmer Road', speed: '48 km/h', battery: 76, status: 'ONLINE', lastSeen: '18 sec ago', readiness: 91, team: 'Team Bravo', fuel: 58, lastService: '29 May 2024', eta: '08 min' },
  { id: 'VH-003', registration: 'RJ14EF8830', name: 'Sentinel 12', type: 'Patrol vehicle', model: 'Toyota Innova', driver: 'Neha Joshi', deviceId: 'DEV-7703', location: 'Tonk Road', speed: '0 km/h', battery: 91, status: 'ONLINE', lastSeen: '24 sec ago', readiness: 88, team: 'Patrol Alpha', fuel: 64, lastService: '05 Jun 2024', eta: 'On scene' },
  { id: 'VH-004', registration: 'RJ14GH1109', name: 'Sentinel 06', type: 'Patrol vehicle', model: 'Maruti Ertiga', driver: 'Ananya Rao', deviceId: 'DEV-7704', location: 'East district station', speed: '0 km/h', battery: 97, status: 'ONLINE', lastSeen: '31 sec ago', readiness: 100, team: 'Patrol Bravo', fuel: 89, lastService: '18 Jun 2024', eta: 'Ready' },
  { id: 'VH-005', registration: 'RJ14JK4309', name: 'Ember 09', type: 'Fire response unit', model: 'Tata LPT', driver: 'Kabir Joshi', deviceId: 'DEV-7705', location: 'West station bay 2', speed: '0 km/h', battery: 88, status: 'ONLINE', lastSeen: '42 sec ago', readiness: 94, team: 'Fire Alpha', fuel: 81, lastService: '10 Jun 2024', eta: 'Ready' },
  { id: 'VH-006', registration: 'RJ14LM2003', name: 'Sentinel 03', type: 'Patrol vehicle', model: 'Mahindra Bolero', driver: 'Unassigned', deviceId: 'DEV-7706', location: 'Fleet workshop', speed: '0 km/h', battery: 32, status: 'MAINTENANCE', lastSeen: '18 min ago', readiness: 41, team: '—', fuel: 32, lastService: '19 Jun 2024', eta: '18 Jun' },
  { id: 'VH-007', registration: 'RJ14NP8811', name: 'Aster 11', type: 'SUV', model: 'Force Traveller', driver: 'Arjun Menon', deviceId: 'DEV-7707', location: 'Central ambulance base', speed: '0 km/h', battery: 93, status: 'ONLINE', lastSeen: '08 sec ago', readiness: 98, team: 'Team Charlie', fuel: 93, lastService: '16 Jun 2024', eta: 'Ready' },
  { id: 'VH-008', registration: 'DL01AA4201', name: 'Sentinel 18', type: 'Patrol vehicle', model: 'Toyota Innova', driver: 'Priya Nair', deviceId: 'DEV-7708', location: 'Delhi Road', speed: '52 km/h', battery: 68, status: 'ONLINE', lastSeen: '44 sec ago', readiness: 86, team: 'Patrol Alpha', fuel: 61, lastService: '14 Jun 2024', eta: '12 min' },
  { id: 'VH-009', registration: 'MH12BX9908', name: 'Aster 14', type: 'Ambulance', model: 'Force Traveller', driver: 'Sameer Khan', deviceId: 'DEV-7709', location: 'Mumbai response base', speed: '0 km/h', battery: 84, status: 'ONLINE', lastSeen: '26 sec ago', readiness: 90, team: 'Team Delta', fuel: 77, lastService: '11 Jun 2024', eta: 'Ready' },
  { id: 'VH-010', registration: 'KA01MN3188', name: 'Sentinel 22', type: 'Patrol vehicle', model: 'Mahindra Scorpio', driver: 'Vivek Rao', deviceId: 'DEV-7710', location: 'Bengaluru east', speed: '0 km/h', battery: 0, status: 'OFFLINE', lastSeen: '2 hr ago', readiness: 0, team: 'Patrol Charlie', fuel: 45, lastService: '01 Jun 2024', eta: 'Offline' },
];

export const drivers: Driver[] = [
  { id: 'DRV-104', name: 'Raj Sharma', initials: 'RS', phone: '+91 98••• 4421', role: 'Critical care driver', status: 'DRIVING', safetyStatus: 'CHECK REQUIRED', shift: '06:00 — 14:00', vehicle: 'VH-001', zone: 'Jaipur Sector', lastActive: '12 sec ago', contact: '+91 98••• 4421', hours: '05h 49m' },
  { id: 'DRV-118', name: 'Amit Verma', initials: 'AV', phone: '+91 98••• 2014', role: 'Response driver', status: 'DRIVING', safetyStatus: 'MONITORING', shift: '06:00 — 14:00', vehicle: 'VH-002', zone: 'Ajmer Road', lastActive: '18 sec ago', contact: '+91 98••• 2014', hours: '05h 36m' },
  { id: 'DRV-087', name: 'Neha Joshi', initials: 'NJ', phone: '+91 97••• 2289', role: 'Response driver', status: 'ONLINE', safetyStatus: 'SAFE', shift: '07:00 — 15:00', vehicle: 'VH-003', zone: 'Tonk Road', lastActive: '24 sec ago', contact: '+91 97••• 2289', hours: '04h 49m' },
  { id: 'DRV-091', name: 'Ananya Rao', initials: 'AR', phone: '+91 96••• 4410', role: 'Patrol driver', status: 'ONLINE', safetyStatus: 'SAFE', shift: '06:00 — 14:00', vehicle: 'VH-004', zone: 'East district', lastActive: '31 sec ago', contact: '+91 96••• 4410', hours: '05h 12m' },
  { id: 'DRV-076', name: 'Kabir Joshi', initials: 'KJ', phone: '+91 98••• 9012', role: 'Fire unit driver', status: 'ONLINE', safetyStatus: 'SAFE', shift: '06:00 — 14:00', vehicle: 'VH-005', zone: 'West district', lastActive: '42 sec ago', contact: '+91 98••• 9012', hours: '05h 31m' },
  { id: 'DRV-112', name: 'Arjun Menon', initials: 'AM', phone: '+91 99••• 6742', role: 'Critical care driver', status: 'ONLINE', safetyStatus: 'SAFE', shift: '08:00 — 16:00', vehicle: 'VH-007', zone: 'Central district', lastActive: '08 sec ago', contact: '+91 99••• 6742', hours: '01h 49m' },
  { id: 'DRV-065', name: 'Priya Nair', initials: 'PN', phone: '+91 97••• 1732', role: 'Response driver', status: 'ONLINE', safetyStatus: 'SAFE', shift: '08:00 — 16:00', vehicle: 'VH-008', zone: 'Delhi Road', lastActive: '44 sec ago', contact: '+91 97••• 1732', hours: '01h 44m' },
  { id: 'DRV-049', name: 'Sameer Khan', initials: 'SK', phone: '+91 99••• 6308', role: 'Paramedic driver', status: 'ONLINE', safetyStatus: 'SAFE', shift: '08:00 — 16:00', vehicle: 'VH-009', zone: 'Mumbai', lastActive: '26 sec ago', contact: '+91 99••• 6308', hours: '01h 26m' },
  { id: 'DRV-031', name: 'Vivek Rao', initials: 'VR', phone: '+91 95••• 3118', role: 'Patrol driver', status: 'OFF DUTY', safetyStatus: 'SAFE', shift: '14:00 — 22:00', vehicle: 'VH-010', zone: 'Bengaluru', lastActive: '2 hr ago', contact: '+91 95••• 3118', hours: '—' },
  { id: 'DRV-022', name: 'Sana Qureshi', initials: 'SQ', phone: '+91 99••• 5814', role: 'Paramedic driver', status: 'ONLINE', safetyStatus: 'SAFE', shift: '10:00 — 18:00', vehicle: 'AMB-103', zone: 'Central district', lastActive: '1 min ago', contact: '+91 99••• 5814', hours: '00h 58m' },
];

export const ambulances: Ambulance[] = [
  { id: 'AMB-108', facility: 'Aster 108', capability: 'Advanced life support', status: 'DISPATCHED', location: 'NH-44, Jaipur Sector', eta: '04 min', crew: '3 members', assignedIncident: 'INC-2041' },
  { id: 'AMB-103', facility: 'Aster 103', capability: 'Basic life support', status: 'AT SCENE', location: 'MI Road, Civil Lines', eta: 'On scene', crew: '2 members', assignedIncident: 'INC-2044' },
  { id: 'AMB-111', facility: 'Aster 111', capability: 'Advanced life support', status: 'AVAILABLE', location: 'Central ambulance base', eta: '—', crew: '3 members', assignedIncident: '—' },
  { id: 'AMB-102', facility: 'Aster 102', capability: 'Basic life support', status: 'AVAILABLE', location: 'South response base', eta: '—', crew: '2 members', assignedIncident: '—' },
  { id: 'AMB-115', facility: 'Aster 115', capability: 'Neonatal support', status: 'AVAILABLE', location: 'Jaipur east base', eta: '—', crew: '3 members', assignedIncident: '—' },
  { id: 'AMB-119', facility: 'Aster 119', capability: 'Basic life support', status: 'OFFLINE', location: 'Fleet workshop', eta: 'Offline', crew: '2 members', assignedIncident: '—' },
];

export const hospitals: Hospital[] = [
  { id: 'HSP-01', name: 'City Emergency Hospital', location: 'Jaipur Central', type: 'Trauma centre · Level I', status: 'RECEIVING', distance: '4.2 km', beds: '12 / 18', contact: 'Emergency desk · Ext 201' },
  { id: 'HSP-02', name: 'Suryodaya Medical Centre', location: 'C-Scheme, Jaipur', type: 'General hospital · Level II', status: 'READY', distance: '6.8 km', beds: '24 / 32', contact: 'Emergency desk · Ext 114' },
  { id: 'HSP-03', name: 'Nirmal Heart Institute', location: 'Malviya Nagar', type: 'Specialty cardiac', status: 'READY', distance: '8.1 km', beds: '8 / 12', contact: 'Emergency desk · Ext 303' },
  { id: 'HSP-04', name: 'Apex Care Hospital', location: 'Mansarovar', type: 'Trauma centre · Level II', status: 'READY', distance: '9.4 km', beds: '15 / 24', contact: 'Emergency desk · Ext 404' },
  { id: 'HSP-05', name: 'Metro Life Sciences', location: 'Ajmer Road', type: 'General hospital · Level II', status: 'FULL', distance: '10.2 km', beds: '0 / 20', contact: 'Emergency desk · Ext 510' },
];

export const policeStations: PoliceStation[] = [
  { id: 'PS-04', name: 'Sector 18 Police Station', location: 'Jaipur Sector', type: 'Primary response', status: 'AVAILABLE', distance: '1.1 km', unit: '5 patrol units', contact: 'Control room · 100' },
  { id: 'PS-01', name: 'Central City Station', location: 'MI Road', type: 'District command', status: 'AVAILABLE', distance: '2.7 km', unit: '8 patrol units', contact: 'Control room · 100' },
  { id: 'PS-07', name: 'East Gate Outpost', location: 'Old market', type: 'Local outpost', status: 'BUSY', distance: '3.9 km', unit: '2 patrol units', contact: 'Desk · 100' },
  { id: 'PS-09', name: 'Mansarovar Station', location: 'Mansarovar Link Road', type: 'Primary response', status: 'AVAILABLE', distance: '4.5 km', unit: '6 patrol units', contact: 'Control room · 100' },
  { id: 'PS-12', name: 'Ajmer Road Unit', location: 'Ajmer Road', type: 'Traffic response', status: 'AVAILABLE', distance: '5.2 km', unit: '4 patrol units', contact: 'Traffic desk · 103' },
];

export const responseTeams: ResponseTeam[] = [
  { id: 'RSP-01', name: 'Team Alpha', specialty: 'Trauma & extrication', lead: 'Vikram Singh', status: 'RESPONDING', location: 'NH-44, Jaipur Sector', members: 4, readiness: 100 },
  { id: 'RSP-02', name: 'Team Bravo', specialty: 'Medical first response', lead: 'Sana Qureshi', status: 'RESPONDING', location: 'MI Road, Civil Lines', members: 3, readiness: 100 },
  { id: 'RSP-03', name: 'Team Charlie', specialty: 'Fire & rescue', lead: 'Kabir Joshi', status: 'AVAILABLE', location: 'West station', members: 5, readiness: 96 },
  { id: 'RSP-04', name: 'Team Delta', specialty: 'Medical first response', lead: 'Arjun Menon', status: 'AVAILABLE', location: 'Central base', members: 3, readiness: 98 },
  { id: 'RSP-05', name: 'Team Echo', specialty: 'Search & welfare', lead: 'Ishita Roy', status: 'OFF DUTY', location: 'South corridor', members: 4, readiness: 80 },
  { id: 'RSP-06', name: 'Team Foxtrot', specialty: 'Public safety', lead: 'Ananya Rao', status: 'MONITORING', location: 'Old market', members: 4, readiness: 92 },
];

export type Notification = { id: string; title: string; description: string; time: string; unread: boolean; tone: 'critical' | 'warning' | 'info' | 'good' };

export const notifications: Notification[] = [
  { id: 'N-1', title: 'Critical crash detected', description: 'INC-2041 requires immediate response at NH-44.', time: '2 min ago', unread: true, tone: 'critical' },
  { id: 'N-2', title: 'Driver verification timeout', description: 'INC-2042 is waiting for a verification decision.', time: '4 min ago', unread: true, tone: 'warning' },
  { id: 'N-3', title: 'Ambulance assigned', description: 'AMB-108 assigned to INC-2041.', time: '6 min ago', unread: false, tone: 'info' },
  { id: 'N-4', title: 'Incident resolved', description: 'INC-2049 was closed by the response desk.', time: '12 min ago', unread: false, tone: 'good' },
];

export type HistoryItem = {
  id: string; date: string; location: string; type: string; severity: Severity; responseTime: string; status: 'RESOLVED' | 'CANCELLED' | 'TRANSFERRED';
};

export const history: HistoryItem[] = [
  { id: 'INC-2050', date: '04 Sep 2026', location: 'Central Park, north gate', type: 'Lost person', severity: 'Low', responseTime: '31 min', status: 'RESOLVED' },
  { id: 'INC-2049', date: '04 Sep 2026', location: 'Delhi Road, mile 12', type: 'Vehicle breakdown', severity: 'Low', responseTime: '27 min', status: 'RESOLVED' },
  { id: 'INC-2044', date: '03 Sep 2026', location: 'MI Road, Civil Lines', type: 'Medical emergency', severity: 'High', responseTime: '22 min', status: 'TRANSFERRED' },
  { id: 'INC-2038', date: '03 Sep 2026', location: 'Orchid mall, parking level', type: 'Fire alarm', severity: 'Medium', responseTime: '18 min', status: 'CANCELLED' },
  { id: 'INC-2032', date: '02 Sep 2026', location: 'Lake Road promenade', type: 'Public disturbance', severity: 'Low', responseTime: '54 min', status: 'RESOLVED' },
  { id: 'INC-2027', date: '01 Sep 2026', location: 'Mumbai east freeway', type: 'Possible crash', severity: 'Critical', responseTime: '08 min', status: 'TRANSFERRED' },
  { id: 'INC-2021', date: '31 Aug 2026', location: 'Bengaluru ring road', type: 'Hard braking', severity: 'Medium', responseTime: '12 min', status: 'RESOLVED' },
  { id: 'INC-2018', date: '30 Aug 2026', location: 'Hyderabad bypass', type: 'SOS', severity: 'High', responseTime: '10 min', status: 'RESOLVED' },
];

export const analyticsData = {
  incidentsByDay: [24, 31, 27, 38, 34, 42, 36],
  responseTime: [10.4, 9.7, 9.2, 8.8, 8.5, 8.1, 8.7],
  severity: [
    { label: 'Critical', value: 18, color: '#c92f35' },
    { label: 'High', value: 31, color: '#d97706' },
    { label: 'Medium', value: 36, color: '#d4a72c' },
    { label: 'Low', value: 15, color: '#1675a8' },
  ],
  incidentTypes: [
    { label: 'Medical', value: 38, color: '#c92f35' },
    { label: 'Road safety', value: 27, color: '#0e7d8b' },
    { label: 'Fire & hazard', value: 19, color: '#d97706' },
    { label: 'Public safety', value: 16, color: '#2d8a61' },
  ],
  performance: [82, 88, 79, 91, 87],
};