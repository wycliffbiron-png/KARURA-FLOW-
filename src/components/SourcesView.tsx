import { useState } from 'react';
import { Droplets, PlusCircle } from 'lucide-react';
import type { DailyWaterBalance, WaterSource } from '../types/irrigation';

interface SourcesViewProps {
  sources: WaterSource[];
  dailyBalance: DailyWaterBalance[];
  todayCostKes: number;
  onRefillSource: (sourceId: string, addLiters: number) => Promise<void>;
  onUpdateStatus: (
    sourceId: string,
    status: 'active' | 'standby' | 'rationed' | 'maintenance'
  ) => Promise<void>;
}

export function SourcesView({
  sources,
  dailyBalance,
  todayCostKes,
  onRefillSource,
  onUpdateStatus,
}: SourcesViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState(false);

  const totalCapacity = sources.reduce((acc, s) => acc + s.capacityLiters, 0);
  const totalStored = sources.reduce((acc, s) => acc + s.currentLiters, 0);
  const overallPct = totalCapacity > 0 ? Math.round((totalStored / totalCapacity) * 100) : 0;

  const weeklyRainLiters = dailyBalance.reduce((acc, d) => acc + d.rainwaterLiters, 0);
  const weeklyBoreholeLiters = dailyBalance.reduce((acc, d) => acc + d.boreholeLiters, 0);
  const weeklyMunicipalLiters = dailyBalance.reduce((acc, d) => acc + d.municipalLiters, 0);
  // Estimated savings from using rainwater harvesting instead of NCWSC municipal supply (KES 118 - 12 = 106/m3)
  const rainwaterSavingsKes = Math.round((weeklyRainLiters / 1000) * 106);

  const maxDayTotal = Math.max(
    15000,
    ...dailyBalance.map(
      (d) => d.boreholeLiters + d.rainwaterLiters + d.municipalLiters
    )
  );

  const handleAdd = async (id: string, liters: number) => {
    if (!Number.isFinite(liters) || liters <= 0) return;
    setBusyId(id);
    try {
      await onRefillSource(id, liters);
      setCustomAmounts((prev) => ({ ...prev, [id]: '' }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Scenic Reservoir & Borehole Masthead */}
      <section className="relative h-44 rounded-2xl overflow-hidden border border-emerald-950/15 bg-[#08242e]">
        {!bannerError ? (
          <img
            src="/src/assets/images/gigiri_water_cistern_borehole_1795349214123.jpg"
            alt="Solar-powered borehole pump station and rainwater harvesting reservoir overlooking Nairobi"
            referrerPolicy="no-referrer"
            onError={() => setBannerError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-sky-950 to-emerald-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#071f29]/90 via-[#082c38]/65 to-transparent" />
        <div className="relative z-10 h-full p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
          <div>
            <p className="text-xs text-sky-200">
              Aquifer Boreholes · Rainwater Cisterns · NCWSC Municipal Feed
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold mt-0.5">
              Gigiri Water Storage & Pumping Infrastructure
            </h2>
          </div>
          <div className="bg-black/30 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2.5 text-right shrink-0">
            <span className="text-xs text-sky-200 block">Combined Reserve</span>
            <span className="text-lg font-mono tabular-nums font-semibold">
              {totalStored.toLocaleString()} L ({overallPct}%)
            </span>
          </div>
        </div>
      </section>

      {/* Weekly Water Economics Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/95 border border-emerald-950/10 rounded-xl p-4">
          <p className="text-xs text-slate-500">Today&apos;s Pumping & Feed Cost</p>
          <p className="text-xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            KES {Math.round(todayCostKes).toLocaleString()}
          </p>
        </div>
        <div className="bg-white/95 border border-emerald-950/10 rounded-xl p-4">
          <p className="text-xs text-slate-500">7-Day Rainwater Harvested Share</p>
          <p className="text-xl font-semibold font-mono tabular-nums text-sky-700 mt-1">
            {Math.round(
              (weeklyRainLiters /
                Math.max(1, weeklyRainLiters + weeklyBoreholeLiters + weeklyMunicipalLiters)) *
                100
            )}
            % ({(weeklyRainLiters / 1000).toFixed(1)} m³)
          </p>
        </div>
        <div className="bg-white/95 border border-emerald-950/10 rounded-xl p-4">
          <p className="text-xs text-slate-500">7-Day Rainwater Savings vs NCWSC</p>
          <p className="text-xl font-semibold font-mono tabular-nums text-emerald-700 mt-1">
            KES {rainwaterSavingsKes.toLocaleString()}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sources.map((src) => {
          const pct = Math.round((src.currentLiters / src.capacityLiters) * 100);
          const isLow = pct < 30;
          const customVal = customAmounts[src.id] ?? '';

          return (
            <div
              key={src.id}
              className="bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-sky-700 capitalize">
                      {src.type} supply · {src.rationWindow}
                    </p>
                    <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                      {src.name}
                    </h3>
                  </div>

                  <select
                    aria-label={`Status for ${src.name}`}
                    value={src.status}
                    onChange={(e) =>
                      onUpdateStatus(
                        src.id,
                        e.target.value as 'active' | 'standby' | 'rationed' | 'maintenance'
                      )
                    }
                    className="text-xs font-medium px-2.5 py-1.5 border border-slate-200 rounded-lg bg-emerald-50/40 text-slate-800"
                  >
                    <option value="active">Active</option>
                    <option value="standby">Standby</option>
                    <option value="rationed">Rationed</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                <p className="text-xs text-slate-600 mt-2">{src.notes}</p>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-xs font-mono tabular-nums mb-1.5">
                    <span className="font-semibold text-slate-900">
                      {src.currentLiters.toLocaleString()} /{' '}
                      {src.capacityLiters.toLocaleString()} L
                    </span>
                    <span className={isLow ? 'text-amber-700 font-semibold' : 'text-sky-700 font-semibold'}>
                      {pct}% full
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        src.type === 'rainwater'
                          ? 'bg-sky-600'
                          : isLow
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Max Flow</span>
                    <span className="font-mono tabular-nums font-medium text-slate-900">
                      {src.flowCapacityLpm} L/min
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Pump Load</span>
                    <span className="font-mono tabular-nums font-medium text-slate-900">
                      {src.pumpPowerKw} kW
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Unit Cost</span>
                    <span className="font-mono tabular-nums font-medium text-slate-900">
                      KES {src.costPerCubicMeterKes}/m³
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-sky-600" />
                  Replenish tank
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === src.id}
                    onClick={() => handleAdd(src.id, 5000)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono tabular-nums font-medium border border-sky-200 bg-sky-50/50 rounded-lg text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    5,000 L
                  </button>
                  <button
                    type="button"
                    disabled={busyId === src.id}
                    onClick={() => handleAdd(src.id, 15000)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono tabular-nums font-medium border border-sky-200 bg-sky-50/50 rounded-lg text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    15,000 L
                  </button>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={100}
                      max={100000}
                      placeholder="Custom L"
                      value={customVal}
                      onChange={(e) =>
                        setCustomAmounts((prev) => ({
                          ...prev,
                          [src.id]: e.target.value,
                        }))
                      }
                      className="w-24 px-2 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      disabled={busyId === src.id || !customVal}
                      onClick={() => handleAdd(src.id, Number(customVal))}
                      className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 7-Day Source Mix & ET Balance */}
      <section className="bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              7-Day Gigiri Water Source Mix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Prioritizing rainwater cistern harvesting over deep borehole pumping and rationed NCWSC supply
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 inline-block" />
              Rainwater
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
              Boreholes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
              NCWSC
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-3 items-end h-52">
          {dailyBalance.map((d) => {
            const total = d.boreholeLiters + d.rainwaterLiters + d.municipalLiters;
            const rainH = Math.round((d.rainwaterLiters / maxDayTotal) * 140);
            const boreH = Math.round((d.boreholeLiters / maxDayTotal) * 140);
            const munH = Math.round((d.municipalLiters / maxDayTotal) * 140);

            return (
              <div key={d.day} className="flex flex-col items-center justify-end h-full">
                <span className="text-[11px] font-mono tabular-nums text-slate-600 mb-1.5">
                  {(total / 1000).toFixed(1)}k
                </span>
                <div className="w-full max-w-[44px] flex flex-col justify-end rounded-t-md overflow-hidden bg-slate-100">
                  {munH > 0 && (
                    <div
                      className="w-full bg-amber-500"
                      style={{ height: `${munH}px` }}
                      title={`NCWSC: ${d.municipalLiters.toLocaleString()} L`}
                    />
                  )}
                  {boreH > 0 && (
                    <div
                      className="w-full bg-emerald-600"
                      style={{ height: `${boreH}px` }}
                      title={`Boreholes: ${d.boreholeLiters.toLocaleString()} L`}
                    />
                  )}
                  {rainH > 0 && (
                    <div
                      className="w-full bg-sky-600"
                      style={{ height: `${rainH}px` }}
                      title={`Rainwater: ${d.rainwaterLiters.toLocaleString()} L`}
                    />
                  )}
                </div>
                <span className="text-xs font-medium text-slate-700 mt-2">{d.day}</span>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  ET {d.etLossMm}mm
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
