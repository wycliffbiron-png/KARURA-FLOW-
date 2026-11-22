export type ZoneStatus = 'irrigating' | 'idle' | 'scheduled' | 'maintenance';
export type WaterSourceType = 'borehole' | 'rainwater' | 'municipal';
export type WaterSourceStatus = 'active' | 'standby' | 'rationed' | 'maintenance';
export type LogEventType =
  | 'cycle_complete'
  | 'manual_start'
  | 'manual_stop'
  | 'rain_skip'
  | 'moisture_skip'
  | 'alert'
  | 'refill';

export interface ZoneMapCoords {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface IrrigationZone {
  id: string;
  name: string;
  sector: string;
  areaHa: number;
  cropType: string;
  soilType: string;
  emitterType: string;
  kc: number;
  rootDepthMm: number;
  fieldCapacityPct: number;
  wiltingPointPct: number;
  moisturePct: number;
  targetMinPct: number;
  targetMaxPct: number;
  status: ZoneStatus;
  valveOpen: boolean;
  flowRateLpm: number;
  nominalFlowLpm: number;
  pressureBar: number;
  nominalPressureBar: number;
  sensorBatteryPct: number;
  activeSourceId: string;
  lastIrrigatedAt: string;
  lastCalibratedAt: string;
  nextRunAt: string;
  remainingMin: number;
  runDurationMin: number;
  todayLiters: number;
  mapCoords: ZoneMapCoords;
}

export interface WaterSource {
  id: string;
  name: string;
  type: WaterSourceType;
  capacityLiters: number;
  currentLiters: number;
  flowCapacityLpm: number;
  status: WaterSourceStatus;
  pumpPowerKw: number;
  costPerCubicMeterKes: number;
  rationWindow: string;
  notes: string;
}

export interface IrrigationSchedule {
  id: string;
  zoneId: string;
  label: string;
  days: string[];
  startTime: string;
  durationMin: number;
  waterSourceId: string;
  enabled: boolean;
  skipOnRainMm: number;
  moistureCutoffPct: number;
  lastTriggeredDate?: string;
}

export interface IrrigationLog {
  id: string;
  timestamp: string;
  zoneId: string;
  zoneName: string;
  eventType: LogEventType;
  litersUsed: number;
  durationMin: number;
  sourceName: string;
  note: string;
}

export interface DailyWaterBalance {
  day: string;
  boreholeLiters: number;
  rainwaterLiters: number;
  municipalLiters: number;
  etLossMm: number;
}

export interface SystemState {
  district: string;
  elevationMeters: number;
  coordinates: string;
  rainHoldActive: boolean;
  rainHoldUntil: string | null;
  emergencyStop: boolean;
  todayCostKes: number;
  lastTickAt: string;
  zones: IrrigationZone[];
  sources: WaterSource[];
  schedules: IrrigationSchedule[];
  logs: IrrigationLog[];
  dailyBalance: DailyWaterBalance[];
}

export interface DailyForecastItem {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipMm: number;
  et0Mm: number;
  precipProbPct: number;
}

export interface HourlyForecastItem {
  time: string;
  hourLabel: string;
  tempC: number;
  precipProbPct: number;
  precipMm: number;
  et0Mm: number;
}

export interface GigiriWeather {
  location: string;
  coordinates: string;
  fetchedAt: string;
  source: 'open-meteo' | 'seasonal-model';
  current: {
    temperatureC: number;
    humidityPct: number;
    rainMm: number;
    windKmh: number;
    et0MmDay: number;
    seasonNote: string;
  };
  hourly: HourlyForecastItem[];
  forecast: DailyForecastItem[];
}

export type NavSection = 'overview' | 'zones' | 'schedules' | 'sources' | 'logs';
