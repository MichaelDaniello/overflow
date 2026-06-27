import type { TablePack } from '../types';
import { pick } from './util';

/**
 * Roll on a named table, expanding nested {{table_name}} references.
 * Guards against runaway recursion and reports unknown tables inline.
 */
export function rollOnTable(pack: TablePack, tableName: string, depth = 0): string {
  if (depth > 12) return '…(too deeply nested)';
  const table = pack.tables[tableName];
  if (!table || table.length === 0) return `‹missing table: ${tableName}›`;
  const raw = pick(table);
  return expandTemplate(pack, raw, depth);
}

export function expandTemplate(pack: TablePack, template: string, depth = 0): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, name: string) =>
    rollOnTable(pack, name, depth + 1));
}

/** Table keys that are meant to be rolled directly (not just sub-tables). */
export const PRIMARY_TABLES: { key: string; label: string }[] = [
  { key: 'sea_complication', label: 'Sea Complication' },
  { key: 'npc_name', label: 'NPC Name' },
  { key: 'npc_intent', label: 'NPC Intent' },
  { key: 'island', label: 'Island' },
  { key: 'port_problem', label: 'Port Problem' },
  { key: 'tavern_trouble', label: 'Tavern Trouble' },
  { key: 'ship_encounter', label: 'Ship Encounter' },
  { key: 'treasure', label: 'Treasure' },
  { key: 'curse', label: 'Curse' },
  { key: 'weather', label: 'Weather' },
  { key: 'scene_twist', label: 'Scene Twist' },
];
