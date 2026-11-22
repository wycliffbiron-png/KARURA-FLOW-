import type { IrrigationZone } from '../types/irrigation';

export interface ZoneAgronomyMetrics {
  etcMmDay: number;
  availableWaterMm: number;
  netDeficitMm: number;
  litersRequired: number;
  recommendedMinutes: number;
  daysUntilTrigger: number;
  applicationRateMmHr: number;
}

export function computeZoneAgronomy(
  zone: IrrigationZone,
  et0MmDay = 3.7,
  todayForecastRainMm = 0
): ZoneAgronomyMetrics {
  const kc = zone.kc || 0.85;
  const rootDepthMm = zone.rootDepthMm || 300;
  const wiltingPoint = zone.wiltingPointPct || 15;
  const nominalFlow = zone.nominalFlowLpm || 60;

  const etcMmDay = Number((et0MmDay * kc).toFixed(2));
  const availableWaterMm = Math.max(
    0,
    Number((((zone.moisturePct - wiltingPoint) / 100) * rootDepthMm).toFixed(1))
  );
  const triggerWaterMm = Math.max(
    0,
    ((zone.targetMinPct - wiltingPoint) / 100) * rootDepthMm
  );

  const deficitToTargetMaxMm = Math.max(
    0,
    ((zone.targetMaxPct - zone.moisturePct) / 100) * rootDepthMm
  );

  // Effective infiltration on Gigiri Humic Nitisol (~75% of rainfall enters root zone)
  const effectiveRainMm = todayForecastRainMm * 0.75;
  const netDeficitMm = Math.max(
    0,
    Number((deficitToTargetMaxMm - effectiveRainMm).toFixed(1))
  );

  // 1 mm depth over 1 ha = 10,000 liters
  const litersRequired = Math.round(netDeficitMm * zone.areaHa * 10000);
  const rawMinutes = litersRequired / Math.max(20, nominalFlow);
  const recommendedMinutes =
    netDeficitMm < 0.8 ? 0 : Math.min(90, Math.max(10, Math.round(rawMinutes)));

  const daysUntilTrigger =
    etcMmDay > 0
      ? Math.max(0, Number(((availableWaterMm - triggerWaterMm) / etcMmDay).toFixed(1)))
      : 7;

  const applicationRateMmHr = Number(
    ((nominalFlow * 60) / Math.max(0.05 * 10000, zone.areaHa * 10000)).toFixed(2)
  );

  return {
    etcMmDay,
    availableWaterMm,
    netDeficitMm,
    litersRequired,
    recommendedMinutes,
    daysUntilTrigger,
    applicationRateMmHr,
  };
}
