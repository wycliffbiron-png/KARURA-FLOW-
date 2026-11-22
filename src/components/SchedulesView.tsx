import { useState } from 'react';
import { CalendarClock, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import type {
  IrrigationSchedule,
  IrrigationZone,
  WaterSource,
} from '../types/irrigation';

interface SchedulesViewProps {
  schedules: IrrigationSchedule[];
  zones: IrrigationZone[];
  sources: WaterSource[];
  rainHoldActive: boolean;
  onToggleSchedule: (id: string, enabled: boolean) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
  onEvaluateSchedule: (id: string) => Promise<string>;
  onEditSchedule: (schedule: IrrigationSchedule) => void;
  onOpenNewSchedule: () => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function SchedulesView({
  schedules,
  zones,
  sources,
  rainHoldActive,
  onToggleSchedule,
  onDeleteSchedule,
  onEvaluateSchedule,
  onEditSchedule,
  onOpenNewSchedule,
}: SchedulesViewProps) {
  const [bannerError, setBannerError] = useState(false);
  const [evalMessage, setEvalMessage] = useState<string | null>(null);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const activeCount = schedules.filter((s) => s.enabled).length;

  const handleEvaluate = async (sch: IrrigationSchedule) => {
    setEvaluatingId(sch.id);
    setEvalMessage(null);
    try {
      const outcome = await onEvaluateSchedule(sch.id);
      if (outcome === 'rain_skip') {
        setEvalMessage(`"${sch.label}" skipped by Gigiri rainfall guard.`);
      } else if (outcome === 'moisture_skip') {
        setEvalMessage(`"${sch.label}" skipped because soil moisture already exceeds cutoff.`);
      } else {
        setEvalMessage(`"${sch.label}" passed all guards and opened solenoid valve.`);
      }
    } catch (err) {
      setEvalMessage(err instanceof Error ? err.message : 'Unable to evaluate schedule.');
    } finally {
      setEvaluatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative h-40 rounded-2xl overflow-hidden border border-emerald-950/15 bg-[#0b281e]">
        {!bannerError ? (
          <img
            src="/src/assets/images/gigiri_drip_irrigation_1795348439076.jpg"
            alt="Early morning drip irrigation beds in Gigiri"
            referrerPolicy="no-referrer"
            onError={() => setBannerError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 to-sky-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#072017]/92 via-[#0b281e]/72 to-transparent" />
        <div className="relative z-10 h-full p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
          <div>
            <p className="text-xs text-emerald-200">
              {activeCount} Active Programs · Smart Rain-Skip & NCWSC Rationing Sync
              {rainHoldActive ? ' · Paused by Rain Hold' : ''}
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold mt-0.5">
              Automated Gigiri Irrigation Schedules
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenNewSchedule}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Schedule</span>
          </button>
        </div>
      </section>

      {evalMessage && (
        <div
          role="status"
          className="px-4 py-3 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-4"
        >
          <span>{evalMessage}</span>
          <button
            type="button"
            onClick={() => setEvalMessage(null)}
            className="underline text-emerald-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Weekly Timeline Matrix */}
      <section className="bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Weekly Run Matrix (East Africa Time · UTC+3)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {WEEKDAYS.map((day) => {
            const daySchedules = schedules
              .filter((s) => s.enabled && s.days.includes(day))
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const isMunicipalDay = day === 'Tue' || day === 'Thu' || day === 'Sat';

            return (
              <div
                key={day}
                className={`border rounded-xl p-3 flex flex-col justify-between min-h-[148px] ${
                  isMunicipalDay
                    ? 'border-sky-200 bg-sky-50/45'
                    : 'border-emerald-950/10 bg-emerald-50/25'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                    <span className="text-xs font-semibold text-slate-900">{day}</span>
                    {isMunicipalDay && (
                      <span className="text-[11px] text-sky-700 font-semibold">
                        NCWSC
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 space-y-2">
                    {daySchedules.length === 0 ? (
                      <p className="text-xs text-slate-400">No runs</p>
                    ) : (
                      daySchedules.map((sch) => {
                        const zone = zones.find((z) => z.id === sch.zoneId);
                        return (
                          <div
                            key={sch.id}
                            className="bg-white border border-emerald-950/10 rounded-lg p-2 text-xs"
                          >
                            <p className="font-mono tabular-nums font-semibold text-emerald-800">
                              {sch.startTime} · {sch.durationMin}m
                            </p>
                            <p className="text-slate-700 truncate mt-0.5">
                              {zone?.name || 'Sector'}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Schedule Rules Table */}
      <section className="bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl overflow-hidden">
        {schedules.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <CalendarClock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-slate-900">No irrigation schedules defined</p>
            <p className="text-xs text-slate-500">
              Add a timed cycle with Gigiri rainfall and moisture cutoff guards.
            </p>
            <button
              type="button"
              onClick={onOpenNewSchedule}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
            >
              Create First Schedule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-950/10 bg-emerald-50/40 text-xs text-slate-600">
                  <th className="py-3 px-4 text-left font-medium">Schedule & Sector</th>
                  <th className="py-3 px-4 text-left font-medium">Days</th>
                  <th className="py-3 px-4 text-right font-medium">Start (EAT)</th>
                  <th className="py-3 px-4 text-right font-medium">Duration</th>
                  <th className="py-3 px-4 text-left font-medium">Feed Source</th>
                  <th className="py-3 px-4 text-right font-medium">Guards</th>
                  <th className="py-3 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((sch) => {
                  const zone = zones.find((z) => z.id === sch.zoneId);
                  const source = sources.find((s) => s.id === sch.waterSourceId);

                  return (
                    <tr key={sch.id} className="hover:bg-emerald-50/35">
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-900">{sch.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {zone?.name || 'Unknown Zone'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        {sch.days.join(', ')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-900">
                        {sch.startTime}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-900">
                        {sch.durationMin} min
                      </td>
                      <td className="py-3.5 px-4 text-xs text-sky-800 font-medium">
                        {source ? source.name.split('(')[0].trim() : 'Primary'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                        Rain &gt;{sch.skipOnRainMm}mm · VWC &ge;{sch.moistureCutoffPct}%
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={evaluatingId === sch.id}
                            onClick={() => handleEvaluate(sch)}
                            title="Run rain & moisture guard check now"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-sky-200 bg-sky-50/70 text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                          >
                            <Play className="w-3 h-3" />
                            <span>Run Check</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onToggleSchedule(sch.id, !sch.enabled)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                              sch.enabled
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {sch.enabled ? 'Enabled' : 'Paused'}
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditSchedule(sch)}
                            aria-label={`Edit ${sch.label}`}
                            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteSchedule(sch.id)}
                            aria-label={`Delete ${sch.label}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </section>
    </div>
  );
}
