import Dexie, { type Table } from 'dexie';
import type {
  Campaign, Scene, LogEntry, Ship, Clock, Thread, NPC, TablePack, Settings, LogType,
} from './types';
import { uid, nowIso } from './lib/util';

export class BlackLogDB extends Dexie {
  campaigns!: Table<Campaign, string>;
  scenes!: Table<Scene, string>;
  logs!: Table<LogEntry, string>;
  ships!: Table<Ship, string>;
  clocks!: Table<Clock, string>;
  threads!: Table<Thread, string>;
  npcs!: Table<NPC, string>;
  tablePacks!: Table<TablePack, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('black-log');
    this.version(1).stores({
      campaigns: 'id, name, createdAt, updatedAt',
      scenes: 'id, campaignId, status, createdAt',
      logs: 'id, campaignId, sceneId, createdAt, type',
      ships: 'id, campaignId',
      clocks: 'id, campaignId, status',
      threads: 'id, campaignId, status',
      npcs: 'id, campaignId, isCrew',
      tablePacks: 'id, name, version',
      settings: 'id',
    });
  }
}

export const db = new BlackLogDB();

/* ── campaigns ─────────────────────────────────────────── */
export const campaignRepo = {
  list: () => db.campaigns.orderBy('updatedAt').reverse().toArray(),
  get: (id: string) => db.campaigns.get(id),
  async create(input: Partial<Campaign> & { name: string }): Promise<Campaign> {
    const t = nowIso();
    const c: Campaign = {
      id: uid('cmp_'),
      name: input.name,
      captainName: input.captainName,
      shipName: input.shipName,
      tone: input.tone,
      createdAt: t,
      updatedAt: t,
    };
    await db.campaigns.add(c);
    // every campaign starts with a ship
    await shipRepo.create(c.id, input.shipName || 'The Unnamed');
    return c;
  },
  async update(id: string, patch: Partial<Campaign>) {
    await db.campaigns.update(id, { ...patch, updatedAt: nowIso() });
  },
  async remove(id: string) {
    await db.transaction('rw',
      [db.campaigns, db.scenes, db.logs, db.ships, db.clocks, db.threads, db.npcs],
      async () => {
        await db.campaigns.delete(id);
        await db.scenes.where('campaignId').equals(id).delete();
        await db.logs.where('campaignId').equals(id).delete();
        await db.ships.where('campaignId').equals(id).delete();
        await db.clocks.where('campaignId').equals(id).delete();
        await db.threads.where('campaignId').equals(id).delete();
        await db.npcs.where('campaignId').equals(id).delete();
      });
  },
  touch: (id: string) => db.campaigns.update(id, { updatedAt: nowIso() }),
};

/* ── ship ──────────────────────────────────────────────── */
export const shipRepo = {
  forCampaign: (campaignId: string) => db.ships.where('campaignId').equals(campaignId).first(),
  async create(campaignId: string, name: string): Promise<Ship> {
    const s: Ship = {
      id: uid('shp_'), campaignId, name,
      hull: 10, maxHull: 10, crew: 8, maxCrew: 12,
      morale: 3, supplies: 6, plunder: 0, cargo: [], curses: [],
    };
    await db.ships.add(s);
    return s;
  },
  update: (id: string, patch: Partial<Ship>) => db.ships.update(id, patch),
};

/* ── scenes ────────────────────────────────────────────── */
export const sceneRepo = {
  forCampaign: (campaignId: string) => db.scenes.where('campaignId').equals(campaignId).toArray(),
  get: (id: string) => db.scenes.get(id),
  async start(campaignId: string, title: string): Promise<Scene> {
    const t = nowIso();
    const s: Scene = {
      id: uid('scn_'), campaignId, title, dangerLevel: 2,
      activeNpcIds: [], activeClockIds: [], status: 'active', createdAt: t, updatedAt: t,
    };
    await db.scenes.add(s);
    await campaignRepo.update(campaignId, { activeSceneId: s.id });
    return s;
  },
  async update(id: string, patch: Partial<Scene>) {
    await db.scenes.update(id, { ...patch, updatedAt: nowIso() });
  },
  async resolve(id: string, campaignId: string) {
    await db.scenes.update(id, { status: 'resolved', updatedAt: nowIso() });
    const c = await db.campaigns.get(campaignId);
    if (c?.activeSceneId === id) await campaignRepo.update(campaignId, { activeSceneId: undefined });
  },
};

