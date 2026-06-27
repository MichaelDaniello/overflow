import { nowIso, randInt } from './util';

const rollDie = (sides: number) => randInt(1, sides);

export type OracleAnswer =
  | 'No, and' | 'No' | 'No, but' | 'Unclear' | 'Yes, but' | 'Yes' | 'Yes, and';
export type OracleTone = 'bad' | 'neutral' | 'mixed' | 'good';

export type OracleResult = {
  roll: number;
  answer: OracleAnswer;
  tone: OracleTone;
  flourish: string;
  createdAt: string;
};

/** d20 oracle ladder. */
export function rollOracle(): OracleResult {
  const roll = rollDie(20);
  let answer: OracleAnswer;
  let tone: OracleTone;
  let flourish: string;

  if (roll === 1) { answer = 'No, and'; tone = 'bad'; flourish = 'and the tide turns against you.'; }
  else if (roll <= 5) { answer = 'No'; tone = 'bad'; flourish = 'plainly so.'; }
  else if (roll <= 8) { answer = 'No, but'; tone = 'mixed'; flourish = 'yet something small works in your favor.'; }
  else if (roll <= 12) { answer = 'Unclear'; tone = 'neutral'; flourish = 'the answer is fogbound — ask again, or act and see.'; }
  else if (roll <= 15) { answer = 'Yes, but'; tone = 'mixed'; flourish = 'at a price you will feel later.'; }
  else if (roll <= 19) { answer = 'Yes'; tone = 'good'; flourish = 'plainly so.'; }
  else { answer = 'Yes, and'; tone = 'good'; flourish = 'and fortune leans your way.'; }

  return { roll, answer, tone, flourish, createdAt: nowIso() };
}

export const ORACLE_LADDER: { range: string; answer: OracleAnswer }[] = [
  { range: '1', answer: 'No, and' },
  { range: '2–5', answer: 'No' },
  { range: '6–8', answer: 'No, but' },
  { range: '9–12', answer: 'Unclear' },
  { range: '13–15', answer: 'Yes, but' },
  { range: '16–19', answer: 'Yes' },
  { range: '20', answer: 'Yes, and' },
];
