import { useState } from 'react';
import {
  CalendarClock,
  ClipboardList,
  Droplets,
  LayoutGrid,
  MapPin,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { NavSection } from '../types/irrigation';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  activeValveCount: number;
  lowMoistureCount: number;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'zones', label: 'Zones & Valves', icon: MapPin },
  { id: 'schedules', label: 'Schedules', icon: CalendarClock },
  { id: 'sources', label: 'Water Sources', icon: Droplets },
  { id: 'logs', label: 'Activity Logs', icon: ClipboardList },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  mobileOpen,
  onCloseMobile,
  activeValveCount,
  lowMoistureCount,
}: SidebarProps) {
  const [avatarError, setAvatarError] = useState(false);

  const navContent = (
    <div className="relative flex h-full flex-col justify-between bg-[#0b281e] text-emerald-50 border-r border-emerald-950/60 overflow-hidden">
      {/* Subtle botanical foliage backdrop texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-15 bg-cover bg-center pointer-events-none"
        style={{
          backgroundImage:
            "url('/src/assets/images/gigiri_karura_canopy_bg_1795349215138.jpg')",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#082018]/92 via-[#0b281e]/94 to-[#071a13]/98 pointer-events-none"
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between px-6 h-16 border-b border-emerald-800/40">
          <button
            type="button"
            onClick={() => {
              onSelectSection('overview');
              onCloseMobile();
            }}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            Karura Flow
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-2 -mr-2 text-emerald-200 hover:text-white rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav aria-label="Primary navigation" className="px-3 py-5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const countText =
              item.id === 'zones' && activeValveCount > 0
                ? `${activeValveCount} open`
                : item.id === 'zones' && lowMoistureCount > 0
                  ? `${lowMoistureCount} dry`
                  : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${
                  isActive
                    ? 'bg-emerald-500/20 text-white border border-emerald-400/25'
                    : 'text-emerald-100/75 hover:bg-white/10 hover:text-white border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-emerald-300' : 'text-emerald-300/60'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {countText && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      activeValveCount > 0 ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {countText}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mx-4 mt-4 pt-5 border-t border-emerald-800/40 space-y-2 text-xs text-emerald-200/70">
          <div className="flex items-center justify-between">
            <span>Station</span>
            <span className="font-mono text-emerald-50 tabular-nums">Gigiri · 1,720m</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Soil Profile</span>
            <span className="text-emerald-50">Red Kikuyu Loam</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Timezone</span>
            <span className="font-mono text-emerald-50">EAT (UTC+3)</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 p-4 border-t border-emerald-800/40 bg-[#071c15]/60">
        <div className="flex items-center gap-3">
          {!avatarError ? (
            <img
              src="/src/assets/images/avatar_estate_manager_1795348438487.jpg"
              alt="Wanjiku Kamau, Lead Estate Agronomist"
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="w-10 h-10 rounded-lg object-cover border border-emerald-400/30 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-emerald-800 border border-emerald-600/40 flex items-center justify-center text-xs font-semibold text-white shrink-0">
              WK
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">Wanjiku Kamau</p>
            <p className="text-xs text-emerald-200/75 truncate flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 shrink-0" />
              <span>Estate Agronomist</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">{navContent}</div>
        </div>
      )}
    </>
  );
}
