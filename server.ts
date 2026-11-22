import express from 'express';
import fs from 'fs';
import path from 'path';
import type {
  GigiriWeather,
  HourlyForecastItem,
  IrrigationLog,
  IrrigationSchedule,
  IrrigationZone,
  SystemState,
} from './src/types/irrigation.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'gigiri-irrigation.json');

const DEFAULT_ZONE_AGRONOMY: Record<
  string,
  {
    kc: number;
    rootDepthMm: number;
    fieldCapacityPct: number;
    wiltingPointPct: number;
    nominalFlowLpm: number;
    nominalPressureBar: number;
    sensorBatteryPct: number;
  }
> = {
  'zone-un-avenue': {
    kc: 0.85,
    rootDepthMm: 260,
    fieldCapacityPct: 34,
    wiltingPointPct: 16,
    nominalFlowLpm: 94,
    nominalPressureBar: 2.8,
    sensorBatteryPct: 92,
  },
  'zone-karura-edge': {
    kc: 0.78,
    rootDepthMm: 520,
    fieldCapacityPct: 38,
    wiltingPointPct: 17,
    nominalFlowLpm: 76,
    nominalPressureBar: 2.2,
    sensorBatteryPct: 88,
  },
  'zone-limuru-compound': {
    kc: 0.88,
    rootDepthMm: 240,
    fieldCapacityPct: 32,
    wiltingPointPct: 15,
    nominalFlowLpm: 88,
    nominalPressureBar: 2.7,
    sensorBatteryPct: 95,
  },
  'zone-gigiri-kitchen': {
    kc: 1.05,
    rootDepthMm: 210,
    fieldCapacityPct: 40,
    wiltingPointPct: 18,
    nominalFlowLpm: 48,
    nominalPressureBar: 1.6,
    sensorBatteryPct: 84,
  },
  'zone-redhill-orchard': {
    kc: 0.72,
    rootDepthMm: 680,
    fieldCapacityPct: 31,
    wiltingPointPct: 14,
    nominalFlowLpm: 64,
    nominalPressureBar: 2.1,
    sensorBatteryPct: 91,
  },
  'zone-rosslyn-nursery': {
    kc: 0.95,
    rootDepthMm: 180,
    fieldCapacityPct: 45,
    wiltingPointPct: 20,
    nominalFlowLpm: 38,
    nominalPressureBar: 3.1,
    sensorBatteryPct: 79,
  },
};

function getNairobiDayName(date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi',
    weekday: 'short',
  }).format(date);
}

function getNairobiDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getNairobiTimeHHMM(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh}:${mm}`;
}

function getZoneDefaultFlow(emitterType: string): { flow: number; pressure: number } {
  const lower = emitterType.toLowerCase();
  if (lower.includes('rotor') || lower.includes('spray')) {
    return { flow: 92, pressure: 2.8 };
  }
  if (lower.includes('bubbler')) {
    return { flow: 64, pressure: 2.1 };
  }
  if (lower.includes('fogger') || lower.includes('mist')) {
    return { flow: 38, pressure: 3.1 };
  }
  return { flow: 54, pressure: 1.7 };
}

function createSeedState(): SystemState {
  const now = new Date();
  const isoNow = now.toISOString();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();
  const hoursAhead = (h: number) => new Date(now.getTime() + h * 3600 * 1000).toISOString();

  return {
    district: 'Gigiri, Nairobi',
    elevationMeters: 1720,
    coordinates: '1.2325° S, 36.8058° E',
    rainHoldActive: false,
    rainHoldUntil: null,
    emergencyStop: false,
    todayCostKes: 412,
    lastTickAt: isoNow,
    sources: [
      {
        id: 'src-borehole-a',
        name: 'Borehole A (180m Deep Aquifer)',
        type: 'borehole',
        capacityLiters: 90000,
        currentLiters: 74200,
        flowCapacityLpm: 280,
        status: 'active',
        pumpPowerKw: 7.5,
        costPerCubicMeterKes: 42,
        rationWindow: 'Continuous (Solar + KPLC Grid)',
        notes: 'Primary estate aquifer supply feeding elevated steel header tank.',
      },
      {
        id: 'src-rainwater',
        name: 'Rainwater Harvesting Cisterns',
        type: 'rainwater',
        capacityLiters: 120000,
        currentLiters: 96400,
        flowCapacityLpm: 210,
        status: 'active',
        pumpPowerKw: 3.0,
        costPerCubicMeterKes: 12,
        rationWindow: 'Priority Drawdown (Short Rains)',
        notes: 'Underground masonry cisterns capturing compound roof runoff via first-flush filters.',
      },
      {
        id: 'src-borehole-b',
        name: 'Borehole B (Solar Reserve)',
        type: 'borehole',
        capacityLiters: 45000,
        currentLiters: 38900,
        flowCapacityLpm: 165,
        status: 'standby',
        pumpPowerKw: 4.2,
        costPerCubicMeterKes: 28,
        rationWindow: 'Daylight Solar Peak (07:30–16:30)',
        notes: 'Dedicated to Redhill Ridge Orchard and Buffer Nursery.',
      },
      {
        id: 'src-ncwsc',
        name: 'NCWSC Municipal Feed',
        type: 'municipal',
        capacityLiters: 35000,
        currentLiters: 19500,
        flowCapacityLpm: 120,
        status: 'rationed',
        pumpPowerKw: 1.5,
        costPerCubicMeterKes: 118,
        rationWindow: 'Tue / Thu / Sat (05:00–11:00)',
        notes: 'Nairobi City Water supplemental buffer; reserved for potable backup and nursery misting.',
      },
    ],
    zones: [
      {
        id: 'zone-un-avenue',
        name: 'UN Avenue Botanical Grounds',
        sector: 'Sector 1 · UN Avenue Frontage',
        areaHa: 1.8,
        cropType: 'Kikuyu Turf & Fever Tree Canopy',
        soilType: 'Humic Nitisol (Red Kikuyu Loam)',
        emitterType: 'Subsurface Drip + Pop-up Rotors',
        ...DEFAULT_ZONE_AGRONOMY['zone-un-avenue'],
        moisturePct: 28.4,
        targetMinPct: 24,
        targetMaxPct: 34,
        status: 'irrigating',
        valveOpen: true,
        flowRateLpm: 94,
        pressureBar: 2.8,
        activeSourceId: 'src-rainwater',
        lastIrrigatedAt: isoNow,
        lastCalibratedAt: hoursAgo(72),
        nextRunAt: hoursAhead(14),
        remainingMin: 22,
        runDurationMin: 35,
        todayLiters: 3290,
        mapCoords: { x: 70, y: 60, w: 230, h: 145 },
      },
      {
        id: 'zone-karura-edge',
        name: 'Karura Perimeter Arboretum',
        sector: 'Sector 2 · Forest Boundary',
        areaHa: 2.4,
        cropType: 'Indigenous Croton, Podocarpus & Olea',
        soilType: 'Forest Humus over Red Loam',
        emitterType: 'Pressure-Compensating Drip Ring',
        ...DEFAULT_ZONE_AGRONOMY['zone-karura-edge'],
        moisturePct: 33.8,
        targetMinPct: 26,
        targetMaxPct: 38,
        status: 'idle',
        valveOpen: false,
        flowRateLpm: 0,
        pressureBar: 0.2,
        activeSourceId: 'src-rainwater',
        lastIrrigatedAt: hoursAgo(9),
        lastCalibratedAt: hoursAgo(96),
        nextRunAt: hoursAhead(11),
        remainingMin: 0,
        runDurationMin: 40,
        todayLiters: 4120,
        mapCoords: { x: 330, y: 50, w: 250, h: 160 },
      },
      {
        id: 'zone-limuru-compound',
        name: 'Limuru Road Diplomatic Lawn',
        sector: 'Sector 3 · Limuru Rd West',
        areaHa: 1.1,
        cropType: 'Ornamental Hedges & Paspalum Lawn',
        soilType: 'Humic Nitisol (Red Kikuyu Loam)',
        emitterType: 'MP Rotator Micro-Sprays',
        ...DEFAULT_ZONE_AGRONOMY['zone-limuru-compound'],
        moisturePct: 20.6,
        targetMinPct: 24,
        targetMaxPct: 32,
        status: 'scheduled',
        valveOpen: false,
        flowRateLpm: 0,
        pressureBar: 0.1,
        activeSourceId: 'src-borehole-a',
        lastIrrigatedAt: hoursAgo(26),
        lastCalibratedAt: hoursAgo(48),
        nextRunAt: hoursAhead(2),
        remainingMin: 0,
        runDurationMin: 30,
        todayLiters: 0,
        mapCoords: { x: 70, y: 235, w: 205, h: 145 },
      },
      {
        id: 'zone-gigiri-kitchen',
        name: 'Gigiri Close Kitchen & Herb Plot',
        sector: 'Sector 4 · Central Terrace',
        areaHa: 0.45,
        cropType: 'Sukuma Wiki, Spinach, Rosemary & Hass Avocado',
        soilType: 'Amended Compost Red Loam',
        emitterType: '16mm Inline Drip Tape (20cm spacing)',
        ...DEFAULT_ZONE_AGRONOMY['zone-gigiri-kitchen'],
        moisturePct: 31.2,
        targetMinPct: 30,
        targetMaxPct: 40,
        status: 'irrigating',
        valveOpen: true,
        flowRateLpm: 48,
        pressureBar: 1.6,
        activeSourceId: 'src-rainwater',
        lastIrrigatedAt: isoNow,
        lastCalibratedAt: hoursAgo(36),
        nextRunAt: hoursAhead(12),
        remainingMin: 14,
        runDurationMin: 25,
        todayLiters: 1180,
        mapCoords: { x: 305, y: 240, w: 175, h: 135 },
      },
      {
        id: 'zone-redhill-orchard',
        name: 'Redhill Ridge Orchard',
        sector: 'Sector 5 · North Slope',
        areaHa: 1.6,
        cropType: 'Macadamia, Grafted Mango & Citrus',
        soilType: 'Well-Drained Upland Clay Loam',
        emitterType: '8 L/hr Adjustable Bubbler Stakes',
        ...DEFAULT_ZONE_AGRONOMY['zone-redhill-orchard'],
        moisturePct: 25.1,
        targetMinPct: 22,
        targetMaxPct: 30,
        status: 'idle',
        valveOpen: false,
        flowRateLpm: 0,
        pressureBar: 0.1,
        activeSourceId: 'src-borehole-b',
        lastIrrigatedAt: hoursAgo(16),
        lastCalibratedAt: hoursAgo(120),
        nextRunAt: hoursAhead(18),
        remainingMin: 0,
        runDurationMin: 45,
        todayLiters: 2640,
        mapCoords: { x: 510, y: 235, w: 210, h: 145 },
      },
      {
        id: 'zone-rosslyn-nursery',
        name: 'Rosslyn-Gigiri Buffer Nursery',
        sector: 'Sector 6 · Shadehouse Block',
        areaHa: 0.75,
        cropType: 'Indigenous Seedlings & Cuttings',
        soilType: 'Coco-Pumice Propagation Media',
        emitterType: 'Overhead Fogger & Micro-Mist',
        ...DEFAULT_ZONE_AGRONOMY['zone-rosslyn-nursery'],
        moisturePct: 37.5,
        targetMinPct: 35,
        targetMaxPct: 45,
        status: 'maintenance',
        valveOpen: false,
        flowRateLpm: 0,
        pressureBar: 0.0,
        activeSourceId: 'src-ncwsc',
        lastIrrigatedAt: hoursAgo(7),
        lastCalibratedAt: hoursAgo(24),
        nextRunAt: hoursAhead(24),
        remainingMin: 0,
        runDurationMin: 15,
        todayLiters: 920,
        mapCoords: { x: 605, y: 55, w: 150, h: 150 },
      },
    ],
    schedules: [
      {
        id: 'sch-1',
        zoneId: 'zone-un-avenue',
        label: 'Early Dawn Lawn & Canopy Cycle',
        days: ['Mon', 'Wed', 'Fri', 'Sun'],
        startTime: '05:30',
        durationMin: 35,
        waterSourceId: 'src-rainwater',
        enabled: true,
        skipOnRainMm: 4,
        moistureCutoffPct: 33,
      },
      {
        id: 'sch-2',
        zoneId: 'zone-karura-edge',
        label: 'Forest Perimeter Deep Root Soak',
        days: ['Tue', 'Thu', 'Sat'],
        startTime: '04:45',
        durationMin: 40,
        waterSourceId: 'src-rainwater',
        enabled: true,
        skipOnRainMm: 5,
        moistureCutoffPct: 37,
      },
      {
        id: 'sch-3',
        zoneId: 'zone-limuru-compound',
        label: 'Limuru West Evening Micro-Spray',
        days: ['Mon', 'Tue', 'Thu', 'Sat'],
        startTime: '17:45',
        durationMin: 30,
        waterSourceId: 'src-borehole-a',
        enabled: true,
        skipOnRainMm: 3,
        moistureCutoffPct: 31,
      },
      {
        id: 'sch-4',
        zoneId: 'zone-gigiri-kitchen',
        label: 'Kitchen Plot Morning Drip Pulse',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startTime: '06:15',
        durationMin: 25,
        waterSourceId: 'src-rainwater',
        enabled: true,
        skipOnRainMm: 3,
        moistureCutoffPct: 39,
      },
      {
        id: 'sch-5',
        zoneId: 'zone-redhill-orchard',
        label: 'Solar Peak Orchard Bubbler Run',
        days: ['Mon', 'Thu'],
        startTime: '10:30',
        durationMin: 45,
        waterSourceId: 'src-borehole-b',
        enabled: true,
        skipOnRainMm: 6,
        moistureCutoffPct: 29,
      },
      {
        id: 'sch-6',
        zoneId: 'zone-rosslyn-nursery',
        label: 'Shadehouse Mist (NCWSC Ration Sync)',
        days: ['Tue', 'Thu', 'Sat'],
        startTime: '06:45',
        durationMin: 15,
        waterSourceId: 'src-ncwsc',
        enabled: false,
        skipOnRainMm: 8,
        moistureCutoffPct: 44,
      },
    ],
    logs: [
      {
        id: 'log-101',
        timestamp: hoursAgo(0.2),
        zoneId: 'zone-un-avenue',
        zoneName: 'UN Avenue Botanical Grounds',
        eventType: 'manual_start',
        litersUsed: 1220,
        durationMin: 35,
        sourceName: 'Rainwater Harvesting Cisterns',
        note: 'Started morning root-zone cycle prior to peak sun',
      },
      {
        id: 'log-102',
        timestamp: hoursAgo(0.4),
        zoneId: 'zone-gigiri-kitchen',
        zoneName: 'Gigiri Close Kitchen & Herb Plot',
        eventType: 'manual_start',
        litersUsed: 528,
        durationMin: 25,
        sourceName: 'Rainwater Harvesting Cisterns',
        note: 'Scheduled drip pulse active at 1.6 bar',
      },
      {
        id: 'log-103',
        timestamp: hoursAgo(5),
        zoneId: 'zone-rosslyn-nursery',
        zoneName: 'Rosslyn-Gigiri Buffer Nursery',
        eventType: 'alert',
        litersUsed: 0,
        durationMin: 0,
        sourceName: 'NCWSC Municipal Feed',
        note: 'Pressure drop on manifold B; nozzle screen descaling scheduled',
      },
      {
        id: 'log-104',
        timestamp: hoursAgo(9),
        zoneId: 'zone-karura-edge',
        zoneName: 'Karura Perimeter Arboretum',
        eventType: 'cycle_complete',
        litersUsed: 4120,
        durationMin: 40,
        sourceName: 'Rainwater Harvesting Cisterns',
        note: 'Soil VWC increased from 29.1% to 33.8%',
      },
      {
        id: 'log-105',
        timestamp: hoursAgo(16),
        zoneId: 'zone-redhill-orchard',
        zoneName: 'Redhill Ridge Orchard',
        eventType: 'cycle_complete',
        litersUsed: 2640,
        durationMin: 45,
        sourceName: 'Borehole B (Solar Reserve)',
        note: 'Solar-direct cycle completed; zero grid draw',
      },
      {
        id: 'log-106',
        timestamp: hoursAgo(28),
        zoneId: 'zone-limuru-compound',
        zoneName: 'Limuru Road Diplomatic Lawn',
        eventType: 'rain_skip',
        litersUsed: 0,
        durationMin: 0,
        sourceName: 'Borehole A (180m Deep Aquifer)',
        note: 'Skipped automated run: 6.4 mm evening shower recorded in Gigiri',
      },
      {
        id: 'log-107',
        timestamp: hoursAgo(38),
        zoneId: 'zone-karura-edge',
        zoneName: 'Karura Perimeter Arboretum',
        eventType: 'moisture_skip',
        litersUsed: 0,
        durationMin: 0,
        sourceName: 'Rainwater Harvesting Cisterns',
        note: 'Skipped: topsoil moisture at 37.2% (cutoff 37.0%)',
      },
    ],
    dailyBalance: [
      { day: 'Mon', boreholeLiters: 5400, rainwaterLiters: 8900, municipalLiters: 900, etLossMm: 3.9 },
      { day: 'Tue', boreholeLiters: 4200, rainwaterLiters: 9600, municipalLiters: 1450, etLossMm: 4.1 },
      { day: 'Wed', boreholeLiters: 6100, rainwaterLiters: 7400, municipalLiters: 0, etLossMm: 4.4 },
      { day: 'Thu', boreholeLiters: 3100, rainwaterLiters: 11200, municipalLiters: 1100, etLossMm: 3.2 },
      { day: 'Fri', boreholeLiters: 4900, rainwaterLiters: 8300, municipalLiters: 0, etLossMm: 3.8 },
      { day: 'Sat', boreholeLiters: 3600, rainwaterLiters: 10100, municipalLiters: 1320, etLossMm: 3.5 },
      { day: 'Sun', boreholeLiters: 2640, rainwaterLiters: 8590, municipalLiters: 920, etLossMm: 3.7 },
    ],
  };
}

function migrateState(raw: SystemState): SystemState {
  const nowIso = new Date().toISOString();
  if (typeof raw.todayCostKes !== 'number') {
    raw.todayCostKes = 412;
  }
  raw.zones = raw.zones.map((z) => {
    const defaults = DEFAULT_ZONE_AGRONOMY[z.id];
    const flowSpec = getZoneDefaultFlow(z.emitterType);
    return {
      ...z,
      kc: typeof z.kc === 'number' ? z.kc : (defaults?.kc ?? 0.85),
      rootDepthMm: typeof z.rootDepthMm === 'number' ? z.rootDepthMm : (defaults?.rootDepthMm ?? 300),
      fieldCapacityPct:
        typeof z.fieldCapacityPct === 'number'
          ? z.fieldCapacityPct
          : (defaults?.fieldCapacityPct ?? z.targetMaxPct),
      wiltingPointPct:
        typeof z.wiltingPointPct === 'number'
          ? z.wiltingPointPct
          : (defaults?.wiltingPointPct ?? 15),
      nominalFlowLpm:
        typeof z.nominalFlowLpm === 'number'
          ? z.nominalFlowLpm
          : (defaults?.nominalFlowLpm ?? flowSpec.flow),
      nominalPressureBar:
        typeof z.nominalPressureBar === 'number'
          ? z.nominalPressureBar
          : (defaults?.nominalPressureBar ?? flowSpec.pressure),
      sensorBatteryPct:
        typeof z.sensorBatteryPct === 'number'
          ? z.sensorBatteryPct
          : (defaults?.sensorBatteryPct ?? 90),
      lastCalibratedAt: z.lastCalibratedAt || nowIso,
    };
  });
  return raw;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveState(state: SystemState): void {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function loadState(): SystemState {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) {
    const initial = createSeedState();
    saveState(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = migrateState(JSON.parse(raw) as SystemState);
    return syncSimulation(parsed);
  } catch {
    const fallback = createSeedState();
    saveState(fallback);
    return fallback;
  }
}

function recordWaterMix(state: SystemState, sourceId: string, liters: number): void {
  if (liters <= 0) return;
  const src = state.sources.find((s) => s.id === sourceId);
  if (!src) return;

  src.currentLiters = Math.max(0, src.currentLiters - liters);
  const costDelta = (liters / 1000) * src.costPerCubicMeterKes;
  state.todayCostKes = Number((state.todayCostKes + costDelta).toFixed(2));

  const todayName = getNairobiDayName();
  const bar = state.dailyBalance.find((d) => d.day === todayName);
  if (bar) {
    if (src.type === 'rainwater') bar.rainwaterLiters += liters;
    else if (src.type === 'municipal') bar.municipalLiters += liters;
    else bar.boreholeLiters += liters;
  }
}

function syncSimulation(state: SystemState): SystemState {
  const now = Date.now();
  const prev = new Date(state.lastTickAt).getTime();
  const elapsedMin = Math.max(0, (now - prev) / 60000);

  if (elapsedMin < 0.05) {
    return state;
  }

  let changed = false;

  if (state.rainHoldActive && state.rainHoldUntil) {
    if (now >= new Date(state.rainHoldUntil).getTime()) {
      state.rainHoldActive = false;
      state.rainHoldUntil = null;
      changed = true;
    }
  }

  for (const zone of state.zones) {
    if (zone.valveOpen && zone.status === 'irrigating') {
      const stepMin = Math.min(elapsedMin, zone.remainingMin);
      if (stepMin > 0) {
        const liters = Math.round(stepMin * zone.flowRateLpm);
        zone.todayLiters += liters;
        // Physical soil infiltration model: applied depth mm / rootDepthMm
        const depthMm = liters / Math.max(500, zone.areaHa * 10000);
        const deltaVwc = (depthMm / Math.max(120, zone.rootDepthMm)) * 100 * 1.4;
        zone.moisturePct = Number(
          Math.min(zone.fieldCapacityPct + 2, zone.moisturePct + Math.max(stepMin * 0.12, deltaVwc)).toFixed(1)
        );
        zone.remainingMin = Math.max(0, Number((zone.remainingMin - stepMin).toFixed(1)));
        recordWaterMix(state, zone.activeSourceId, liters);
        changed = true;
      }

      if (zone.remainingMin <= 0.05) {
        zone.valveOpen = false;
        zone.status = 'idle';
        zone.flowRateLpm = 0;
        zone.pressureBar = 0.2;
        zone.remainingMin = 0;
        zone.lastIrrigatedAt = new Date(now).toISOString();

        const src = state.sources.find((s) => s.id === zone.activeSourceId);
        const totalCycleLiters = Math.round(zone.runDurationMin * zone.nominalFlowLpm);
        const logEntry: IrrigationLog = {
          id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: new Date(now).toISOString(),
          zoneId: zone.id,
          zoneName: zone.name,
          eventType: 'cycle_complete',
          litersUsed: totalCycleLiters,
          durationMin: zone.runDurationMin,
          sourceName: src ? src.name : 'Primary Manifold',
          note: `Cycle finished cleanly; soil moisture at ${zone.moisturePct}% VWC`,
        };
        state.logs.unshift(logEntry);
        state.logs = state.logs.slice(0, 100);
        changed = true;
      }
    } else if (zone.status !== 'maintenance' && elapsedMin >= 5) {
      const dryLoss = Math.min(0.4, elapsedMin * 0.008);
      if (dryLoss >= 0.05) {
        zone.moisturePct = Number(Math.max(12, zone.moisturePct - dryLoss).toFixed(1));
        changed = true;
      }
    }
  }

  // Evaluate automated schedules due in Africa/Nairobi EAT
  if (!state.emergencyStop && !state.rainHoldActive) {
    const todayName = getNairobiDayName(new Date(now));
    const todayKey = getNairobiDateKey(new Date(now));
    const nowHHMM = getNairobiTimeHHMM(new Date(now));
    const todayWeatherRainMm = cachedWeather?.data.current.rainMm ?? 0;

    for (const sch of state.schedules) {
      if (!sch.enabled) continue;
      if (!sch.days.includes(todayName)) continue;
      if (sch.lastTriggeredDate === todayKey) continue;

      // Trigger if scheduled startTime is within the last 10 minutes
      const [sh, sm] = sch.startTime.split(':').map(Number);
      const [nh, nm] = nowHHMM.split(':').map(Number);
      const schMin = sh * 60 + sm;
      const nowMin = nh * 60 + nm;
      if (nowMin >= schMin && nowMin - schMin <= 10) {
        const zone = state.zones.find((z) => z.id === sch.zoneId);
        if (!zone || zone.status === 'maintenance' || zone.valveOpen) continue;

        sch.lastTriggeredDate = todayKey;
        const src = state.sources.find((s) => s.id === sch.waterSourceId);

        if (todayWeatherRainMm >= sch.skipOnRainMm) {
          state.logs.unshift({
            id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date(now).toISOString(),
            zoneId: zone.id,
            zoneName: zone.name,
            eventType: 'rain_skip',
            litersUsed: 0,
            durationMin: 0,
            sourceName: src ? src.name : 'Primary Manifold',
            note: `Auto-skipped "${sch.label}": Gigiri rain ${todayWeatherRainMm} mm ≥ ${sch.skipOnRainMm} mm threshold`,
          });
          changed = true;
        } else if (zone.moisturePct >= sch.moistureCutoffPct) {
          state.logs.unshift({
            id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date(now).toISOString(),
            zoneId: zone.id,
            zoneName: zone.name,
            eventType: 'moisture_skip',
            litersUsed: 0,
            durationMin: 0,
            sourceName: src ? src.name : 'Primary Manifold',
            note: `Auto-skipped "${sch.label}": moisture ${zone.moisturePct}% ≥ ${sch.moistureCutoffPct}% cutoff`,
          });
          changed = true;
        } else {
          zone.activeSourceId = sch.waterSourceId;
          zone.valveOpen = true;
          zone.status = 'irrigating';
          zone.flowRateLpm = zone.nominalFlowLpm;
          zone.pressureBar = zone.nominalPressureBar;
          zone.runDurationMin = sch.durationMin;
          zone.remainingMin = sch.durationMin;
          zone.lastIrrigatedAt = new Date(now).toISOString();
          state.logs.unshift({
            id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date(now).toISOString(),
            zoneId: zone.id,
            zoneName: zone.name,
            eventType: 'manual_start',
            litersUsed: 0,
            durationMin: sch.durationMin,
            sourceName: src ? src.name : 'Primary Manifold',
            note: `Scheduled rule "${sch.label}" opened valve for ${sch.durationMin} min`,
          });
          changed = true;
        }
      }
    }
  }

  state.logs = state.logs.slice(0, 100);
  state.lastTickAt = new Date(now).toISOString();
  if (changed) {
    saveState(state);
  }
  return state;
}

let cachedWeather: { expiresAt: number; data: GigiriWeather } | null = null;

function buildFallbackWeather(): GigiriWeather {
  const today = new Date();
  const days = Array.from({ length: 5 }, (_, idx) => {
    const d = new Date(today.getTime() + idx * 86400000);
    const precip = [2.4, 6.8, 1.2, 0.0, 4.5][idx];
    return {
      date: d.toISOString().slice(0, 10),
      tempMaxC: [23.8, 22.4, 24.5, 25.1, 23.2][idx],
      tempMinC: [13.6, 13.9, 13.1, 12.8, 13.4][idx],
      precipMm: precip,
      et0Mm: [3.7, 3.1, 4.1, 4.4, 3.5][idx],
      precipProbPct: [45, 72, 30, 15, 60][idx],
    };
  });

  const hourly: HourlyForecastItem[] = Array.from({ length: 12 }, (_, idx) => {
    const hour = (idx * 2) % 24;
    const hStr = `${String(hour).padStart(2, '0')}:00`;
    const isAfternoon = hour >= 12 && hour <= 18;
    const isMidday = hour >= 10 && hour <= 15;
    return {
      time: hStr,
      hourLabel: hStr,
      tempC: isMidday ? 23.4 : isAfternoon ? 21.8 : 15.2,
      precipProbPct: isAfternoon ? 55 : 15,
      precipMm: hour === 16 ? 1.8 : hour === 18 ? 0.6 : 0,
      et0Mm: isMidday ? 0.52 : hour >= 8 && hour <= 17 ? 0.28 : 0.04,
    };
  });

  return {
    location: 'Gigiri, Nairobi (1,720m ASL)',
    coordinates: '-1.2325, 36.8058',
    fetchedAt: new Date().toISOString(),
    source: 'seasonal-model',
    current: {
      temperatureC: 21.6,
      humidityPct: 64,
      rainMm: 0.4,
      windKmh: 11.2,
      et0MmDay: 3.7,
      seasonNote: 'Short Rains transition — mild highland afternoon cloud cover near Karura Forest.',
    },
    hourly,
    forecast: days,
  };
}

async function fetchGigiriWeather(): Promise<GigiriWeather> {
  if (cachedWeather && Date.now() < cachedWeather.expiresAt) {
    return cachedWeather.data;
  }

  try {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=-1.2325&longitude=36.8058&current=temperature_2m,relative_humidity_2m,rain,wind_speed_10m&hourly=temperature_2m,precipitation_probability,precipitation,et0_fao_evapotranspiration&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration&timezone=Africa%2FNairobi&forecast_days=5';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const json = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
        rain?: number;
        wind_speed_10m?: number;
      };
      hourly?: {
        time?: string[];
        temperature_2m?: number[];
        precipitation_probability?: number[];
        precipitation?: number[];
        et0_fao_evapotranspiration?: number[];
      };
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_sum?: number[];
        precipitation_probability_max?: number[];
        et0_fao_evapotranspiration?: number[];
      };
    };

    const dailyTimes = json.daily?.time ?? [];
    const forecast = dailyTimes.map((date, idx) => ({
      date,
      tempMaxC: Number((json.daily?.temperature_2m_max?.[idx] ?? 24).toFixed(1)),
      tempMinC: Number((json.daily?.temperature_2m_min?.[idx] ?? 13).toFixed(1)),
      precipMm: Number((json.daily?.precipitation_sum?.[idx] ?? 0).toFixed(1)),
      et0Mm: Number((json.daily?.et0_fao_evapotranspiration?.[idx] ?? 3.8).toFixed(1)),
      precipProbPct: Math.round(json.daily?.precipitation_probability_max?.[idx] ?? 25),
    }));

    const hourlyTimes = json.hourly?.time ?? [];
    const nowHourKey = `${getNairobiDateKey()}T${getNairobiTimeHHMM().slice(0, 2)}`;
    const startIdx = Math.max(
      0,
      hourlyTimes.findIndex((t) => t.startsWith(nowHourKey))
    );
    const hourly: HourlyForecastItem[] = hourlyTimes
      .slice(startIdx, startIdx + 24)
      .filter((_, idx) => idx % 2 === 0)
      .map((t, stepIdx) => {
        const i = startIdx + stepIdx * 2;
        return {
          time: t,
          hourLabel: t.slice(11, 16),
          tempC: Number((json.hourly?.temperature_2m?.[i] ?? 21).toFixed(1)),
          precipProbPct: Math.round(json.hourly?.precipitation_probability?.[i] ?? 15),
          precipMm: Number((json.hourly?.precipitation?.[i] ?? 0).toFixed(1)),
          et0Mm: Number((json.hourly?.et0_fao_evapotranspiration?.[i] ?? 0.2).toFixed(2)),
        };
      });

    const todayEt0 = forecast[0]?.et0Mm ?? 3.8;
    const todayRain = json.current?.rain ?? 0;
    const humidity = Math.round(json.current?.relative_humidity_2m ?? 60);

    let seasonNote = 'Nominal highland ET₀ demand; morning drip cycles advised before 08:30 EAT.';
    if (todayRain >= 2 || (forecast[0]?.precipMm ?? 0) >= 5) {
      seasonNote = 'Gigiri rainfall expected today — rainwater cisterns harvesting; rain-skip guards armed.';
    } else if (todayEt0 >= 4.3) {
      seasonNote = 'Elevated afternoon evapotranspiration on exposed Limuru Rd & Redhill slopes.';
    }

    const weather: GigiriWeather = {
      location: 'Gigiri, Nairobi (1,720m ASL)',
      coordinates: '-1.2325, 36.8058',
      fetchedAt: new Date().toISOString(),
      source: 'open-meteo',
      current: {
        temperatureC: Number((json.current?.temperature_2m ?? 22).toFixed(1)),
        humidityPct: humidity,
        rainMm: Number(todayRain.toFixed(1)),
        windKmh: Number((json.current?.wind_speed_10m ?? 10).toFixed(1)),
        et0MmDay: todayEt0,
        seasonNote,
      },
      hourly,
      forecast,
    };

    cachedWeather = { expiresAt: Date.now() + 15 * 60 * 1000, data: weather };
    return weather;
  } catch {
    const fallback = buildFallbackWeather();
    cachedWeather = { expiresAt: Date.now() + 5 * 60 * 1000, data: fallback };
    return fallback;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/state', (_req, res) => {
    const state = loadState();
    res.json(state);
  });

  app.get('/api/weather', async (_req, res) => {
    const weather = await fetchGigiriWeather();
    res.json(weather);
  });

  app.post('/api/zones/:id/toggle', (req, res) => {
    const state = loadState();
    const zone = state.zones.find((z) => z.id === req.params.id);
    if (!zone) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }

    const body = (req.body ?? {}) as {
      action?: 'start' | 'stop';
      durationMin?: number;
      sourceId?: string;
    };

    if (zone.status === 'maintenance') {
      res.status(400).json({ error: 'Zone is currently locked for maintenance.' });
      return;
    }

    const wantStart = body.action ? body.action === 'start' : !zone.valveOpen;

    if (wantStart) {
      if (state.emergencyStop) {
        res.status(400).json({ error: 'Master valve shutoff is active. Reset Emergency Stop first.' });
        return;
      }
      if (state.rainHoldActive) {
        res.status(400).json({ error: 'District Rain Hold is active. Clear Rain Hold to irrigate manually.' });
        return;
      }

      const duration = Math.min(120, Math.max(5, Number(body.durationMin) || zone.runDurationMin || 25));
      if (body.sourceId && state.sources.some((s) => s.id === body.sourceId)) {
        zone.activeSourceId = body.sourceId;
      }

      zone.valveOpen = true;
      zone.status = 'irrigating';
      zone.flowRateLpm = zone.nominalFlowLpm;
      zone.pressureBar = zone.nominalPressureBar;
      zone.runDurationMin = duration;
      zone.remainingMin = duration;
      zone.lastIrrigatedAt = new Date().toISOString();

      const src = state.sources.find((s) => s.id === zone.activeSourceId);
      state.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        zoneId: zone.id,
        zoneName: zone.name,
        eventType: 'manual_start',
        litersUsed: 0,
        durationMin: duration,
        sourceName: src ? src.name : 'Primary Manifold',
        note: `Manual ${duration}-min cycle initiated via ${zone.emitterType}`,
      });
    } else {
      const ranMin = Math.max(1, Math.round(zone.runDurationMin - zone.remainingMin));
      const estLiters = Math.round(ranMin * zone.flowRateLpm);
      zone.valveOpen = false;
      zone.status = 'idle';
      zone.flowRateLpm = 0;
      zone.pressureBar = 0.2;
      zone.remainingMin = 0;

      const src = state.sources.find((s) => s.id === zone.activeSourceId);
      state.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        zoneId: zone.id,
        zoneName: zone.name,
        eventType: 'manual_stop',
        litersUsed: estLiters,
        durationMin: ranMin,
        sourceName: src ? src.name : 'Primary Manifold',
        note: `Valve closed manually after ${ranMin} min`,
      });
    }

    state.logs = state.logs.slice(0, 100);
    saveState(state);
    res.json(state);
  });

  app.post('/api/zones', (req, res) => {
    const state = loadState();
    const body = (req.body ?? {}) as Partial<IrrigationZone>;

    if (!body.name || !body.sector || !body.cropType) {
      res.status(400).json({ error: 'Zone name, sector, and crop type are required.' });
      return;
    }

    const idx = state.zones.length;
    const emitter = body.emitterType?.trim() || 'Pressure-Compensating Drip';
    const flowSpec = getZoneDefaultFlow(emitter);

    const newZone: IrrigationZone = {
      id: `zone-${Date.now()}`,
      name: body.name.trim(),
      sector: body.sector.trim(),
      areaHa: Number(body.areaHa) || 0.8,
      cropType: body.cropType.trim(),
      soilType: body.soilType?.trim() || 'Humic Nitisol (Red Kikuyu Loam)',
      emitterType: emitter,
      kc: Number(body.kc) || 0.85,
      rootDepthMm: Number(body.rootDepthMm) || 300,
      fieldCapacityPct: Number(body.targetMaxPct) || 34,
      wiltingPointPct: 15,
      moisturePct: Number(body.moisturePct) || 26.5,
      targetMinPct: Number(body.targetMinPct) || 22,
      targetMaxPct: Number(body.targetMaxPct) || 34,
      status: 'idle',
      valveOpen: false,
      flowRateLpm: 0,
      nominalFlowLpm: Number(body.nominalFlowLpm) || flowSpec.flow,
      pressureBar: 0.2,
      nominalPressureBar: flowSpec.pressure,
      sensorBatteryPct: 100,
      activeSourceId: body.activeSourceId || state.sources[0]?.id || 'src-borehole-a',
      lastIrrigatedAt: new Date(Date.now() - 86400000).toISOString(),
      lastCalibratedAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() + 14 * 3600000).toISOString(),
      remainingMin: 0,
      runDurationMin: Number(body.runDurationMin) || 30,
      todayLiters: 0,
      mapCoords: {
        x: 70 + ((idx % 3) * 235),
        y: 60 + Math.floor(idx / 3) * 175,
        w: 210,
        h: 140,
      },
    };

    state.zones.push(newZone);
    state.logs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      zoneId: newZone.id,
      zoneName: newZone.name,
      eventType: 'alert',
      litersUsed: 0,
      durationMin: 0,
      sourceName: state.sources.find((s) => s.id === newZone.activeSourceId)?.name || 'Borehole A',
      note: `Commissioned new Gigiri irrigation sector (${newZone.areaHa} ha · Kc ${newZone.kc})`,
    });

    saveState(state);
    res.status(201).json(state);
  });

  app.patch('/api/zones/:id', (req, res) => {
    const state = loadState();
    const zone = state.zones.find((z) => z.id === req.params.id);
    if (!zone) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }

    const body = (req.body ?? {}) as Partial<IrrigationZone>;
    if (typeof body.name === 'string' && body.name.trim()) zone.name = body.name.trim();
    if (typeof body.cropType === 'string' && body.cropType.trim()) zone.cropType = body.cropType.trim();
    if (typeof body.areaHa === 'number' && body.areaHa > 0) zone.areaHa = body.areaHa;
    if (typeof body.kc === 'number' && body.kc > 0.2) zone.kc = Number(body.kc.toFixed(2));
    if (typeof body.rootDepthMm === 'number' && body.rootDepthMm >= 80) zone.rootDepthMm = body.rootDepthMm;
    if (typeof body.nominalFlowLpm === 'number' && body.nominalFlowLpm >= 10) {
      zone.nominalFlowLpm = body.nominalFlowLpm;
      if (zone.valveOpen) zone.flowRateLpm = body.nominalFlowLpm;
    }
    if (typeof body.targetMinPct === 'number') zone.targetMinPct = body.targetMinPct;
    if (typeof body.targetMaxPct === 'number') {
      zone.targetMaxPct = body.targetMaxPct;
      zone.fieldCapacityPct = body.targetMaxPct;
    }
    if (typeof body.moisturePct === 'number') {
      zone.moisturePct = Number(body.moisturePct.toFixed(1));
      zone.lastCalibratedAt = new Date().toISOString();
    }
    if (typeof body.activeSourceId === 'string') zone.activeSourceId = body.activeSourceId;
    if (typeof body.emitterType === 'string') zone.emitterType = body.emitterType;
    if (typeof body.runDurationMin === 'number') zone.runDurationMin = body.runDurationMin;

    if (body.status === 'maintenance') {
      zone.status = 'maintenance';
      zone.valveOpen = false;
      zone.flowRateLpm = 0;
      zone.pressureBar = 0;
      zone.remainingMin = 0;
    } else if (body.status === 'idle' && zone.status === 'maintenance') {
      zone.status = 'idle';
      zone.pressureBar = 0.2;
    }

    saveState(state);
    res.json(state);
  });

  app.delete('/api/zones/:id', (req, res) => {
    const state = loadState();
    const target = state.zones.find((z) => z.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }
    state.zones = state.zones.filter((z) => z.id !== req.params.id);
    state.schedules = state.schedules.filter((s) => s.zoneId !== req.params.id);
    state.logs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      zoneId: target.id,
      zoneName: target.name,
      eventType: 'alert',
      litersUsed: 0,
      durationMin: 0,
      sourceName: 'District Controller',
      note: `Decommissioned sector "${target.name}" and removed linked schedules`,
    });
    saveState(state);
    res.json(state);
  });

  app.post('/api/schedules', (req, res) => {
    const state = loadState();
    const body = (req.body ?? {}) as Partial<IrrigationSchedule>;
    if (!body.zoneId || !body.label || !body.startTime || !Array.isArray(body.days) || body.days.length === 0) {
      res.status(400).json({ error: 'Zone, label, start time, and at least one day are required.' });
      return;
    }

    const newSchedule: IrrigationSchedule = {
      id: `sch-${Date.now()}`,
      zoneId: body.zoneId,
      label: body.label.trim(),
      days: body.days,
      startTime: body.startTime,
      durationMin: Number(body.durationMin) || 30,
      waterSourceId: body.waterSourceId || 'src-rainwater',
      enabled: body.enabled ?? true,
      skipOnRainMm: Number(body.skipOnRainMm) || 4,
      moistureCutoffPct: Number(body.moistureCutoffPct) || 34,
    };

    state.schedules.unshift(newSchedule);
    saveState(state);
    res.status(201).json(state);
  });

  app.patch('/api/schedules/:id', (req, res) => {
    const state = loadState();
    const schedule = state.schedules.find((s) => s.id === req.params.id);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    const body = (req.body ?? {}) as Partial<IrrigationSchedule>;
    if (typeof body.label === 'string' && body.label.trim()) schedule.label = body.label.trim();
    if (typeof body.zoneId === 'string') schedule.zoneId = body.zoneId;
    if (typeof body.enabled === 'boolean') schedule.enabled = body.enabled;
    if (typeof body.durationMin === 'number') schedule.durationMin = body.durationMin;
    if (typeof body.startTime === 'string') schedule.startTime = body.startTime;
    if (Array.isArray(body.days) && body.days.length > 0) schedule.days = body.days;
    if (typeof body.skipOnRainMm === 'number') schedule.skipOnRainMm = body.skipOnRainMm;
    if (typeof body.moistureCutoffPct === 'number') schedule.moistureCutoffPct = body.moistureCutoffPct;
    if (typeof body.waterSourceId === 'string') schedule.waterSourceId = body.waterSourceId;

    saveState(state);
    res.json(state);
  });

  app.post('/api/schedules/:id/evaluate', async (req, res) => {
    const state = loadState();
    const sch = state.schedules.find((s) => s.id === req.params.id);
    if (!sch) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    const zone = state.zones.find((z) => z.id === sch.zoneId);
    if (!zone) {
      res.status(404).json({ error: 'Target zone not found' });
      return;
    }
    if (state.emergencyStop || state.rainHoldActive) {
      res.status(400).json({ error: 'Cannot evaluate schedule while Master Shutoff or Rain Hold is active.' });
      return;
    }
    if (zone.status === 'maintenance') {
      res.status(400).json({ error: `${zone.name} is locked for maintenance.` });
      return;
    }

    const weather = await fetchGigiriWeather();
    const todayRainMm = Math.max(weather.current.rainMm, weather.forecast[0]?.precipMm ?? 0);
    const src = state.sources.find((s) => s.id === sch.waterSourceId);
    let outcome = 'started';

    if (todayRainMm >= sch.skipOnRainMm) {
      outcome = 'rain_skip';
      state.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        zoneId: zone.id,
        zoneName: zone.name,
        eventType: 'rain_skip',
        litersUsed: 0,
        durationMin: 0,
        sourceName: src ? src.name : 'Primary Manifold',
        note: `Guard skipped "${sch.label}": Gigiri rainfall (${todayRainMm} mm) ≥ ${sch.skipOnRainMm} mm limit`,
      });
    } else if (zone.moisturePct >= sch.moistureCutoffPct) {
      outcome = 'moisture_skip';
      state.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        zoneId: zone.id,
        zoneName: zone.name,
        eventType: 'moisture_skip',
        litersUsed: 0,
        durationMin: 0,
        sourceName: src ? src.name : 'Primary Manifold',
        note: `Guard skipped "${sch.label}": VWC (${zone.moisturePct}%) ≥ ${sch.moistureCutoffPct}% cutoff`,
      });
    } else {
      zone.activeSourceId = sch.waterSourceId;
      zone.valveOpen = true;
      zone.status = 'irrigating';
      zone.flowRateLpm = zone.nominalFlowLpm;
      zone.pressureBar = zone.nominalPressureBar;
      zone.runDurationMin = sch.durationMin;
      zone.remainingMin = sch.durationMin;
      zone.lastIrrigatedAt = new Date().toISOString();
      state.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        zoneId: zone.id,
        zoneName: zone.name,
        eventType: 'manual_start',
        litersUsed: 0,
        durationMin: sch.durationMin,
        sourceName: src ? src.name : 'Primary Manifold',
        note: `Executed "${sch.label}" (${sch.durationMin} min) after passing rain & VWC guards`,
      });
    }

    state.logs = state.logs.slice(0, 100);
    saveState(state);
    res.json({ outcome, state });
  });

  app.delete('/api/schedules/:id', (req, res) => {
    const state = loadState();
    state.schedules = state.schedules.filter((s) => s.id !== req.params.id);
    saveState(state);
    res.json(state);
  });

  app.patch('/api/sources/:id', (req, res) => {
    const state = loadState();
    const source = state.sources.find((s) => s.id === req.params.id);
    if (!source) {
      res.status(404).json({ error: 'Water source not found' });
      return;
    }

    const body = (req.body ?? {}) as {
      addLiters?: number;
      currentLiters?: number;
      status?: 'active' | 'standby' | 'rationed' | 'maintenance';
    };

    if (typeof body.addLiters === 'number' && body.addLiters !== 0) {
      const next = Math.min(source.capacityLiters, Math.max(0, source.currentLiters + body.addLiters));
      const delta = next - source.currentLiters;
      source.currentLiters = next;
      state.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        zoneId: 'system',
        zoneName: 'District Storage',
        eventType: 'refill',
        litersUsed: Math.abs(delta),
        durationMin: 0,
        sourceName: source.name,
        note: `Logged +${delta.toLocaleString()} L tank replenishment / harvest`,
      });
    }

    if (typeof body.currentLiters === 'number') {
      source.currentLiters = Math.min(source.capacityLiters, Math.max(0, body.currentLiters));
    }

    if (body.status) {
      source.status = body.status;
    }

    saveState(state);
    res.json(state);
  });

  app.post('/api/system/rain-hold', (req, res) => {
    const state = loadState();
    const body = (req.body ?? {}) as { active?: boolean; hours?: number };
    const nextActive = typeof body.active === 'boolean' ? body.active : !state.rainHoldActive;

    state.rainHoldActive = nextActive;
    if (nextActive) {
      const hours = Number(body.hours) || 24;
      state.rainHoldUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      for (const z of state.zones) {
        if (z.valveOpen) {
          z.valveOpen = false;
          z.status = 'idle';
          z.flowRateLpm = 0;
          z.pressureBar = 0.2;
          z.remainingMin = 0;
        }
      }
      state.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        zoneId: 'system',
        zoneName: 'All Gigiri Sectors',
        eventType: 'rain_skip',
        litersUsed: 0,
        durationMin: 0,
        sourceName: 'District Controller',
        note: `Rain Hold activated for ${hours} hours; all open valves paused`,
      });
    } else {
      state.rainHoldUntil = null;
      state.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        zoneId: 'system',
        zoneName: 'All Gigiri Sectors',
        eventType: 'alert',
        litersUsed: 0,
        durationMin: 0,
        sourceName: 'District Controller',
        note: 'Rain Hold cleared; automated schedules resumed',
      });
    }

    saveState(state);
    res.json(state);
  });

  app.post('/api/system/emergency-stop', (req, res) => {
    const state = loadState();
    const body = (req.body ?? {}) as { active?: boolean };
    const nextStop = typeof body.active === 'boolean' ? body.active : !state.emergencyStop;
    state.emergencyStop = nextStop;

    if (nextStop) {
      for (const z of state.zones) {
        if (z.valveOpen) {
          z.valveOpen = false;
          z.status = 'idle';
          z.flowRateLpm = 0;
          z.pressureBar = 0;
          z.remainingMin = 0;
        }
      }
      state.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        zoneId: 'system',
        zoneName: 'Master Manifold',
        eventType: 'alert',
        litersUsed: 0,
        durationMin: 0,
        sourceName: 'Master Shutoff Valve',
        note: 'Master valve shutoff engaged — all district solenoids closed',
      });
    } else {
      state.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        zoneId: 'system',
        zoneName: 'Master Manifold',
        eventType: 'alert',
        litersUsed: 0,
        durationMin: 0,
        sourceName: 'Master Shutoff Valve',
        note: 'Master shutoff cleared — manifold pressurized and ready',
      });
    }

    saveState(state);
    res.json(state);
  });

  app.post('/api/system/reset', (_req, res) => {
    const fresh = createSeedState();
    saveState(fresh);
    res.json(fresh);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Karura Flow irrigation server listening on http://localhost:${PORT}`);
  });
}

startServer();
