// "What's New" entries, newest FIRST.
//
// This ships with the deploy, so adding an entry here is what makes the popup
// appear — there's no separate CMS or database to keep in sync. Bump `version`
// whenever you want the card to resurface; users who already dismissed the
// current version won't see it again until it changes.
//
// Only the newest WHATS_NEW_LIMIT entries are ever shown; older ones age out.

export const CHANGELOG_VERSION = '2026.08.11';
export const WHATS_NEW_LIMIT = 5;

export type ChangelogEntry = {
  date: string;      // YYYY-MM-DD
  title: string;
  body: string;
  tag?: 'new' | 'fix' | 'improved';
};

export const CHANGELOG: ChangelogEntry[] = [
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
