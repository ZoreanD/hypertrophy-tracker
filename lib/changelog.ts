// "What's New" entries, newest FIRST.
//
// This ships with the deploy, so adding an entry here is what makes the popup
// appear — there's no separate CMS or database to keep in sync. Bump `version`
// whenever you want the card to resurface; users who already dismissed the
// current version won't see it again until it changes.
//
// Only the newest WHATS_NEW_LIMIT entries are ever shown; older ones age out.

export const CHANGELOG_VERSION = '2026.08.28';
export const WHATS_NEW_LIMIT = 5;

export type ChangelogEntry = {
  date: string;      // YYYY-MM-DD
  title: string;
  body: string;
  tag?: 'new' | 'fix' | 'improved';
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-08-28',
    title: 'Compares like with like',
    body: "An exercise done last, on already-fatigued muscles, is now compared against the last time it ran in that slot — not against a day you did it fresh. Less weight at the end of a session isn't a decline, and it's no longer treated as one.",
    tag: 'new',
  },
  {
    date: '2026-08-28',
    title: 'One bad day is no longer a deload signal',
    body: 'A decline now has to clear normal day-to-day variation and repeat across two sessions before the app suggests deloading. Holding steady is reported as a plateau, which is normal and not a warning.',
    tag: 'fix',
  },
  {
    date: '2026-08-28',
    title: 'Drop sets counted honestly',
    body: 'Drop-set and myo-rep fragments still count as volume, but no longer set estimated 1RMs — a fatigued set understates what you can actually lift. This also removes a phantom PR that appeared on every drop-set session.',
    tag: 'fix',
  },
  {
    date: '2026-08-28',
    title: 'Rest reminder between sets',
    body: "If reps fall unusually steeply AND you cut the rest short, a brief note now appears suggesting a longer rest — because short rest, not the weight, is often the cause.",
    tag: 'new',
  },
  {
    date: '2026-08-27',
    title: 'Assisted machines chart correctly',
    body: 'Progress graphs treated a lower pin on an assisted machine as a lighter set, when it actually means less help and a harder rep — so getting stronger plotted as a decline. They now chart the load you truly worked against.',
    tag: 'fix',
  },
  {
    date: '2026-08-27',
    title: 'Backing off mid-workout is no longer read as regression',
    body: "Going heavy on set 1, missing the range, then dropping weight to hit it is autoregulation — your top-end load never moved. The app now records your heaviest set as the day's best instead of the lighter back-off set, and only warns about a load drop if your actual top-end load fell.",
    tag: 'fix',
  },
  {
    date: '2026-08-27',
    title: 'Reps falling across sets is normal',
    body: 'Losing reps set to set is fatigue, not proof the weight was too heavy — pooled data has set 3 around 55% of set 1. The app now judges the load from set 1, the only one you take fresh, and says so instead of leaving you guessing.',
    tag: 'new',
  },
  {
    date: '2026-08-26',
    title: 'Added exercises remember your history',
    body: 'An exercise you add mid-workout now loads its own past sessions, so the weight prefills and the "last time" reference shows up instead of starting blank.',
    tag: 'fix',
  },
  {
    date: '2026-08-26',
    title: 'Progression notices when the weight went down',
    body: "If your load dropped last session, you'll be told to work back to it rather than to add weight on top of it. The reference numbers now stay visible when an exercise moves position too.",
    tag: 'fix',
  },
  {
    date: '2026-08-26',
    title: 'Private ideas and voting',
    body: 'Suggestions can be public or private. Public ones can be voted up or down, and the most-wanted open ideas rise to the top.',
    tag: 'new',
  },
  {
    date: '2026-08-25',
    title: 'Deloads and comebacks are understood',
    body: "Mark a session as a deload, and the app stops reading the lighter weights as failure. After a real break it offers a scaled starting load instead — and it measures breaks from sets you actually logged, so moving days around your week never counts as time off.",
    tag: 'new',
  },
  {
    date: '2026-08-25',
    title: 'End an exercise early',
    body: 'Two sets was enough today? Tap "Done with this exercise" — it keeps everything you logged and records it as a choice rather than a shortfall.',
    tag: 'new',
  },
  {
    date: '2026-08-25',
    title: 'Suggestion box',
    body: 'New Ideas tab. Leave a request or a gripe, see what everyone else has asked for, and watch items move from new to planned to shipped.',
    tag: 'new',
  },
  {
    date: '2026-08-25',
    title: 'Nudges when you have been away',
    body: 'If a week passes with nothing logged, you will get a reminder — and it explains what is actually happening to your muscle at one, two, three and four weeks, plus how to come back.',
    tag: 'new',
  },
  {
    date: '2026-08-11',
    title: 'Accurate workout duration',
    body: 'Session length is now tracked on the server, so checking the dashboard mid-workout (or the app restarting) no longer restarts the clock and under-reports your time.',
    tag: 'fix',
  },
  {
    date: '2026-08-11',
    title: 'More reliable rest alerts',
    body: 'The rest notification is now queued the moment your rest starts instead of when you leave the app, so it no longer gets lost if the phone freezes the page on the way out.',
    tag: 'fix',
  },
  {
    date: '2026-08-11',
    title: 'Reopen keeps your exercises',
    body: 'Reopening a workout you added exercises to mid-session now restores them along with everything you logged.',
    tag: 'fix',
  },
  {
    date: '2026-08-11',
    title: 'Set input safeguards',
    body: 'Impossible values (negative weights or reps, absurd loads) are now rejected instead of quietly saved, so they can\'t skew your estimated 1RMs or totals.',
    tag: 'fix',
  },
  {
    date: '2026-08-10',
    title: 'Year in Review',
    body: 'Your training year as a tap-through recap — totals, biggest strength jumps, and a title. Opens each December; save the card to keep it.',
    tag: 'new',
  },
  {
    date: '2026-08-10',
    title: 'Timezone-aware dates',
    body: 'The app now uses your device\'s real timezone instead of a fixed offset, so late-night sessions land on the correct day (and the correct year).',
    tag: 'fix',
  },
  {
    date: '2026-08-10',
    title: 'Unilateral sets count once',
    body: 'A left + right pair now counts as one working set in your summary and weekly volume, instead of two. Expect single-arm volume to read lower — and truer.',
    tag: 'fix',
  },
  {
    date: '2026-08-10',
    title: 'More hammer curls',
    body: 'Added preacher (dumbbell, EZ bar, machine), standing, seated, incline, and machine hammer curl variations.',
    tag: 'new',
  },
  {
    date: '2026-08-10',
    title: 'No more buzzing mid-workout',
    body: 'The rest-timer notification no longer fires while you already have the app open.',
    tag: 'fix',
  },
  {
    date: '2026-08-09',
    title: 'Drag to reorder',
    body: 'Grab the grip handle to drag an exercise up or down; completed exercises stay locked in place.',
    tag: 'improved',
  },
  {
    date: '2026-08-09',
    title: 'Plan any month',
    body: 'The calendar now loads past and future months, so you can review history or schedule ahead.',
    tag: 'improved',
  },
];

export function recentChangelog(): ChangelogEntry[] {
  return CHANGELOG.slice(0, WHATS_NEW_LIMIT);
}
