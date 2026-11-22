import { CloudRain, Menu, Plus } from 'lucide-react';
import type { NavSection } from '../types/irrigation';

interface TopBarProps {
  activeSection: NavSection;
  rainHoldActive: boolean;
  onToggleRainHold: () => void;
  onOpenNewSchedule: () => void;
  onOpenMobileMenu: () => void;
  busy: boolean;
}

const SECTION_LABELS: Record<NavSection, string> = {
  overview: 'Overview',
  zones: 'Zones & Valves',
  schedules: 'Schedules',
  sources: 'Water Sources & Storage',
  logs: 'Activity Logs',
};

export function TopBar({
  activeSection,
  rainHoldActive,
  onToggleRainHold,
  onOpenNewSchedule,
  onOpenMobileMenu,
  busy,
}: TopBarProps) {
  return (
    <header className="h-16 bg-white/85 backdrop-blur-md border-b border-emerald-950/10 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-emerald-800/70 font-medium whitespace-nowrap hidden sm:inline">
            Gigiri Estate
          </span>
          <span className="text-emerald-900/25 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-semibold text-slate-900 truncate">
            {SECTION_LABELS[activeSection]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          disabled={busy}
          onClick={onToggleRainHold}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50 ${
            rainHoldActive
              ? 'bg-sky-600 border-sky-600 text-white hover:bg-sky-700'
              : 'bg-sky-50/70 border-sky-200 text-sky-900 hover:bg-sky-100/80'
          }`}
        >
          <CloudRain className="w-4 h-4 shrink-0" />
          <span>{rainHoldActive ? 'Clear Rain Hold' : 'Rain Hold 24h'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenNewSchedule}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>New Schedule</span>
        </button>
      </div>
    </header>
  );
}
