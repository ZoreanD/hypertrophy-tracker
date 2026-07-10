// CST = UTC-6 (CDT = UTC-5, but hardcoding CST for now) — matches the same
// offset used in app/dashboard/page.tsx, app/calendar/CalendarView.tsx, and
// app/workout/new/page.tsx.
const CDT_OFFSET = 5 * 60 * 60 * 1000;

export function getTodayBoundsUTC() {
  const todayDateStr = new Date(Date.now() - CDT_OFFSET).toISOString().split('T')[0];
  return {
    start: new Date(todayDateStr + 'T00:00:00.000Z'),
    end: new Date(todayDateStr + 'T23:59:59.999Z'),
  };
}
