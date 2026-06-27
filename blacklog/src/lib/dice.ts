import { nowIso, randInt } from './util';

export type DiceRollResult = {
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
  note?: string;
  createdAt: string;
};

export function rollDie(sides: number): number {
  return randInt(1, sides);
}

/**
 * Parse and roll an expression. Supports:
 *   d20, 2d6, 1d20+2, 3d6-1, d100, d66 (two d6 read as digits 11–66)
 * Throws a friendly Error on anything it can't parse.
 */
export function rollDice(expression: string): DiceRollResult {
  const expr = expression.trim().toLowerCase().replace(/\s+/g, '');
  if (!expr) throw new Error('Type a dice expression, e.g. 2d6+1.');

  // d66 — special: two d6 as a two-digit number 11–66
  if (expr === 'd66' || expr === '1d66') {
    const a = rollDie(6), b = rollDie(6);
    return { expression: 'd66', rolls: [a, b], modifier: 0, total: a * 10 + b, note: 'tens × units', createdAt: nowIso() };
  }

  const m = expr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!m) {
    throw new Error(`Can't read "${expression}". Try forms like d20, 2d6, 1d20+2, 3d6-1, d66, d100.`);
  }
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? parseInt(m[3], 10) : 0;

  if (count < 1 || count > 100) throw new Error('Dice count must be 1–100.');
  if (sides < 2 || sides > 1000) throw new Error('Die must have 2–1000 sides.');

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(sides));
  const total = rolls.reduce((s, r) => s + r, 0) + modifier;
  return { expression: expr, rolls, modifier, total, createdAt: nowIso() };
}

export function describeRoll(r: DiceRollResult): string {
  const parts = r.rolls.join(' + ');
  const mod = r.modifier ? (r.modifier > 0 ? ` + ${r.modifier}` : ` − ${Math.abs(r.modifier)}`) : '';
  if (r.expression === 'd66') return `d66 → ${r.rolls[0]}${r.rolls[1]} = ${r.total}`;
  return `${r.expression} → [${parts}]${mod} = ${r.total}`;
}
