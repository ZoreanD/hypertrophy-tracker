// Rotating "rest complete" nudges. Keep in sync with the copy in public/sw.js
// (the service worker can't import this module).
export const REST_MESSAGES = [
  'Time to log your next set.',
  "Rest's up — back to the iron.",
  'Recovered? Go get the next one.',
  'Your next set is waiting.',
  "Break's over. Let's move.",
  'Hop back in and log it.',
  "One more set — you've got this.",
  'The bar is calling your name.',
  "Don't let it cool down. Next set!",
  'Back to work, champ.',
  "Gains don't make themselves. Next set!",
  'Stop scrolling, start lifting. 💪',
];

export function pickRestMessage(): string {
  return REST_MESSAGES[Math.floor(Math.random() * REST_MESSAGES.length)];
}
