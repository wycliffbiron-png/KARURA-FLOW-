import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CloudRain,
  Droplets,
  Gauge,
  Play,
  PowerOff,
  Sparkles,
  Sprout,
  Square,
  Sun,
  Waves,
  Wind,
} from 'lucide-react';
import type {
  GigiriWeather,
  IrrigationZone,
  NavSection,
  SystemState,
} from '../types/irrigation';
import { computeZoneAgronomy } from '../utils/agronomy';

interface OverviewViewProps {
  state: SystemState;
  weather: GigiriWeather | null;
  onToggleZone: (
    zoneId: string,
    action: 'start' | 'stop',
    durationMin?: number,
    sourceId?: string
  ) => Promise<void>;
  onUpdateZoneSource: (zoneId: string, sourceId: string) => Promise<void>;
  onToggleEmergencyStop: () => Promise<void>;
  onToggleRainHold: () => Promise<void>;
  onNavigate: (section: NavSection) => void;
  busyZoneId: string | null;
}

function getZoneStatusLabel(zone: IrrigationZone, liveRemainingMin: number): {
  text: string;
  tone: string;
} {
  if (zone.status === 'maintenance') {
    return { text: 'Maintenance', tone: 'text-slate-500' };
  }
  if (zone.valveOpen && zone.status === 'irrigating') {
    const totalSec = Math.max(0, Math.round(liveRemainingMin * 60));
    const mm = Math.floor(totalSec / 60);
    const ss = String(totalSec % 60).padStart(2, '0');
    return { text: `Irrigating · ${mm}:${ss}`, tone: 'text-emerald-700' };
  }
  if (zone.moisturePct < zone.targetMinPct) {
    return { text: 'Below target VWC', tone: 'text-amber-700' };
  }
  return { text: 'Idle · Nominal', tone: 'text-slate-600' };
}

function getZonePhoto(zoneId: string): string {
  if (zoneId === 'zone-redhill-orchard' || zoneId === 'zone-limuru-compound') {
    return '/src/assets/images/gigiri_orchard_sprinklers_1795349214486.jpg';
  }
  if (zoneId === 'zone-rosslyn-nursery' || zoneId === 'zone-karura-edge') {
    return '/src/assets/images/gigiri_nursery_mist_1795349212863.jpg';
  }
  return '/src/assets/images/gigiri_drip_irrigation_1795348439076.jpg';
}

