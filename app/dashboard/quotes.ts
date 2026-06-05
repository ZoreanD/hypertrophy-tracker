export const TRAINING_QUOTES = [
  // ── Exercise Science ───────────────────────────────────────────
  "Progressive overload is the single most important driver of hypertrophy. — Dr. Brad Schoenfeld",
  "The best program is the one you'll actually follow consistently.",
  "Proximity to failure matters more than the number of sets.",
  "Volume is the primary driver of hypertrophy. Intensity is the secondary driver.",
  "A muscle that is never trained close to failure will adapt slowly, if at all.",
  "Consistency over years beats intensity over weeks.",
  "RIR 1-2 on working sets is the sweet spot for hypertrophy and recovery.",
  "MEV is the floor. MAV is the target. MRV is the ceiling. Stay between them.",
  "Supersets save time without sacrificing hypertrophy when muscles don't overlap.",
  "Sleep is the most anabolic thing you can do outside the gym.",
  "Protein synthesis peaks around 20-40g per meal. Spread it across the day.",
  "The stretch position of an exercise drives more hypertrophy than the contracted position.",
  "Deloads are not optional — they are programmed recovery.",
  "The long head of the triceps requires overhead work. Pushdowns alone aren't enough.",
  "Upper chest responds to 30-45° incline. Flat and decline hit mid and lower chest.",
  "Rear delts are a pull muscle. They belong on pull day, not push day.",
  "Myo-rep sets are time-efficient — one activation set plus mini sets approaches full volume.",
  "Drop sets extend a set past failure by reducing load. Use them sparingly.",
  "e1RM = weight × (1 + reps/30). Track it over time to measure true progression.",
  "Unilateral training reveals strength imbalances that bilateral work can mask.",
  "The mind-muscle connection is real. EMG studies confirm focused contraction increases activation.",
  "Compound movements build mass. Isolation movements refine it.",
  "Calories in vs calories out determines weight. Protein and training determines composition.",
  "Rest periods of 2-3 minutes between sets produce greater hypertrophy than 1 minute.",
  "Your weakest muscle group deserves your first working sets when you're freshest.",

  // ── Dragon Ball ────────────────────────────────────────────────
  "Power comes in response to a need, not a desire. You have to create that need. — Goku",
  "I do not fear this new challenge. Rather like a true warrior, I will rise to meet it. — Vegeta",
  "Every time I reach a new level of strength, a greater challenge appears. — Goku",
  "Push through the pain. Surpass your limits. That's what it means to be a Saiyan. — Vegeta",
  "It's not about the power you have. It's about the power you're willing to gain. — Goku",
  "Over my dead body will I let them surpass me. I am the Prince of all Saiyans! — Vegeta",
  "I would rather be a brainless muscle-head than a coward who hides behind strategy. — Vegeta",
  "There's always a way, and I'll find it. — Goku",
  "Kak'karot... you are the mightiest Saiyan. Guard your power well. — Vegeta",

  // ── Naruto ─────────────────────────────────────────────────────
  "Hard work is worthless for those that don't believe in themselves. — Naruto Uzumaki",
  "I never go back on my word. That's my nindo, my ninja way. — Naruto Uzumaki",
  "A dropout will beat a genius through hard work. — Rock Lee",
  "If you don't like your destiny, don't accept it. Instead, have the courage to change it. — Naruto",
  "My name is Rock Lee. I am a genin from Konoha. And I will surpass a genius with hard work. — Rock Lee",
  "The pain of being alone is completely out of this world, isn't it? I don't know why, but I understand your feelings so much. — Naruto Uzumaki",
  "When people get hurt, they learn to hate. When people hurt others, they become hated and racked with guilt. But knowing that pain allows people to be kind. — Nagato",
  "A hero is not a person who never falls. A hero is someone who gets back up. — Guy Sensei",

  // ── One Piece ──────────────────────────────────────────────────
  "I don't want to conquer anything. I just think the guy with the most freedom in this whole ocean is the Pirate King! — Monkey D. Luffy",
  "I've set myself to become the King of the Pirates. And if I die trying, then at least I tried. — Luffy",
  "Only those who have suffered long can see the light within the shadows. — Roronoa Zoro",
  "Nothing happened. — Zoro",
  "When the world shoves you around, you just gotta stand up and shove back. It's not like anybody's gonna save you if you cry. — Roronoa Zoro",
  "I don't care who you are. I will surpass you. — Roronoa Zoro",
  "Bring on the hardship. It's preferred in a path of carnage. — Roronoa Zoro",
  "If I can't even protect my captain's dream, then whatever ambitions I have are nothing but talk. — Zoro",

  // ── Attack on Titan ────────────────────────────────────────────
  "If you win, you live. If you lose, you die. If you don't fight, you can't win. — Eren Yeager",
  "No matter how messed up things get, you can always figure out the best solution. — Levi Ackerman",
  "The only thing we're allowed to do is believe that we won't regret the choice we made. — Levi Ackerman",
  "A small blade can be the difference between victory and defeat. Never underestimate the small things. — Levi Ackerman",

  // ── Hunter x Hunter ────────────────────────────────────────────
  "You should enjoy the little detours to the fullest, because that's where you'll find the things more important than what you want. — Ging Freecss",
  "If you want to get to know someone, find out what makes them angry. — Gon Freecss",
  "Qualification isn't something we have to talk about. The ones who are not okay are the ones who didn't make it. — Killua",
  "People only find me interesting because they can't tell whether I'm serious or not. — Hisoka",

  // ── Demon Slayer ───────────────────────────────────────────────
  "No matter how many people you may lose, you have no choice but to go on living. — Tanjiro Kamado",
  "Total concentration breathing — every rep, every set, every session. — Tanjiro Kamado",
  "Turn your face toward the sun. Let the shadows fall behind you. — Tanjiro Kamado",
  "I will never give up. I will do whatever it takes to achieve my goal. — Tanjiro Kamado",

  // ── My Hero Academia ───────────────────────────────────────────
  "You can become a hero. — All Might",
  "Go beyond. Plus Ultra. — U.A. High School",
  "A true hero always smashes through his problems with a smile. — All Might",
  "Even if I'm not the best, I can still try my best. — Izuku Midoriya",
  "It's not about whether you win or lose. It's about how hard you tried. — All Might",
];

export function getHourlyQuote(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
    (1000 * 60 * 60)
  );
  return TRAINING_QUOTES[dayOfYear % TRAINING_QUOTES.length];
}
