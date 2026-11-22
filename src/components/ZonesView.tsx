import { useMemo, useState } from 'react';
import {
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Square,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import type { GigiriWeather, IrrigationZone, WaterSource } from '../types/irrigation';
import { computeZoneAgronomy } from '../utils/agronomy';

interface ZonesViewProps {
  zones: IrrigationZone[];
  sources: WaterSource[];
  weather: GigiriWeather | null;
  onToggleZone: (zoneId: string, action: 'start' | 'stop', durationMin?: number) => Promise<void>;
  onUpdateZone: (zoneId: string, patch: Partial<IrrigationZone>) => Promise<void>;
  onDeleteZone: (zoneId: string) => Promise<void>;
  onOpenNewZone: () => void;
  busyZoneId: string | null;
}

type ZoneFilter = 'all' | 'irrigating' | 'low' | 'maintenance';

export function ZonesView({
  zones,
  sources,
  weather,
  onToggleZone,
  onUpdateZone,
  onDeleteZone,
  onOpenNewZone,
  busyZoneId,
}: ZonesViewProps) {
  const [filter, setFilter] = useState<ZoneFilter>('all');
  const [query, setQuery] = useState('');
  const [editingZone, setEditingZone] = useState<IrrigationZone | null>(null);
  const [draftMin, setDraftMin] = useState(24);
  const [draftMax, setDraftMax] = useState(34);
  const [draftMoisture, setDraftMoisture] = useState(26);
  const [draftKc, setDraftKc] = useState(0.85);
  const [draftRootMm, setDraftRootMm] = useState(300);
  const [draftFlowLpm, setDraftFlowLpm] = useState(60);
  const [draftSourceId, setDraftSourceId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bannerError, setBannerError] = useState(false);

  const et0Today = weather?.current.et0MmDay ?? 3.7;
  const forecastRainToday = weather?.forecast[0]?.precipMm ?? 0;

  const filteredZones = useMemo(() => {
    return zones.filter((z) => {
      if (filter === 'irrigating' && !z.valveOpen) return false;
      if (filter === 'low' && z.moisturePct >= z.targetMinPct) return false;
      if (filter === 'maintenance' && z.status !== 'maintenance') return false;

      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          z.name.toLowerCase().includes(q) ||
          z.sector.toLowerCase().includes(q) ||
          z.cropType.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [zones, filter, query]);

  const openCalibrate = (zone: IrrigationZone) => {
    setEditingZone(zone);
    setDraftMin(zone.targetMinPct);
    setDraftMax(zone.targetMaxPct);
    setDraftMoisture(zone.moisturePct);
    setDraftKc(zone.kc);
    setDraftRootMm(zone.rootDepthMm);
    setDraftFlowLpm(zone.nominalFlowLpm);
    setDraftSourceId(zone.activeSourceId);
    setConfirmDelete(false);
  };

  const handleSaveCalibration = async () => {
    if (!editingZone) return;
    setSaving(true);
    try {
      await onUpdateZone(editingZone.id, {
        targetMinPct: draftMin,
        targetMaxPct: draftMax,
        moisturePct: draftMoisture,
        kc: draftKc,
        rootDepthMm: draftRootMm,
        nominalFlowLpm: draftFlowLpm,
        activeSourceId: draftSourceId,
      });
      setEditingZone(null);
    } finally {
      setSaving(false);
    }
  };

  const totalHa = zones.reduce((sum, z) => sum + z.areaHa, 0);

  return (
    <div className="space-y-6">
      {/* Scenic Header Strip */}
      <section className="relative h-40 rounded-2xl overflow-hidden border border-emerald-950/15 bg-[#0b281e]">
        {!bannerError ? (
          <img
            src="/src/assets/images/gigiri_orchard_sprinklers_1795349214486.jpg"
            alt="Sunlit orchard micro-sprinklers over red Kikuyu loam in Gigiri"
            referrerPolicy="no-referrer"
            onError={() => setBannerError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 to-emerald-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#072017]/90 via-[#0b281e]/70 to-transparent" />
        <div className="relative z-10 h-full p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
          <div>
            <p className="text-xs text-emerald-200">
              {zones.length} Monitored Sectors · {totalHa.toFixed(2)} Hectares Irrigated Land
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold mt-0.5">
              Gigiri Zones & Solenoid Valves
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenNewZone}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Sector Zone</span>
          </button>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-white/80 backdrop-blur-sm border border-emerald-950/10 rounded-lg self-start">
          {(
            [
              { id: 'all', label: `All Sectors (${zones.length})` },
              {
                id: 'irrigating',
                label: `Irrigating (${zones.filter((z) => z.valveOpen).length})`,
              },
              {
                id: 'low',
                label: `Low Moisture (${zones.filter((z) => z.moisturePct < z.targetMinPct).length})`,
              },
              {
                id: 'maintenance',
                label: `Maintenance (${zones.filter((z) => z.status === 'maintenance').length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-[#0b281e] text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-emerald-50/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Gigiri sector or crop..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white/95 border border-emerald-950/15 rounded-lg focus:outline-none focus:border-emerald-700"
          />
        </div>
      </div>

      {/* Zones High-Density Data Table */}
      <div className="bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl overflow-hidden">
        {filteredZones.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900">
              No Gigiri sectors match the current filter.
            </p>
            <p className="text-xs text-slate-500">
              Clear your search filter or commission a new sector to monitor soil moisture.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilter('all');
                setQuery('');
              }}
              className="px-4 py-2 text-xs font-medium bg-[#0b281e] text-white rounded-lg hover:bg-emerald-900"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-950/10 bg-emerald-50/40 text-xs text-slate-600">
                  <th className="py-3 px-4 text-left font-medium">Zone & Vegetation</th>
                  <th className="py-3 px-4 text-left font-medium">Hardware & Source</th>
                  <th className="py-3 px-4 text-right font-medium">Area · ETc</th>
                  <th className="py-3 px-4 text-left font-medium">Moisture (VWC)</th>
                  <th className="py-3 px-4 text-right font-medium">FAO Target</th>
                  <th className="py-3 px-4 text-right font-medium">Today</th>
                  <th className="py-3 px-4 text-right font-medium">Valve Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredZones.map((zone) => {
                  const isLow = zone.moisturePct < zone.targetMinPct;
                  const src = sources.find((s) => s.id === zone.activeSourceId);
                  const pctFill = Math.min(100, Math.max(5, (zone.moisturePct / 50) * 100));
                  const agr = computeZoneAgronomy(zone, et0Today, forecastRainToday);

                  return (
                    <tr key={zone.id} className="hover:bg-emerald-50/35 transition-colors">
                      <td className="py-3.5 px-4 align-top">
                        <p className="font-medium text-slate-900">{zone.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {zone.sector} · {zone.cropType}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <p className="text-xs font-medium text-slate-800">
                          {zone.emitterType}
                        </p>
                        <p className="text-xs text-sky-700 mt-0.5">
                          {src ? src.name.split('(')[0].trim() : 'Borehole A'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700 align-top">
                        <p>{zone.areaHa.toFixed(2)} ha</p>
                        <p className="text-amber-800 mt-0.5">{agr.etcMmDay} mm/d</p>
                      </td>

                      <td className="py-3.5 px-4 align-top min-w-[170px]">
                        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                          <span
                            className={`font-semibold ${
                              isLow
                                ? 'text-amber-700'
                                : zone.valveOpen
                                  ? 'text-emerald-700'
                                  : 'text-slate-900'
                            }`}
                          >
                            {zone.moisturePct.toFixed(1)}%
                          </span>
                          <span className="text-slate-400">
                            {zone.targetMinPct}–{zone.targetMaxPct}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isLow
                                ? 'bg-amber-500'
                                : zone.valveOpen
                                  ? 'bg-emerald-600'
                                  : 'bg-sky-600'
                            }`}
                            style={{ width: `${pctFill}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs align-top">
                        {zone.valveOpen ? (
                          <div>
                            <span className="font-semibold text-emerald-700">
                              {zone.flowRateLpm} L/m
                            </span>
                            <p className="text-slate-500 mt-0.5">
                              {Math.ceil(zone.remainingMin)}m left
                            </p>
                          </div>
                        ) : zone.status === 'maintenance' ? (
                          <span className="text-slate-400">Locked</span>
                        ) : agr.recommendedMinutes > 0 ? (
                          <div>
                            <span className="font-semibold text-amber-800">
                              +{agr.netDeficitMm} mm
                            </span>
                            <p className="text-slate-500 mt-0.5">
                              {agr.recommendedMinutes}m rec
                            </p>
                          </div>
                        ) : (
                          <span className="text-emerald-700 font-medium">Optimal</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700 align-top">
                        {zone.todayLiters.toLocaleString()} L
                      </td>

                      <td className="py-3.5 px-4 text-right align-top">
                        <div className="inline-flex items-center gap-2">
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
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap disabled:opacity-40 ${
                              zone.valveOpen
                                ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                                : 'bg-emerald-700 border-emerald-700 text-white hover:bg-emerald-800'
                            }`}
                          >
                            {zone.valveOpen ? (
                              <>
                                <Square className="w-3 h-3" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" />
                                <span>
                                  Run {agr.recommendedMinutes || zone.runDurationMin}m
                                </span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => openCalibrate(zone)}
                            aria-label={`Calibrate ${zone.name}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-emerald-50"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Calibration, Agronomy & Maintenance Modal */}
      {editingZone && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Calibrate Sector Probe & Agronomy
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingZone.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingZone(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Current VWC %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={10}
                    max={55}
                    value={draftMoisture}
                    onChange={(e) => setDraftMoisture(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Min Trigger %
                  </label>
                  <input
                    type="number"
                    min={12}
                    max={40}
                    value={draftMin}
                    onChange={(e) => setDraftMin(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Max Cutoff %
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={55}
                    value={draftMax}
                    onChange={(e) => setDraftMax(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Crop Kc
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min={0.4}
                    max={1.25}
                    value={draftKc}
                    onChange={(e) => setDraftKc(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Root Depth (mm)
                  </label>
                  <input
                    type="number"
                    step="20"
                    min={100}
                    max={1000}
                    value={draftRootMm}
                    onChange={(e) => setDraftRootMm(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Flow (L/min)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={250}
                    value={draftFlowLpm}
                    onChange={(e) => setDraftFlowLpm(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Assigned Water Source
                </label>
                <select
                  value={draftSourceId}
                  onChange={(e) => setDraftSourceId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  Maintenance Lockout
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const nextStatus =
                      editingZone.status === 'maintenance' ? 'idle' : 'maintenance';
                    await onUpdateZone(editingZone.id, { status: nextStatus });
                    setEditingZone(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    editingZone.status === 'maintenance'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  {editingZone.status === 'maintenance'
                    ? 'Unlock Sector'
                    : 'Lock for Maintenance'}
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Decommission Sector</span>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Zone
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteZone(editingZone.id);
                        setEditingZone(null);
                      }}
                      className="px-2.5 py-1 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Confirm Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingZone(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveCalibration}
                  className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Calibration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
