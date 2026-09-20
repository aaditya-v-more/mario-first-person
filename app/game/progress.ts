import { LEVELS } from './levels';
export type RecordEntry = {
  cleared: boolean;
  stars: number;
  score: number;
  bestTime: number;
  coinMedal: boolean;
  speedMedal: boolean;
  cleanMedal: boolean;
};
export type ProgressSave = {
  version: 3;
  unlocked: number;
  records: RecordEntry[];
};
const KEY = 'mario-first-person.nes.v1';
const emptyRecord = (): RecordEntry => ({
  cleared: false,
  stars: 0,
  score: 0,
  bestTime: 0,
  coinMedal: false,
  speedMedal: false,
  cleanMedal: false,
});
export const freshProgress = (): ProgressSave => ({
  version: 3,
  unlocked: 0,
  records: LEVELS.map(emptyRecord),
});
export function readProgress(): ProgressSave {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw?.version !== 3 || !Array.isArray(raw.records))
      return freshProgress();
    const save = freshProgress();
    save.records = save.records.map((_, i) => {
      const r = raw.records[i];
      return {
        cleared: r?.cleared === true,
        stars: Number.isInteger(r?.stars)
          ? Math.max(0, Math.min(7, r.stars))
          : 0,
        score: Number.isFinite(r?.score)
          ? Math.max(0, Math.min(1e9, Math.floor(r.score)))
          : 0,
        bestTime: Number.isFinite(r?.bestTime)
          ? Math.max(0, Math.min(1e6, r.bestTime))
          : 0,
        coinMedal: r?.coinMedal === true,
        speedMedal: r?.speedMedal === true,
        cleanMedal: r?.cleanMedal === true,
      };
    });
    while (
      save.unlocked < LEVELS.length - 1 &&
      save.records[save.unlocked].cleared
    )
      save.unlocked++;
    return save;
  } catch {
    return freshProgress();
  }
}
export function saveProgress(save: ProgressSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* Play remains available when the host denies storage. */
  }
}
export const countStars = (mask: number) =>
  Number(!!(mask & 1)) + Number(!!(mask & 2)) + Number(!!(mask & 4));
