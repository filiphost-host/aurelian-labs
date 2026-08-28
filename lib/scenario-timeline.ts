export type TimelineStressEvent = {
  id: string;
  name: string;
  shortLabel: string;
  date: string;
  impactPercent: number;
  recoveryMonths: number;
  recap: string;
};

export type ScenarioTimelinePoint = {
  timestamp: number;
  date: string;
  baselineNok: number;
  portfolioNok: number;
  eventName: string | null;
  eventRecap: string | null;
  eventImpactPercent: number | null;
};

function monthIndex(date: string) {
  const [year, month] = date.split("-").map(Number);
  return year * 12 + month - 1;
}

export function buildScenarioTimeline(
  capitalNok: number,
  events: TimelineStressEvent[],
  start = "2006-01",
  end = "2028-12",
  annualGrowth = 0.055,
): ScenarioTimelinePoint[] {
  const startMonth = monthIndex(start);
  const endMonth = monthIndex(end);
  const eventMonths = events.map((event) => ({ ...event, month: monthIndex(event.date) }));

  return Array.from({ length: endMonth - startMonth + 1 }, (_, offset) => {
    const currentMonth = startMonth + offset;
    const year = Math.floor(currentMonth / 12);
    const month = currentMonth % 12;
    const date = `${year}-${String(month + 1).padStart(2, "0")}`;
    const baselineNok = capitalNok * ((1 + annualGrowth) ** (offset / 12));
    let combinedEffect = 0;
    let closest: (typeof eventMonths)[number] | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const event of eventMonths) {
      const distance = currentMonth - event.month;
      const leadMonths = 5;
      if (distance >= -leadMonths) {
        const shape = distance <= 0
          ? Math.max(0, 1 + distance / leadMonths)
          : Math.exp(-distance / Math.max(1, event.recoveryMonths));
        combinedEffect += event.impactPercent / 100 * shape;
      }
      const absoluteDistance = Math.abs(distance);
      if (absoluteDistance <= 5 && absoluteDistance < closestDistance) {
        closest = event;
        closestDistance = absoluteDistance;
      }
    }

    return {
      timestamp: Date.UTC(year, month, 1),
      date,
      baselineNok,
      portfolioNok: Math.max(0, baselineNok * (1 + combinedEffect)),
      eventName: closest?.name ?? null,
      eventRecap: closest?.recap ?? null,
      eventImpactPercent: closest?.impactPercent ?? null,
    };
  });
}

