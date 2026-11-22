import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type {
  IrrigationSchedule,
  IrrigationZone,
  WaterSource,
} from '../types/irrigation';

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  zones: IrrigationZone[];
  sources: WaterSource[];
  editingSchedule?: IrrigationSchedule | null;
  defaultZoneId?: string;
  onSave: (
    payload: {
      zoneId: string;
      label: string;
      days: string[];
      startTime: string;
      durationMin: number;
      waterSourceId: string;
      skipOnRainMm: number;
      moistureCutoffPct: number;
    },
    editId?: string
  ) => Promise<void>;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ScheduleModal({
  open,
  onClose,
  zones,
  sources,
  editingSchedule,
  defaultZoneId,
  onSave,
}: ScheduleModalProps) {
  const [zoneId, setZoneId] = useState(defaultZoneId || zones[0]?.id || '');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);
  const [startTime, setStartTime] = useState('05:30');
  const [durationMin, setDurationMin] = useState(30);
  const [waterSourceId, setWaterSourceId] = useState(sources[1]?.id || sources[0]?.id || '');
  const [skipOnRainMm, setSkipOnRainMm] = useState(4);
  const [moistureCutoffPct, setMoistureCutoffPct] = useState(34);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editingSchedule) {
      setZoneId(editingSchedule.zoneId);
      setLabel(editingSchedule.label);
      setDays(editingSchedule.days);
      setStartTime(editingSchedule.startTime);
      setDurationMin(editingSchedule.durationMin);
      setWaterSourceId(editingSchedule.waterSourceId);
      setSkipOnRainMm(editingSchedule.skipOnRainMm);
      setMoistureCutoffPct(editingSchedule.moistureCutoffPct);
    } else {
      setZoneId(defaultZoneId || zones[0]?.id || '');
      setLabel('');
      setDays(['Mon', 'Wed', 'Fri']);
      setStartTime('05:30');
      setDurationMin(30);
      setWaterSourceId(sources[1]?.id || sources[0]?.id || '');
      setSkipOnRainMm(4);
      setMoistureCutoffPct(34);
    }
    setError('');
  }, [open, editingSchedule, defaultZoneId, zones, sources]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleDay = (day: string) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Enter a descriptive schedule label.');
      return;
    }
    if (days.length === 0) {
      setError('Select at least one irrigation day.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSave(
        {
          zoneId,
          label: label.trim(),
          days,
          startTime,
          durationMin,
          waterSourceId,
          skipOnRainMm,
          moistureCutoffPct,
        },
        editingSchedule?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
    >
      <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="schedule-modal-title" className="text-base font-semibold text-slate-900">
            {editingSchedule ? 'Edit Irrigation Schedule' : 'Create Irrigation Schedule'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Schedule Name
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Early Morning Drip — Short Rains Top-Up"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Gigiri Zone
              </label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Water Source
              </label>
              <select
                value={waterSourceId}
                onChange={(e) => setWaterSourceId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Active Days
            </span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => {
                const selected = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                      selected
                        ? 'bg-emerald-700 border-emerald-700 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Start (EAT)
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Duration (min)
              </label>
              <input
                type="number"
                min={5}
                max={120}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Rain Skip (mm)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={skipOnRainMm}
                onChange={(e) => setSkipOnRainMm(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                VWC Cutoff (%)
              </label>
              <input
                type="number"
                min={18}
                max={50}
                value={moistureCutoffPct}
                onChange={(e) => setMoistureCutoffPct(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : editingSchedule
                  ? 'Update Schedule'
                  : 'Save Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
