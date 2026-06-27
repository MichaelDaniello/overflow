import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Users, Plus, Dice5, Trash2 } from 'lucide-react';
import { Panel, Button, TextInput, TextArea, Select, Empty, Modal, Field, Tag } from '../ui';
import { npcRepo } from '../db';
import type { NPC, Disposition } from '../types';
import { rollOnTable } from '../lib/tables';
import { CORE_TABLE_PACK } from '../data/coreTables';
import { pick, cn } from '../lib/util';

const DISPO: Disposition[] = ['loyal', 'friendly', 'neutral', 'hostile', 'terrified', 'unknown'];
const dispoColor: Record<string, string> = {
  loyal: 'text-sea', friendly: 'text-sea', neutral: 'text-fog',
  hostile: 'text-rust', terrified: 'text-gold', unknown: 'text-fog',
};
const ROLES = ['Quartermaster', 'Cook', 'Gunner', 'Surgeon', 'Navigator', 'Boatswain', 'Mutineer', 'Prisoner', 'Stowaway', 'Cultist', 'Cursed Sailor'];

export function CrewPanel({ campaignId }: { campaignId: string }) {
  const npcs = useLiveQuery(() => npcRepo.forCampaign(campaignId), [campaignId], []);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<NPC>>({ disposition: 'unknown', isCrew: true });

  function openNew(isCrew: boolean, generated = false) {
    const d: Partial<NPC> = { disposition: 'unknown', isCrew };
    if (generated) {
      d.name = rollOnTable(CORE_TABLE_PACK, 'npc_name');
      if (isCrew) d.role = pick(ROLES);
    }
    setDraft(d);
    setOpen(true);
  }
  async function save() {
    if (!draft.name?.trim()) return;
    await npcRepo.create(campaignId, { name: draft.name.trim(), role: draft.role, disposition: draft.disposition, isCrew: !!draft.isCrew, notes: draft.notes, secret: draft.secret });
    setOpen(false);
  }

  const crew = npcs.filter((n) => n.isCrew);
  const others = npcs.filter((n) => !n.isCrew);

  const row = (n: NPC) => (
    <div key={n.id} className={cn('bg-ink border border-edge p-2', n.status !== 'alive' && 'opacity-60')}>
      <div className="flex items-center gap-2">
        <span className={cn('font-semibold text-parch flex-1', n.status === 'dead' && 'line-through')}>
          {n.name} {n.role && <span className="text-fog text-xs">· {n.role}</span>}
        </span>
        <Select className="text-xs py-0.5 px-1 w-auto" value={n.disposition}
          onChange={(e) => npcRepo.update(n.id, { disposition: e.target.value as Disposition })}>
          {DISPO.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        <button className="text-fog/40 hover:text-rust" onClick={() => npcRepo.remove(n.id)}><Trash2 size={13} /></button>
      </div>
      <div className={cn('text-[10px] uppercase tracking-wider', dispoColor[n.disposition])}>{n.disposition}</div>
      {n.notes && <div className="text-parch/80 text-xs font-serif">{n.notes}</div>}
      {n.secret && <div className="text-rust/80 text-xs font-serif italic">secret: {n.secret}</div>}
      <div className="flex gap-2 mt-1">
        {n.status === 'alive'
          ? <button className="text-[10px] uppercase tracking-wider text-fog hover:text-rust" onClick={() => npcRepo.update(n.id, { status: 'dead' })}>mark dead</button>
          : <button className="text-[10px] uppercase tracking-wider text-fog hover:text-sea" onClick={() => npcRepo.update(n.id, { status: 'alive' })}>revive</button>}
        <button className="text-[10px] uppercase tracking-wider text-fog hover:text-gold" onClick={() => npcRepo.update(n.id, { status: 'missing' })}>missing</button>
        {n.status !== 'alive' && <Tag>{n.status}</Tag>}
      </div>
    </div>
  );

  return (
    <Panel title="Crew & NPCs" icon={<Users size={18} />}
      right={
        <div className="flex gap-1">
          <Button variant="default" className="px-2 py-1 text-xs" onClick={() => openNew(true, true)}><Dice5 size={13} /> Roll</Button>
          <Button variant="default" className="px-2 py-1 text-xs" onClick={() => openNew(true)}><Plus size={13} /> Add</Button>
        </div>
      }>
      {!npcs.length && <Empty>No crew yet. A captain is only as doomed as the souls aboard.</Empty>}

      {crew.length > 0 && <>
        <div className="text-[11px] uppercase tracking-widest text-sea mb-1">Crew</div>
        <div className="space-y-1.5 mb-2">{crew.map(row)}</div>
      </>}
      {others.length > 0 && <>
        <div className="text-[11px] uppercase tracking-widest text-gold mb-1">Other NPCs</div>
        <div className="space-y-1.5">{others.map(row)}</div>
      </>}

      <Modal open={open} onClose={() => setOpen(false)} title={draft.isCrew ? 'New Crew Member' : 'New NPC'}
        actions={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={save} disabled={!draft.name?.trim()}>Sign them on</Button></>}>
        <div className="flex gap-2 mb-2">
          <button className={cn('flex-1 py-1.5 border-2 text-sm uppercase tracking-wider', draft.isCrew ? 'border-gold text-gold' : 'border-edge text-fog')} onClick={() => setDraft({ ...draft, isCrew: true })}>Crew</button>
          <button className={cn('flex-1 py-1.5 border-2 text-sm uppercase tracking-wider', !draft.isCrew ? 'border-gold text-gold' : 'border-edge text-fog')} onClick={() => setDraft({ ...draft, isCrew: false })}>NPC</button>
          <Button variant="default" className="text-xs" onClick={() => setDraft({ ...draft, name: rollOnTable(CORE_TABLE_PACK, 'npc_name') })}><Dice5 size={13} /></Button>
        </div>
        <Field label="Name *"><TextInput value={draft.name || ''} autoFocus onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <TextInput list="roles" value={draft.role || ''} placeholder="Quartermaster" onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
            <datalist id="roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
          </Field>
          <Field label="Disposition">
            <Select value={draft.disposition} onChange={(e) => setDraft({ ...draft, disposition: e.target.value as Disposition })}>
              {DISPO.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Notes"><TextArea value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
        <Field label="Secret (only you see it)"><TextInput value={draft.secret || ''} onChange={(e) => setDraft({ ...draft, secret: e.target.value })} /></Field>
      </Modal>
    </Panel>
  );
}
