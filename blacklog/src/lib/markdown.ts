import { db } from '../db';
import type { Campaign } from '../types';
import { fmtDate } from './util';

const dispoLabel: Record<string, string> = {
  loyal: 'loyal', friendly: 'friendly', neutral: 'neutral',
  hostile: 'hostile', terrified: 'terrified', unknown: 'unknown',
};

/** Build a readable Markdown journal for one campaign. */
export async function buildCampaignMarkdown(campaign: Campaign): Promise<string> {
  const [ship, scenes, logs, clocks, threads, npcs] = await Promise.all([
    db.ships.where('campaignId').equals(campaign.id).first(),
    db.scenes.where('campaignId').equals(campaign.id).toArray(),
    db.logs.where('campaignId').equals(campaign.id).toArray(),
    db.clocks.where('campaignId').equals(campaign.id).toArray(),
    db.threads.where('campaignId').equals(campaign.id).toArray(),
    db.npcs.where('campaignId').equals(campaign.id).toArray(),
  ]);

  const L: string[] = [];
  L.push(`# ${campaign.name}`, '');
  const meta: string[] = [];
  if (campaign.captainName) meta.push(`**Captain:** ${campaign.captainName}`);
  if (campaign.shipName) meta.push(`**Ship:** ${campaign.shipName}`);
  if (campaign.tone) meta.push(`**Tone:** ${campaign.tone}`);
  if (meta.length) L.push(meta.join(' · '), '');

  if (ship) {
    L.push('## Ship', '');
    L.push(`**${ship.name}**`, '');
    L.push(`- Hull ${ship.hull}/${ship.maxHull}`);
    L.push(`- Crew ${ship.crew}/${ship.maxCrew}`);
    L.push(`- Morale ${ship.morale} · Supplies ${ship.supplies} · Plunder ${ship.plunder}`);
    if (ship.cargo.length) L.push(`- Cargo: ${ship.cargo.map((c) => c.name).join(', ')}`);
    if (ship.curses.length) ship.curses.forEach((c) => L.push(`- Curse: ${c}`));
    if (ship.notes) L.push('', ship.notes);
    L.push('');
  }

  const crew = npcs.filter((n) => n.isCrew);
  const others = npcs.filter((n) => !n.isCrew);
  if (npcs.length) {
    L.push('## Crew & NPCs', '');
    const line = (n: typeof npcs[number]) => {
      const bits = [n.role, dispoLabel[n.disposition], n.status !== 'alive' ? n.status : null].filter(Boolean);
      let s = `- **${n.name}**${bits.length ? ` — ${bits.join(', ')}` : ''}`;
      if (n.notes) s += `\n  - ${n.notes}`;
      if (n.secret) s += `\n  - _secret:_ ${n.secret}`;
      return s;
    };
    if (crew.length) { L.push('### Crew', ''); crew.forEach((n) => L.push(line(n))); L.push(''); }
    if (others.length) { L.push('### Other NPCs', ''); others.forEach((n) => L.push(line(n))); L.push(''); }
  }

  const open = threads.filter((t) => t.status === 'open');
  if (threads.length) {
    L.push('## Threads', '');
    if (open.length) {
      L.push('### Open', '');
      open.forEach((t) => { L.push(`- **${t.title}** (weight ${t.weight})`); if (t.description) L.push(`  - ${t.description}`); });
      L.push('');
    }
    const closed = threads.filter((t) => t.status !== 'open');
    if (closed.length) {
      L.push('### Resolved / Abandoned', '');
      closed.forEach((t) => L.push(`- ~~${t.title}~~ (${t.status})`));
      L.push('');
    }
  }

  if (clocks.length) {
    L.push('## Threat Clocks', '');
    clocks.forEach((c) => {
      const filled = '●'.repeat(c.current) + '○'.repeat(Math.max(0, c.max - c.current));
      L.push(`- **${c.name}** — ${c.current}/${c.max} ${filled}${c.status !== 'active' ? ` (${c.status})` : ''}`);
      if (c.description) L.push(`  - ${c.description}`);
    });
    L.push('');
  }

  L.push('## Session Log', '');
  const byScene = new Map<string, typeof logs>();
  const looseKey = '__loose__';
  const sorted = [...logs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const e of sorted) {
    const k = e.sceneId || looseKey;
    if (!byScene.has(k)) byScene.set(k, []);
    byScene.get(k)!.push(e);
  }
  const sceneTitle = (id: string) => scenes.find((s) => s.id === id)?.title || 'Untitled scene';
  const renderEntries = (entries: typeof logs) => {
    for (const e of entries) {
      L.push(`- \`${fmtDate(e.createdAt)}\` **[${e.type}]** ${e.title}`);
      if (e.body) e.body.split('\n').forEach((ln) => ln.trim() && L.push(`  - ${ln.trim()}`));
    }
  };
  for (const [k, entries] of byScene) {
    if (k !== looseKey) L.push(`### Scene: ${sceneTitle(k)}`, '');
    else if (byScene.size > 1) L.push('### Unfiled', '');
    renderEntries(entries);
    L.push('');
  }
  if (!logs.length) L.push('_No entries yet._', '');

  L.push('---', `_Exported from Black Log on ${fmtDate(new Date().toISOString())}._`, '');
  return L.join('\n');
}
