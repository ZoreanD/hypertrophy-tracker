'use client';

import { useEffect } from 'react';
import { syncTimezone } from '../actions/profile';

/**
 * Reports the device's IANA timezone to the profile once per mount. Renders
 * nothing.
 *
 * The user is never prompted: the browser already knows its zone, and asking
 * would be a worse experience than detecting it. The server action no-ops
 * unless the value actually changed, so travelling (or moving) fixes itself on
 * the next load, and older accounts get backfilled automatically.
 */
export default function TimezoneSync() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) void syncTimezone(tz);
    } catch {
      // Non-fatal: the profile keeps its stored zone (or the default).
    }
  }, []);

  return null;
}
