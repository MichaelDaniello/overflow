import { z } from 'zod';

/* ── enums ─────────────────────────────────────────────── */
export const Tone = z.enum(['grim', 'weird', 'survival', 'swashbuckling', 'horror']);
export type Tone = z.infer<typeof Tone>;

export const Disposition = z.enum(['loyal', 'friendly', 'neutral', 'hostile', 'terrified', 'unknown']);
export type Disposition = z.infer<typeof Disposition>;

export const LogType = z.enum(['scene', 'oracle', 'dice', 'generator', 'clock', 'ship', 'npc', 'thread', 'note']);
export type LogType = z.infer<typeof LogType>;

/* ── models ────────────────────────────────────────────── */
export const Campaign = z.object({
  id: z.string(),
  name: z.string().min(1),
  captainName: z.string().optional(),
  shipName: z.string().optional(),
  tone: Tone.optional(),
  activeSceneId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Campaign = z.infer<typeof Campaign>;

export const Scene = z.object({
  id: z.string(),
  campaignId: z.string(),
  title: z.string(),
  location: z.string().optional(),
  summary: z.string().optional(),
  dangerLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  activeNpcIds: z.array(z.string()),
  activeClockIds: z.array(z.string()),
  status: z.enum(['active', 'resolved']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Scene = z.infer<typeof Scene>;

export const LogEntry = z.object({
  id: z.string(),
  campaignId: z.string(),
  sceneId: z.string().optional(),
  type: LogType,
  title: z.string(),
  body: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string(),
});
export type LogEntry = z.infer<typeof LogEntry>;

export const CargoItem = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number().optional(),
  tags: z.array(z.string()),
  notes: z.string().optional(),
});
export type CargoItem = z.infer<typeof CargoItem>;

export const Ship = z.object({
  id: z.string(),
  campaignId: z.string(),
  name: z.string(),
  hull: z.number(),
  maxHull: z.number(),
  crew: z.number(),
  maxCrew: z.number(),
  morale: z.number(),
  supplies: z.number(),
  plunder: z.number(),
  cargo: z.array(CargoItem),
  curses: z.array(z.string()),
  notes: z.string().optional(),
});
export type Ship = z.infer<typeof Ship>;

export const ClockMax = z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12)]);
export type ClockMax = z.infer<typeof ClockMax>;

export const Clock = z.object({
  id: z.string(),
  campaignId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  current: z.number(),
  max: ClockMax,
  status: z.enum(['active', 'completed', 'paused']),
  tags: z.array(z.string()),
});
export type Clock = z.infer<typeof Clock>;

export const Thread = z.object({
  id: z.string(),
  campaignId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['open', 'resolved', 'abandoned']),
  weight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  relatedNpcIds: z.array(z.string()),
  relatedClockIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Thread = z.infer<typeof Thread>;

export const NPC = z.object({
  id: z.string(),
  campaignId: z.string(),
  name: z.string(),
  role: z.string().optional(),
  disposition: Disposition,
  isCrew: z.boolean(),
  status: z.enum(['alive', 'dead', 'missing']),
  tags: z.array(z.string()),
  notes: z.string().optional(),
  secret: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NPC = z.infer<typeof NPC>;

export const TablePack = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  tables: z.record(z.array(z.string())),
});
export type TablePack = z.infer<typeof TablePack>;

export type Settings = {
  id: string;
  logNewestFirst: boolean;
};
