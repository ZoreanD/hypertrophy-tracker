// Timezone-correct "what day is it" helpers.
//
// These replace a hardcoded `Date.now() - 5*60*60*1000` that was used in several
// places to mean "today in Central". That trick is wrong in two ways: it pins
// every user to one timezone, and UTC-5 is Central *daylight* time only — for
// roughly four months a year Central is UTC-6, so anything logged between local
// midnight and 1am was attributed to the wrong day. Year boundaries were the
// worst case: a Dec 31 late-evening session could be recorded as January.
//
// Intl carries the real IANA timezone database, so DST is handled for us.

// Used when a profile has no timezone recorded yet (older accounts).
export const DEFAULT_TIMEZONE = 'America/Chicago';

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(tz: string | null | undefined): string {
  return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** YYYY-MM-DD for an instant, as seen in `timeZone`. */
export function dayInZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** Today's YYYY-MM-DD in `timeZone`. */
export function todayInZone(timeZone: string): string {
  return dayInZone(new Date(), timeZone);
}

/**
 * The UTC instant range covering a calendar day in `timeZone` — for querying
 * DateTime columns that hold day-valued data.
 */
export function dayRangeUtc(day: string, timeZone: string): { start: Date; end: Date } {
  // Offset of `timeZone` at roughly midday on that day (midday avoids the DST
  // transition hours, which are never at noon).
  const probe = new Date(`${day}T12:00:00Z`);
  const asSeen = new Date(
    new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(probe).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, '$3-$1-$2T$4:$5:$6Z')
  );
  const offsetMs = probe.getTime() - asSeen.getTime();
  const start = new Date(new Date(`${day}T00:00:00Z`).getTime() + offsetMs);
  const end = new Date(new Date(`${day}T23:59:59.999Z`).getTime() + offsetMs);
  return { start, end };
}
