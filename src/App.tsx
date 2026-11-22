import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { LogsView } from './components/LogsView';
import { OverviewView } from './components/OverviewView';
import { ScheduleModal } from './components/ScheduleModal';
import { SchedulesView } from './components/SchedulesView';
import { Sidebar } from './components/Sidebar';
import { SourcesView } from './components/SourcesView';
import { TopBar } from './components/TopBar';
import { ZoneModal } from './components/ZoneModal';
import { ZonesView } from './components/ZonesView';
import type {
  GigiriWeather,
  IrrigationSchedule,
  IrrigationZone,
  NavSection,
  SystemState,
} from './types/irrigation';

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export default function App() {
  const [state, setState] = useState<SystemState | null>(null);
  const [weather, setWeather] = useState<GigiriWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<IrrigationSchedule | null>(null);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [busyZoneId, setBusyZoneId] = useState<string | null>(null);
  const [systemBusy, setSystemBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sysData, weatherData] = await Promise.all([
        apiJson<SystemState>('/api/state'),
        apiJson<GigiriWeather>('/api/weather'),
      ]);
      setState(sysData);
      setWeather(weatherData);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to reach Gigiri irrigation controller.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => {
      void apiJson<SystemState>('/api/state')
        .then((s) => setState(s))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    if (!actionFeedback) return;
    const t = setTimeout(() => setActionFeedback(null), 4500);
    return () => clearTimeout(t);
  }, [actionFeedback]);

  const handleToggleZone = async (
    zoneId: string,
    action: 'start' | 'stop',
    durationMin?: number,
    sourceId?: string
  ) => {
    setBusyZoneId(zoneId);
    setActionFeedback(null);
    try {
      const next = await apiJson<SystemState>(`/api/zones/${zoneId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ action, durationMin, sourceId }),
      });
      setState(next);
    } catch (err) {
      setActionFeedback(
        err instanceof Error ? err.message : 'Unable to switch solenoid valve.'
      );
    } finally {
      setBusyZoneId(null);
    }
  };

  const handleUpdateZone = async (
    zoneId: string,
    patch: Partial<IrrigationZone>
  ) => {
    const next = await apiJson<SystemState>(`/api/zones/${zoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setState(next);
  };

  const handleUpdateZoneSource = async (zoneId: string, sourceId: string) => {
    await handleUpdateZone(zoneId, { activeSourceId: sourceId });
  };

  const handleDeleteZone = async (zoneId: string) => {
    const next = await apiJson<SystemState>(`/api/zones/${zoneId}`, {
      method: 'DELETE',
    });
    setState(next);
  };

  const handleCreateZone = async (payload: {
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
  }) => {
    const next = await apiJson<SystemState>('/api/zones', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setState(next);
  };

  const handleSaveSchedule = async (
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
  ) => {
    const next = editId
      ? await apiJson<SystemState>(`/api/schedules/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      : await apiJson<SystemState>('/api/schedules', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
    setState(next);
  };

  const handleToggleSchedule = async (id: string, enabled: boolean) => {
    const next = await apiJson<SystemState>(`/api/schedules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
    setState(next);
  };

  const handleDeleteSchedule = async (id: string) => {
    const next = await apiJson<SystemState>(`/api/schedules/${id}`, {
      method: 'DELETE',
    });
    setState(next);
  };

  const handleEvaluateSchedule = async (id: string): Promise<string> => {
    const res = await apiJson<{ outcome: string; state: SystemState }>(
      `/api/schedules/${id}/evaluate`,
      { method: 'POST' }
    );
    setState(res.state);
    return res.outcome;
  };

  const handleRefillSource = async (sourceId: string, addLiters: number) => {
    const next = await apiJson<SystemState>(`/api/sources/${sourceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ addLiters }),
    });
    setState(next);
  };

  const handleUpdateSourceStatus = async (
    sourceId: string,
    status: 'active' | 'standby' | 'rationed' | 'maintenance'
  ) => {
    const next = await apiJson<SystemState>(`/api/sources/${sourceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setState(next);
  };

  const handleToggleRainHold = async () => {
    if (!state) return;
    setSystemBusy(true);
    try {
      const next = await apiJson<SystemState>('/api/system/rain-hold', {
        method: 'POST',
        body: JSON.stringify({ active: !state.rainHoldActive, hours: 24 }),
      });
      setState(next);
    } finally {
      setSystemBusy(false);
    }
  };

  const handleToggleEmergencyStop = async () => {
    if (!state) return;
    setSystemBusy(true);
    try {
      const next = await apiJson<SystemState>('/api/system/emergency-stop', {
        method: 'POST',
        body: JSON.stringify({ active: !state.emergencyStop }),
      });
      setState(next);
    } finally {
      setSystemBusy(false);
    }
  };

  const handleResetSystem = async () => {
    const next = await apiJson<SystemState>('/api/system/reset', {
      method: 'POST',
    });
    setState(next);
  };

  const activeValveCount = state
    ? state.zones.filter((z) => z.valveOpen).length
    : 0;
  const lowMoistureCount = state
    ? state.zones.filter((z) => z.moisturePct < z.targetMinPct).length
    : 0;

  return (
    <div className="relative min-h-screen flex bg-[#eef5f0] text-slate-900">
      {/* Subtle scenic Gigiri ambient background behind content canvas */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 opacity-25 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/src/assets/images/gigiri_karura_canopy_bg_1795349215138.jpg')",
        }}
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-br from-[#eef6f0]/92 via-[#f4f8f5]/90 to-[#e6f2f7]/92"
      />

      <div className="relative z-10 flex flex-1 min-w-0">
        <Sidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          activeValveCount={activeValveCount}
          lowMoistureCount={lowMoistureCount}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar
            activeSection={activeSection}
            rainHoldActive={state?.rainHoldActive ?? false}
            onToggleRainHold={handleToggleRainHold}
            onOpenNewSchedule={() => {
              setEditingSchedule(null);
              setScheduleModalOpen(true);
            }}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            busy={systemBusy || !state}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
            {actionFeedback && (
              <div
                role="alert"
                className="mb-5 px-4 py-3 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4"
              >
                <span>{actionFeedback}</span>
                <button
                  type="button"
                  onClick={() => setActionFeedback(null)}
                  className="text-amber-800 hover:text-amber-950 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {loading ? (
              <div className="space-y-6" aria-busy="true" aria-label="Loading Gigiri dashboard">
                <div className="h-44 bg-white/80 border border-emerald-950/10 rounded-xl animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 bg-white/80 border border-emerald-950/10 rounded-xl p-5 animate-pulse"
                    />
                  ))}
                </div>
                <div className="h-96 bg-white/80 border border-emerald-950/10 rounded-xl animate-pulse" />
              </div>
            ) : errorMsg || !state ? (
              <div className="bg-white/95 border border-emerald-950/10 rounded-xl p-10 text-center space-y-3">
                <p className="text-base font-semibold text-slate-900">
                  Unable to load Gigiri irrigation controller
                </p>
                <p className="text-sm text-slate-500">{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    void loadData();
                  }}
                  className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
                >
                  Retry Connection
                </button>
              </div>
            ) : (
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeSection === 'overview' && (
                  <OverviewView
                    state={state}
                    weather={weather}
                    onToggleZone={handleToggleZone}
                    onUpdateZoneSource={handleUpdateZoneSource}
                    onToggleEmergencyStop={handleToggleEmergencyStop}
                    onToggleRainHold={handleToggleRainHold}
                    onNavigate={setActiveSection}
                    busyZoneId={busyZoneId}
                  />
                )}

                {activeSection === 'zones' && (
                  <ZonesView
                    zones={state.zones}
                    sources={state.sources}
                    weather={weather}
                    onToggleZone={handleToggleZone}
                    onUpdateZone={handleUpdateZone}
                    onDeleteZone={handleDeleteZone}
                    onOpenNewZone={() => setZoneModalOpen(true)}
                    busyZoneId={busyZoneId}
                  />
                )}

                {activeSection === 'schedules' && (
                  <SchedulesView
                    schedules={state.schedules}
                    zones={state.zones}
                    sources={state.sources}
                    rainHoldActive={state.rainHoldActive}
                    onToggleSchedule={handleToggleSchedule}
                    onDeleteSchedule={handleDeleteSchedule}
                    onEvaluateSchedule={handleEvaluateSchedule}
                    onEditSchedule={(sch) => {
                      setEditingSchedule(sch);
                      setScheduleModalOpen(true);
                    }}
                    onOpenNewSchedule={() => {
                      setEditingSchedule(null);
                      setScheduleModalOpen(true);
                    }}
                  />
                )}

                {activeSection === 'sources' && (
                  <SourcesView
                    sources={state.sources}
                    dailyBalance={state.dailyBalance}
                    todayCostKes={state.todayCostKes}
                    onRefillSource={handleRefillSource}
                    onUpdateStatus={handleUpdateSourceStatus}
                  />
                )}

                {activeSection === 'logs' && (
                  <LogsView logs={state.logs} onResetSystem={handleResetSystem} />
                )}
              </motion.div>
            )}
          </main>
        </div>
      </div>

      {state && (
        <>
          <ScheduleModal
            open={scheduleModalOpen}
            onClose={() => {
              setScheduleModalOpen(false);
              setEditingSchedule(null);
            }}
            zones={state.zones}
            sources={state.sources}
            editingSchedule={editingSchedule}
            onSave={handleSaveSchedule}
          />
          <ZoneModal
            open={zoneModalOpen}
            onClose={() => setZoneModalOpen(false)}
            sources={state.sources}
            onCreate={handleCreateZone}
          />
        </>
      )}
    </div>
  );
}
