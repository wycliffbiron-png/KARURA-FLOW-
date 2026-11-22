import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { WaterSource } from '../types/irrigation';

interface ZoneModalProps {
  open: boolean;
  onClose: () => void;
  sources: WaterSource[];
  onCreate: (payload: {
    name: string;
    sector: string;
    areaHa: number;
    cropType: string;
    soilType: string;
    emitterType: string;
    kc: number;
    rootDepthMm: number;
    nominalFlowLpm: number;
    targetMinPct: number;
    targetMaxPct: number;
    activeSourceId: string;
  }) => Promise<void>;
}

export function ZoneModal({ open, onClose, sources, onCreate }: ZoneModalProps) {
  const [name, setName] = useState('');
  const [sector, setSector] = useState('Sector 7 · Gigiri North');
  const [areaHa, setAreaHa] = useState(0.9);
  const [cropType, setCropType] = useState('');
  const [soilType, setSoilType] = useState('Humic Nitisol (Red Kikuyu Loam)');
  const [emitterType, setEmitterType] = useState('Pressure-Compensating Drip');
  const [kc, setKc] = useState(0.85);
  const [rootDepthMm, setRootDepthMm] = useState(300);
  const [nominalFlowLpm, setNominalFlowLpm] = useState(56);
  const [targetMinPct, setTargetMinPct] = useState(24);
  const [targetMaxPct, setTargetMaxPct] = useState(34);
  const [activeSourceId, setActiveSourceId] = useState(sources[0]?.id || 'src-borehole-a');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cropType.trim()) {
      setError('Enter both zone name and vegetation or crop type.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onCreate({
        name: name.trim(),
        sector: sector.trim(),
        areaHa,
        cropType: cropType.trim(),
        soilType,
        emitterType,
        kc,
        rootDepthMm,
        nominalFlowLpm,
        targetMinPct,
        targetMaxPct,
        activeSourceId,
      });
      setName('');
      setCropType('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add zone.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zone-modal-title"
    >
      <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="zone-modal-title" className="text-base font-semibold text-slate-900">
            Commission Gigiri Irrigation Zone
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Zone Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Daisy Drive Courtyard"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Sector / Road Reference
              </label>
              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Vegetation / Crop Type
              </label>
              <input
                type="text"
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                placeholder="e.g. Bougainvillea & Lawn Turf"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Area (Hectares)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="20"
                value={areaHa}
                onChange={(e) => setAreaHa(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Soil Profile
              </label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              >
                <option>Humic Nitisol (Red Kikuyu Loam)</option>
                <option>Forest Humus over Red Loam</option>
                <option>Amended Compost Red Loam</option>
                <option>Well-Drained Upland Clay Loam</option>
                <option>Coco-Pumice Propagation Media</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Emitter Hardware
              </label>
              <select
                value={emitterType}
                onChange={(e) => setEmitterType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              >
                <option>Pressure-Compensating Drip</option>
                <option>Subsurface Drip + Pop-up Rotors</option>
                <option>MP Rotator Micro-Sprays</option>
                <option>16mm Inline Drip Tape</option>
                <option>8 L/hr Adjustable Bubbler Stakes</option>
                <option>Overhead Fogger & Micro-Mist</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Crop Kc
              </label>
              <input
                type="number"
                step="0.05"
                min={0.4}
                max={1.25}
                value={kc}
                onChange={(e) => setKc(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Root Depth (mm)
              </label>
              <input
                type="number"
                step="20"
                min={100}
                max={1000}
                value={rootDepthMm}
                onChange={(e) => setRootDepthMm(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Flow (L/min)
              </label>
              <input
                type="number"
                min={15}
                max={200}
                value={nominalFlowLpm}
                onChange={(e) => setNominalFlowLpm(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Min VWC (%)
              </label>
              <input
                type="number"
                min={14}
                max={40}
                value={targetMinPct}
                onChange={(e) => setTargetMinPct(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Max VWC (%)
              </label>
              <input
                type="number"
                min={20}
                max={55}
                value={targetMaxPct}
                onChange={(e) => setTargetMaxPct(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Primary Source
              </label>
              <select
                value={activeSourceId}
                onChange={(e) => setActiveSourceId(e.target.value)}
                className="w-full px-2.5 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name.split('(')[0].trim()}
                  </option>
                ))}
              </select>
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
              {submitting ? 'Commissioning...' : 'Add Zone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
