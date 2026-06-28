'use client';

import { useEffect } from 'react';
import { ensurePushSubscription } from '../../lib/pushClient';

// Mounted app-wide. Silently (no prompt) ensures this device's push
// subscription is registered whenever notifications are already granted, so
// followers stay reachable without having to open a workout first.
export default function PushRegistrar() {
  useEffect(() => {
    ensurePushSubscription({ prompt: false });
  }, []);
  return null;
}
