import { useMemo, useState } from 'react';
import { Download, Printer, RotateCcw, Search } from 'lucide-react';
import type { IrrigationLog, LogEventType } from '../types/irrigation';

interface LogsViewProps {
  logs: IrrigationLog[];
  onResetSystem: () => Promise<void>;
}

type LogFilter = 'all' | 'runs' | 'skips' | 'alerts';

const EVENT_LABELS: Record<LogEventType, { label: string; tone: string }> = {
  cycle_complete: { label: 'Cycle Complete', tone: 'text-emerald-700' },
  manual_start: { label: 'Manual Start', tone: 'text-sky-700' },
  manual_stop: { label: 'Manual Stop', tone: 'text-slate-700' },
  rain_skip: { label: 'Rain Skip', tone: 'text-sky-800' },
  moisture_skip: { label: 'Moisture Guard', tone: 'text-emerald-800' },
  alert: { label: 'System Alert', tone: 'text-amber-700' },
  refill: { label: 'Tank Refill', tone: 'text-sky-700' },
};

export function LogsView({ logs, onResetSystem }: LogsViewProps) {
  const [filter, setFilter] = useState<LogFilter>('all');
  const [query, setQuery] = useState('');
  const [bannerError, setBannerError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (
        filter === 'runs' &&
        !['cycle_complete', 'manual_start', 'manual_stop'].includes(log.eventType)
      ) {
        return false;
      }
      if (
        filter === 'skips' &&
        !['rain_skip', 'moisture_skip'].includes(log.eventType)
      ) {
        return false;
      }
      if (filter === 'alerts' && log.eventType !== 'alert') {
        return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          log.zoneName.toLowerCase().includes(q) ||
          log.sourceName.toLowerCase().includes(q) ||
          log.note.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, filter, query]);

  const totalLoggedLiters = filteredLogs.reduce(
    (sum, l) => (l.eventType === 'refill' ? sum : sum + l.litersUsed),
    0
  );
  const skipCount = filteredLogs.filter(
    (l) => l.eventType === 'rain_skip' || l.eventType === 'moisture_skip'
  ).length;

  const handleDownloadCsv = () => {
    const header = ['Timestamp', 'Zone', 'Event', 'Duration (min)', 'Liters', 'Source', 'Notes'];
    const rows = filteredLogs.map((l) => [
      l.timestamp,
      `"${l.zoneName.replace(/"/g, '""')}"`,
      EVENT_LABELS[l.eventType].label,
      String(l.durationMin),
      String(l.litersUsed),
      `"${l.sourceName.replace(/"/g, '""')}"`,
      `"${l.note.replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gigiri-irrigation-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Scenic Nursery Mist Masthead */}
      <section className="relative h-36 rounded-2xl overflow-hidden border border-emerald-950/15 bg-[#0b281e]">
        {!bannerError ? (
          <img
            src="/src/assets/images/gigiri_nursery_mist_1795349212863.jpg"
            alt="Shadehouse nursery micro-mist irrigation in Gigiri"
            referrerPolicy="no-referrer"
            onError={() => setBannerError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 to-emerald-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#072017]/92 via-[#0b281e]/72 to-transparent" />
        <div className="relative z-10 h-full p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
          <div>
            <p className="text-xs text-emerald-200">
              {filteredLogs.length} Events · {totalLoggedLiters.toLocaleString()} L Logged · {skipCount} Smart Water Skips
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold mt-0.5">
              Irrigation Ledger & Water Audit Trail
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print self-start sm:self-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-black/35 border border-white/25 text-white rounded-lg hover:bg-black/50 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-white text-slate-900 rounded-lg hover:bg-emerald-50 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-white/80 backdrop-blur-sm border border-emerald-950/10 rounded-lg self-start">
          {(
            [
              { id: 'all', label: 'All Events' },
              { id: 'runs', label: 'Valve Runs' },
              { id: 'skips', label: 'Rain & Moisture Skips' },
              { id: 'alerts', label: 'Alerts' },
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

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white/95 border border-emerald-950/15 rounded-lg focus:outline-none focus:border-emerald-700"
            />
          </div>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Baseline</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-amber-900 font-medium">Restore Gigiri baseline?</span>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onResetSystem();
                  setConfirmReset(false);
                }}
                className="font-semibold text-red-700 hover:text-red-800"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white/95 backdrop-blur-sm border border-emerald-950/10 rounded-xl overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">No log entries found</p>
            <p className="text-xs text-slate-500">
              Try adjusting your event filter or search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-950/10 bg-emerald-50/40 text-xs text-slate-600">
                  <th className="py-3 px-4 text-left font-medium">Timestamp (EAT)</th>
                  <th className="py-3 px-4 text-left font-medium">Event</th>
                  <th className="py-3 px-4 text-left font-medium">Sector & Notes</th>
                  <th className="py-3 px-4 text-left font-medium">Water Source</th>
                  <th className="py-3 px-4 text-right font-medium">Duration</th>
                  <th className="py-3 px-4 text-right font-medium">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const meta = EVENT_LABELS[log.eventType];
                  const formattedTime = new Date(log.timestamp).toLocaleString('en-KE', {
                    timeZone: 'Africa/Nairobi',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });

                  return (
                    <tr key={log.id} className="hover:bg-emerald-50/35">
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                        {formattedTime}
                      </td>
                      <td className={`py-3 px-4 text-xs font-semibold whitespace-nowrap ${meta.tone}`}>
                        {meta.label}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs font-semibold text-slate-900">
                          {log.zoneName}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">{log.note}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-sky-800 whitespace-nowrap">
                        {log.sourceName.split('(')[0].trim()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                        {log.durationMin > 0 ? `${log.durationMin}m` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-900 font-medium">
                        {log.litersUsed > 0 ? `${log.litersUsed.toLocaleString()} L` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