export function OverviewView({
  state,
  weather,
  onToggleZone,
  onUpdateZoneSource,
  onToggleEmergencyStop,
  onToggleRainHold,
  onNavigate,
  busyZoneId,
}: OverviewViewProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<string>(state.zones[0]?.id || '');
  const [runDuration, setRunDuration] = useState<number>(25);
  const [bannerImgError, setBannerImgError] = useState(false);
  const [zoneImgError, setZoneImgError] = useState<Record<string, boolean>>({});
  const [microImgError, setMicroImgError] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Smooth 1-second live countdown between 15s server syncs
  useEffect(() => {
    setElapsedSec(0);
    const hasActive = state.zones.some((z) => z.valveOpen);
    if (!hasActive) return;
    const t = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  const selectedZone =
    state.zones.find((z) => z.id === selectedZoneId) || state.zones[0];

  const getLiveRemainingMin = (zone: IrrigationZone) =>
    zone.valveOpen ? Math.max(0, zone.remainingMin - elapsedSec / 60) : 0;

  const activeZones = state.zones.filter((z) => z.valveOpen);
  const totalFlowLpm = activeZones.reduce((acc, z) => acc + z.flowRateLpm, 0);
  const liveExtraLiters = Math.round((totalFlowLpm * elapsedSec) / 60);
  const totalTodayLiters =
    state.zones.reduce((acc, z) => acc + z.todayLiters, 0) + liveExtraLiters;
  const totalCapacity = state.sources.reduce((acc, s) => acc + s.capacityLiters, 0);
  const totalStored = Math.max(
    0,
    state.sources.reduce((acc, s) => acc + s.currentLiters, 0) - liveExtraLiters
  );
  const storagePct = totalCapacity > 0 ? Math.round((totalStored / totalCapacity) * 100) : 0;
  const avgMoisture =
    state.zones.length > 0
      ? (
          state.zones.reduce((acc, z) => acc + z.moisturePct, 0) / state.zones.length
        ).toFixed(1)
      : '0.0';

  const et0Today = weather?.current.et0MmDay ?? 3.7;
  const forecastRainToday = weather?.forecast[0]?.precipMm ?? 0;

  const selectedAgronomy = useMemo(
    () =>
      selectedZone
        ? computeZoneAgronomy(selectedZone, et0Today, forecastRainToday)
        : null,
    [selectedZone, et0Today, forecastRainToday]
  );

  // Dynamic SVG height if more than 6 zones are commissioned
  const extraZones = state.zones.slice(6);
  const extraRows = Math.ceil(extraZones.length / 3);
  const svgHeight = 420 + extraRows * 145;

  return (
    <div className="space-y-6">
      {(state.emergencyStop || state.rainHoldActive) && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-3.5 rounded-xl border ${
            state.emergencyStop
              ? 'bg-red-50/95 border-red-200 text-red-900'
              : 'bg-sky-50/95 border-sky-200 text-sky-900'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3 text-sm">
            {state.emergencyStop ? (
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <CloudRain className="w-4 h-4 text-sky-700 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <div>
              <span className="font-semibold">
                {state.emergencyStop
                  ? 'Master Valve Shutoff Engaged'
                  : 'District Rain Hold Active'}
              </span>
              <span className="mx-2 text-slate-400" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-700">
                {state.emergencyStop
                  ? 'All Gigiri solenoid valves are locked closed until manually reset.'
                  : 'Automated schedules paused for Gigiri rainfall conservation.'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={state.emergencyStop ? onToggleEmergencyStop : onToggleRainHold}
            className="px-3.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-900 hover:bg-slate-50 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            {state.emergencyStop ? 'Reset Master Valve' : 'Resume Schedules'}
          </button>
        </div>
      )}

      {/* Scenic Gigiri Estate Panoramic Hero Strip */}
      <section className="relative rounded-2xl overflow-hidden border border-emerald-950/15 bg-[#0b281e]">
        {!bannerImgError ? (
          <img
            src="/src/assets/images/gigiri_karura_canopy_bg_1795349215138.jpg"
            alt="Golden sunrise over lush Gigiri estate gardens bordering Karura Forest, Nairobi"
            referrerPolicy="no-referrer"
            onError={() => setBannerImgError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-[#0b281e] to-sky-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#072017]/92 via-[#0b281e]/72 to-[#072017]/40" />

        <div className="relative z-10 p-6 sm:p-7 flex flex-col lg:flex-row lg:items-end justify-between gap-6 text-white">
          <div className="max-w-2xl space-y-1.5">
            <p className="text-xs font-medium text-emerald-200">
              Gigiri, Nairobi · 1,720m ASL · Karura Forest Greenbelt Corridor
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
              Living Estate Water & Soil Control
            </h2>
            <p className="text-sm text-emerald-50/85">
              {weather?.current.seasonNote ||
                'Synchronizing rainwater cisterns, solar boreholes, and Kikuyu loam moisture across Gigiri.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 bg-black/25 backdrop-blur-md border border-white/15 rounded-xl px-5 py-3.5 shrink-0">
            <div>
              <span className="text-xs text-emerald-200/80 block">Gigiri Weather</span>
              <span className="text-lg font-mono tabular-nums font-semibold">
                {weather ? `${weather.current.temperatureC}°C` : '22.0°C'}
              </span>
            </div>
            <div className="h-8 w-px bg-white/15" aria-hidden="true" />
            <div>
              <span className="text-xs text-emerald-200/80 block">FAO ET₀ Loss</span>
              <span className="text-lg font-mono tabular-nums font-semibold text-amber-300">
                {weather ? `${weather.current.et0MmDay} mm/d` : '3.7 mm/d'}
              </span>
            </div>
            <div className="h-8 w-px bg-white/15" aria-hidden="true" />
            <div>
              <span className="text-xs text-emerald-200/80 block">Today Cost</span>
              <span className="text-lg font-mono tabular-nums font-semibold text-sky-200">
                KES {Math.round(state.todayCostKes).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4-column top operational metrics */}
      <section aria-label="District summary metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Active Manifold Flow</p>
            <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {totalFlowLpm} <span className="text-sm font-normal text-slate-500">L/min</span>
            </p>
            <p className="mt-1 text-xs font-mono tabular-nums text-emerald-700 font-medium">
              {activeZones.length} of {state.zones.length} solenoids open
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <Waves className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Applied Today</p>
            <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {totalTodayLiters.toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-500">L</span>
            </p>
            <p className="mt-1 text-xs font-mono tabular-nums text-sky-700 font-medium">
              {(totalTodayLiters / 1000).toFixed(2)} m³ · KES{' '}
              {Math.round(state.todayCostKes).toLocaleString()}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200/60">
            <Droplets className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Stored Water Reserve</p>
            <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {storagePct}%
            </p>
            <p className="mt-1 text-xs font-mono tabular-nums text-slate-600">
              {Math.round(totalStored / 1000)} / {Math.round(totalCapacity / 1000)} m³ available
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200/60">
            <Gauge className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Mean Soil Moisture</p>
            <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {avgMoisture}% <span className="text-sm font-normal text-slate-500">VWC</span>
            </p>
            <p className="mt-1 text-xs text-amber-800 font-medium">
              Humic Nitisol · Kikuyu Loam
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
            <Sprout className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* Primary Focal Anchor: Gigiri Schematic Map + Inspector */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <div className="xl:col-span-8 bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Gigiri District Sector Schematic
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                UN Avenue · Limuru Road · Karura Forest Boundary — Animated flow lines show active open valves
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                Irrigating
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                Low VWC
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 inline-block" />
                Nominal
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <svg
              viewBox={`0 0 800 ${svgHeight}`}
              className="w-full min-w-[600px] h-auto rounded-xl border border-emerald-900/15"
              role="img"
              aria-label="Interactive Gigiri irrigation zones and water supply manifold schematic"
            >
              <defs>
                <linearGradient id="gigiri-terrain" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f3f8f4" />
                  <stop offset="60%" stopColor="#f8f5f0" />
                  <stop offset="100%" stopColor="#eef6f9" />
                </linearGradient>
                <pattern
                  id="gigiri-grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#dce7df"
                    strokeWidth="0.7"
                  />
                </pattern>
              </defs>
              <rect width="800" height={svgHeight} fill="url(#gigiri-terrain)" />
              <rect width="800" height={svgHeight} fill="url(#gigiri-grid)" />

              {/* Road & Karura Forest context lines */}
              <path
                d={`M 28 20 L 28 ${svgHeight - 20}`}
                stroke="#cbd5e1"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <text
                x="18"
                y="215"
                fill="#475569"
                fontSize="10"
                fontFamily="DM Sans, sans-serif"
                transform="rotate(-90 18 215)"
                textAnchor="middle"
              >
                LIMURU ROAD CORRIDOR
              </text>

              <path
                d="M 48 218 L 775 218"
                stroke="#cbd5e1"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M 55 218 L 760 218"
                stroke="#0284c7"
                strokeWidth="2"
                strokeOpacity="0.45"
                className={activeZones.length > 0 ? 'animate-water-flow' : ''}
              />
              <text
                x="410"
                y="213"
                fill="#475569"
                fontSize="10"
                fontWeight="600"
                fontFamily="DM Sans, sans-serif"
                textAnchor="middle"
              >
                UN AVENUE / GIGIRI CLOSE MAIN MANIFOLD
              </text>

              <rect x="325" y="12" width="450" height="26" rx="6" fill="#bbf7d0" />
              <text
                x="550"
                y="29"
                fill="#14532d"
                fontSize="10"
                fontWeight="700"
                fontFamily="DM Sans, sans-serif"
                textAnchor="middle"
              >
                KARURA FOREST GREENBELT BOUNDARY
              </text>

              {/* Feed lines for primary 6 sectors */}
              {[
                { x: 185, y1: 218, y2: 205, open: state.zones[0]?.valveOpen },
                { x: 455, y1: 218, y2: 210, open: state.zones[1]?.valveOpen },
                { x: 172, y1: 218, y2: 235, open: state.zones[2]?.valveOpen },
                { x: 392, y1: 218, y2: 240, open: state.zones[3]?.valveOpen },
                { x: 615, y1: 218, y2: 235, open: state.zones[4]?.valveOpen },
                { x: 680, y1: 218, y2: 205, open: state.zones[5]?.valveOpen },
              ].map((line, i) => (
                <line
                  key={i}
                  x1={line.x}
                  y1={line.y1}
                  x2={line.x}
                  y2={line.y2}
                  stroke={line.open ? '#0284c7' : '#94a3b8'}
                  strokeWidth={line.open ? '3' : '2'}
                  className={line.open ? 'animate-water-flow' : ''}
                />
              ))}

              {/* Render all zones (first 6 at mapped coords, 7+ in auxiliary expansion rows) */}
              {state.zones.map((zone, idx) => {
                const isSelected = selectedZone?.id === zone.id;
                const isLow = zone.moisturePct < zone.targetMinPct;
                const fill =
                  zone.status === 'maintenance'
                    ? '#f1f5f9'
                    : zone.valveOpen
                      ? '#dcfce7'
                      : isLow
                        ? '#fef3c7'
                        : '#ffffff';
                const stroke = isSelected
                  ? '#0b281e'
                  : zone.valveOpen
                    ? '#16a34a'
                    : isLow
                      ? '#d97706'
                      : '#cbd5e1';

                const coords =
                  idx < 6
                    ? zone.mapCoords
                    : {
                        x: 70 + ((idx - 6) % 3) * 235,
                        y: 425 + Math.floor((idx - 6) / 3) * 145,
                        w: 215,
                        h: 125,
                      };
                const { x, y, w, h } = coords;

                return (
                  <g
                    key={zone.id}
                    onClick={() => setSelectedZoneId(zone.id)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedZoneId(zone.id);
                      }
                    }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx="10"
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                    <text
                      x={x + 12}
                      y={y + 24}
                      fill="#0f172a"
                      fontSize="12"
                      fontWeight="600"
                      fontFamily="Plus Jakarta Sans, sans-serif"
                    >
                      {zone.name.length > 23
                        ? `${zone.name.slice(0, 22)}…`
                        : zone.name}
                    </text>
                    <text
                      x={x + 12}
                      y={y + 42}
                      fill="#475569"
                      fontSize="10"
                      fontFamily="DM Sans, sans-serif"
                    >
                      {zone.areaHa.toFixed(2)} ha · Kc {zone.kc.toFixed(2)}
                    </text>

                    <rect
                      x={x + 12}
                      y={y + h - 46}
                      width={w - 24}
                      height="6"
                      rx="3"
                      fill="#e2e8f0"
                    />
                    <rect
                      x={x + 12}
                      y={y + h - 46}
                      width={Math.max(
                        8,
                        Math.min(w - 24, (zone.moisturePct / 50) * (w - 24))
                      )}
                      height="6"
                      rx="3"
                      fill={
                        zone.valveOpen
                          ? '#15803d'
                          : isLow
                            ? '#d97706'
                            : '#0284c7'
                      }
                    />

                    <text
                      x={x + 12}
                      y={y + h - 18}
                      fill="#0f172a"
                      fontSize="13"
                      fontWeight="600"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {zone.moisturePct.toFixed(1)}% VWC
                    </text>
                    <text
                      x={x + w - 12}
                      y={y + h - 18}
                      fill={
                        zone.valveOpen
                          ? '#15803d'
                          : isLow
                            ? '#b45309'
                            : '#64748b'
                      }
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="end"
                    >
                      {zone.valveOpen
                        ? `${zone.flowRateLpm} L/m`
                        : zone.status === 'maintenance'
                          ? 'LOCKED'
                          : 'CLOSED'}
                    </text>
                  </g>
                );
              })}

              {/* Borehole & Cistern Supply Nodes */}
              <g transform={`translate(54, ${svgHeight - 28})`}>
                <rect x="0" y="0" width="165" height="22" rx="5" fill="#0b281e" />
                <text
                  x="82"
                  y="14"
                  fill="#ffffff"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                >
                  BOREHOLE A · 180M AQUIFER
                </text>
              </g>
              <g transform={`translate(245, ${svgHeight - 28})`}>
                <rect x="0" y="0" width="175" height="22" rx="5" fill="#0284c7" />
                <text
                  x="87"
                  y="14"
                  fill="#ffffff"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                >
                  RAIN CISTERNS · 120,000 L
                </text>
              </g>
              <g transform={`translate(445, ${svgHeight - 28})`}>
                <rect x="0" y="0" width="165" height="22" rx="5" fill="#15803d" />
                <text
                  x="82"
                  y="14"
                  fill="#ffffff"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                >
                  BOREHOLE B · SOLAR HYBRID
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* Selected Zone Inspector Panel with live photo header & FAO-56 Agronomy */}
        <div className="xl:col-span-4 bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl overflow-hidden flex flex-col justify-between">
          {selectedZone && selectedAgronomy ? (
            <>
              <div>
                <div className="relative h-32 bg-emerald-950">
                  {!zoneImgError[selectedZone.id] ? (
                    <img
                      src={getZonePhoto(selectedZone.id)}
                      alt={selectedZone.name}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setZoneImgError((prev) => ({
                          ...prev,
                          [selectedZone.id]: true,
                        }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-900 to-sky-900" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="text-xs text-emerald-200">{selectedZone.sector}</p>
                    <h3 className="text-base font-semibold truncate mt-0.5">
                      {selectedZone.name}
                    </h3>
                  </div>
                </div>

                <div className="p-5">
                  <div
                    aria-live="polite"
                    className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs"
                  >
                    <span className="text-slate-500">Current State</span>
                    <span
                      className={`font-semibold font-mono tabular-nums ${
                        getZoneStatusLabel(
                          selectedZone,
                          getLiveRemainingMin(selectedZone)
                        ).tone
                      }`}
                    >
                      {
                        getZoneStatusLabel(
                          selectedZone,
                          getLiveRemainingMin(selectedZone)
                        ).text
                      }
                    </span>
                  </div>

                  <div className="mt-3 space-y-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Soil Moisture</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {selectedZone.moisturePct.toFixed(1)}%{' '}
                        <span className="text-xs font-normal text-slate-500">
                          ({selectedZone.targetMinPct}–{selectedZone.targetMaxPct}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Crop ETc · Root</span>
                      <span className="font-mono tabular-nums text-xs text-slate-800">
                        {selectedAgronomy.etcMmDay} mm/d · {selectedZone.rootDepthMm} mm
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Pressure · Sensor</span>
                      <span className="font-mono tabular-nums text-xs text-slate-800">
                        {selectedZone.pressureBar.toFixed(1)} bar ·{' '}
                        {selectedZone.sensorBatteryPct}% bat
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <label htmlFor="inspector-source" className="text-slate-500 shrink-0">
                        Feed Source
                      </label>
                      <select
                        id="inspector-source"
                        value={selectedZone.activeSourceId}
                        onChange={(e) =>
                          onUpdateZoneSource(selectedZone.id, e.target.value)
                        }
                        className="text-xs font-medium text-sky-900 bg-sky-50/70 border border-sky-200 rounded-md px-2 py-1 max-w-[190px] truncate"
                      >
                        {state.sources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name.split('(')[0].trim()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* FAO-56 Agronomic Recommendation Strip */}
                  <div className="mt-4 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-medium text-emerald-950">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                        FAO-56 Soil Balance
                      </span>
                      <span className="font-mono tabular-nums text-emerald-800">
                        {selectedAgronomy.daysUntilTrigger}d to trigger
                      </span>
                    </div>
                    {selectedAgronomy.recommendedMinutes > 0 ? (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-slate-700 font-mono tabular-nums">
                          Deficit {selectedAgronomy.netDeficitMm} mm ({selectedAgronomy.litersRequired.toLocaleString()} L)
                        </span>
                        {!selectedZone.valveOpen &&
                          selectedZone.status !== 'maintenance' && (
                            <button
                              type="button"
                              disabled={busyZoneId === selectedZone.id}
                              onClick={() =>
                                onToggleZone(
                                  selectedZone.id,
                                  'start',
                                  selectedAgronomy.recommendedMinutes
                                )
                              }
                              className="px-2.5 py-1 text-[11px] font-medium bg-emerald-700 text-white rounded-md hover:bg-emerald-800 whitespace-nowrap"
                            >
                              Run {selectedAgronomy.recommendedMinutes}m
                            </button>
                          )}
                      </div>
                    ) : (
                      <p className="text-emerald-800">
                        Optimal root-zone reserve; no deficit irrigation required today.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      Manual Cycle Duration
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[15, 25, 40].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setRunDuration(mins)}
                          className={`py-1.5 text-xs font-mono tabular-nums font-medium rounded-lg border transition-colors ${
                            runDuration === mins
                              ? 'bg-[#0b281e] border-[#0b281e] text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50/60'
                          }`}
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 space-y-2">
                <button
                  type="button"
                  disabled={
                    busyZoneId === selectedZone.id ||
                    selectedZone.status === 'maintenance'
                  }
                  onClick={() =>
                    onToggleZone(
                      selectedZone.id,
                      selectedZone.valveOpen ? 'stop' : 'start',
                      runDuration
                    )
                  }
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                    selectedZone.valveOpen
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  {selectedZone.valveOpen ? (
                    <>
                      <Square className="w-4 h-4" />
                      <span>Close Solenoid Valve</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>
                        {selectedZone.status === 'maintenance'
                          ? 'Locked for Maintenance'
                          : `Open Valve (${runDuration} min)`}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('zones')}
                  className="w-full py-2 text-xs font-medium text-emerald-800 hover:text-emerald-950 border border-emerald-900/15 rounded-lg hover:bg-emerald-50/70 transition-colors"
                >
                  Open Full Zones Table
                </button>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {/* Bottom Split: Gigiri Microclimate (with 24h Hourly ET0/Rain Curve) + Priority Valve Queue */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <div className="xl:col-span-7 bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl overflow-hidden flex flex-col">
          <div className="relative h-44 bg-slate-900">
            {!microImgError ? (
              <img
                src="/src/assets/images/gigiri_drip_irrigation_1795348439076.jpg"
                alt="Precision drip irrigation lines across red Kikuyu loam beds in Gigiri, Nairobi"
                referrerPolicy="no-referrer"
                onError={() => setMicroImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-800" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-white">
              <div>
                <p className="text-xs text-emerald-200">
                  Gigiri Microclimate & 24-Hour EAT Diurnal Profile
                </p>
                <h2 className="text-lg font-semibold mt-0.5">
                  {weather
                    ? `${weather.current.temperatureC}°C · ${weather.current.humidityPct}% RH · ET₀ ${weather.current.et0MmDay} mm/day`
                    : 'Loading Gigiri station weather…'}
                </h2>
              </div>
              {weather && (
                <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-sky-200 shrink-0">
                  <span className="flex items-center gap-1.5">
                    <CloudRain className="w-3.5 h-3.5" />
                    {weather.current.rainMm} mm
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Wind className="w-3.5 h-3.5" />
                    {weather.current.windKmh} km/h
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 flex-1 flex flex-col justify-between gap-5">
            {weather && weather.hourly && weather.hourly.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium text-slate-700">
                    Next 24h Rain Probability (%) vs Hourly ET₀ (EAT)
                  </span>
                  <span className="text-slate-500 font-mono">
                    Source: {weather.source === 'open-meteo' ? 'Live Open-Meteo' : 'Highland Model'}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-1.5 items-end h-20 pt-2 px-2 bg-slate-50/80 border border-slate-200/80 rounded-lg">
                  {weather.hourly.slice(0, 12).map((h) => {
                    const barH = Math.max(4, Math.round((h.precipProbPct / 100) * 44));
                    return (
                      <div
                        key={h.time}
                        className="flex flex-col items-center justify-end h-full pb-1"
                        title={`${h.hourLabel} EAT · ${h.tempC}°C · Rain ${h.precipProbPct}% (${h.precipMm}mm) · ET₀ ${h.et0Mm}mm`}
                      >
                        <div
                          className={`w-full max-w-[16px] rounded-t-xs ${
                            h.precipProbPct >= 50 ? 'bg-sky-600' : 'bg-sky-300'
                          }`}
                          style={{ height: `${barH}px` }}
                        />
                        <span className="text-[10px] font-mono tabular-nums text-slate-500 mt-1">
                          {h.hourLabel.slice(0, 2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {weather && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 text-left font-medium">Date</th>
                      <th className="py-2 text-right font-medium">Temp Range</th>
                      <th className="py-2 text-right font-medium">Rain Prob</th>
                      <th className="py-2 text-right font-medium">Rainfall</th>
                      <th className="py-2 text-right font-medium">ET₀ Demand</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {weather.forecast.map((day) => (
                      <tr key={day.date} className="text-slate-700 hover:bg-emerald-50/40">
                        <td className="py-2 font-sans font-medium text-slate-900">
                          {day.date}
                        </td>
                        <td className="py-2 text-right">
                          {day.tempMinC}° – {day.tempMaxC}°C
                        </td>
                        <td className="py-2 text-right">{day.precipProbPct}%</td>
                        <td className="py-2 text-right text-sky-700 font-semibold">
                          {day.precipMm} mm
                        </td>
                        <td className="py-2 text-right text-amber-800 font-medium">
                          {day.et0Mm} mm
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-5 bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Priority Moisture & Valve Queue
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Immediate attention sectors across Gigiri
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleEmergencyStop}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  state.emergencyStop
                    ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                    : 'bg-red-50/60 border-red-200 text-red-700 hover:bg-red-100'
                }`}
              >
                <PowerOff className="w-3.5 h-3.5" />
                <span>{state.emergencyStop ? 'Reset Shutoff' : 'Master Shutoff'}</span>
              </button>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {state.zones.map((zone) => {
                const isLow = zone.moisturePct < zone.targetMinPct;
                const liveRem = getLiveRemainingMin(zone);
                const agr = computeZoneAgronomy(zone, et0Today, forecastRainToday);

                return (
                  <div
                    key={zone.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {zone.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono tabular-nums font-medium text-slate-700">
                          {zone.moisturePct.toFixed(1)}% VWC
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            zone.valveOpen
                              ? 'text-emerald-700 font-semibold font-mono tabular-nums'
                              : isLow
                                ? 'text-amber-700 font-semibold'
                                : 'text-slate-500'
                          }
                        >
                          {zone.valveOpen
                            ? `Open (${Math.ceil(liveRem)}m)`
                            : isLow
                              ? `Needs ${agr.recommendedMinutes || zone.runDurationMin}m`
                              : zone.status === 'maintenance'
                                ? 'Maintenance'
                                : `${agr.daysUntilTrigger}d reserve`}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={
                        busyZoneId === zone.id || zone.status === 'maintenance'
                      }
                      onClick={() =>
                        onToggleZone(
                          zone.id,
                          zone.valveOpen ? 'stop' : 'start',
                          agr.recommendedMinutes || zone.runDurationMin
                        )
                      }
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${
                        zone.valveOpen
                          ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                          : 'bg-emerald-50/70 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {zone.valveOpen ? 'Stop' : 'Start'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-600" />
              Optimal Gigiri window: 04:45–08:15 EAT
            </span>
            <button
              type="button"
              onClick={() => onNavigate('schedules')}
              className="font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>Schedules</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