/* ── logs ──────────────────────────────────────────────── */
export const logRepo = {
  forCampaign: (campaignId: string) => db.logs.where('campaignId').equals(campaignId).toArray(),
  async add(campaignId: string, type: LogType, title: string, body: string, opts?: { sceneId?: string; metadata?: Record<string, unknown> }) {
    const e: LogEntry = {
      id: uid('log_'), campaignId, sceneId: opts?.sceneId, type, title, body,
      metadata: opts?.metadata, createdAt: nowIso(),
    };
    await db.logs.add(e);
    await campaignRepo.touch(campaignId);
    return e;
  },
  remove: (id: string) => db.logs.delete(id),
};

/* ── clocks ────────────────────────────────────────────── */
export const clockRepo = {
  forCampaign: (campaignId: string) => db.clocks.where('campaignId').equals(campaignId).toArray(),
  async create(campaignId: string, name: string, max: Clock['max'], description?: string): Promise<Clock> {
    const c: Clock = { id: uid('clk_'), campaignId, name, description, current: 0, max, status: 'active', tags: [] };
    await db.clocks.add(c);
    return c;
  },
  update: (id: string, patch: Partial<Clock>) => db.clocks.update(id, patch),
  remove: (id: string) => db.clocks.delete(id),
};

/* ── threads ───────────────────────────────────────────── */
export const threadRepo = {
  forCampaign: (campaignId: string) => db.threads.where('campaignId').equals(campaignId).toArray(),
  async create(campaignId: string, title: string, weight: Thread['weight'], description?: string): Promise<Thread> {
    const t = nowIso();
    const th: Thread = {
      id: uid('thr_'), campaignId, title, description, status: 'open', weight,
      relatedNpcIds: [], relatedClockIds: [], createdAt: t, updatedAt: t,
    };
    await db.threads.add(th);
    return th;
  },
  async update(id: string, patch: Partial<Thread>) {
    await db.threads.update(id, { ...patch, updatedAt: nowIso() });
  },
  remove: (id: string) => db.threads.delete(id),
};

/* ── npcs ──────────────────────────────────────────────── */
export const npcRepo = {
  forCampaign: (campaignId: string) => db.npcs.where('campaignId').equals(campaignId).toArray(),
  async create(campaignId: string, input: Partial<NPC> & { name: string }): Promise<NPC> {
    const t = nowIso();
    const n: NPC = {
      id: uid('npc_'), campaignId, name: input.name, role: input.role,
      disposition: input.disposition ?? 'unknown', isCrew: input.isCrew ?? false,
      status: input.status ?? 'alive', tags: input.tags ?? [], notes: input.notes,
      secret: input.secret, createdAt: t, updatedAt: t,
    };
    await db.npcs.add(n);
    return n;
  },
  async update(id: string, patch: Partial<NPC>) {
    await db.npcs.update(id, { ...patch, updatedAt: nowIso() });
  },
  remove: (id: string) => db.npcs.delete(id),
};

/* ── settings ──────────────────────────────────────────── */
const SETTINGS_DEFAULT: Settings = { id: 'app', logNewestFirst: true };
export const settingsRepo = {
  // pure read — safe to call inside a live query (no writes)
  async get(): Promise<Settings> {
    return (await db.settings.get('app')) ?? SETTINGS_DEFAULT;
  },
  // create the row once if absent (call at boot, outside a live query)
  async ensure() {
    if (!(await db.settings.get('app'))) await db.settings.put(SETTINGS_DEFAULT);
  },
  async set(patch: Partial<Settings>) {
    const cur = (await db.settings.get('app')) ?? SETTINGS_DEFAULT;
    await db.settings.put({ ...cur, ...patch });
  },
};
