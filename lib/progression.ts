export function getProgressionSuggestion(history: {
  lastWeight: number;
  lastReps: number;
  lastRir: number;
  targetRepMax: number;
  targetRepMin: number;
  targetRir: number;
  positionChanged: boolean;
  lastExecutionOrder: number;
  currentExecutionOrder: number;
}) {
  const {
    lastWeight, lastReps, lastRir,
    targetRepMax, targetRepMin, targetRir,
    positionChanged, lastExecutionOrder, currentExecutionOrder,
  } = history;

  const hitTopOfRange = lastReps >= targetRepMax;
  const rirWasGood = lastRir >= targetRir;
  const increment = 5;

  let suggestedWeight = lastWeight;
  let suggestion = '';
  let flag: 'increase' | 'maintain' | 'decrease' | 'context_change' = 'maintain';

  if (positionChanged) {
    const orderDiff = currentExecutionOrder - lastExecutionOrder;
    const direction = orderDiff > 0 ? 'later' : 'earlier';
    flag = 'context_change';
    suggestion = `Last session: exercise ${lastExecutionOrder + 1}. Today: exercise ${currentExecutionOrder + 1} (${direction} in session).${
      direction === 'later' ? ' Expect ~5–15% fewer reps at same weight.' : ' You may perform better fresh.'
    }`;
    suggestedWeight = lastWeight;
  } else if (hitTopOfRange && rirWasGood) {
    suggestedWeight = lastWeight + increment;
    flag = 'increase';
    suggestion = `Last session: ${lastReps} reps @ ${lastWeight}lbs (${lastRir} RIR) — hit top of range. Try +${increment}lbs today.`;
  } else if (lastRir > targetRir + 1) {
    suggestedWeight = lastWeight + increment * 2;
    flag = 'increase';
    suggestion = `Last session: ${lastReps} reps @ ${lastWeight}lbs (${lastRir} RIR) — too much left in reserve. Consider +${increment * 2}lbs.`;
  } else {
    flag = 'maintain';
    suggestion = `Last session: ${lastReps} reps @ ${lastWeight}lbs (${lastRir} RIR). Target ${targetRepMin}–${targetRepMax} reps. Maintain weight.`;
  }

  return { suggestedWeight, suggestion, flag };
}