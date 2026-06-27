import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Ship as ShipIcon, Skull, Plus, X } from 'lucide-react';
import { Panel, Button, TextInput, Stepper, Empty, Tag } from '../ui';
import { shipRepo, logRepo } from '../db';
import { uid } from '../lib/util';

export function ShipPanel({ campaignId, sceneId }: { campaignId: string; sceneId?: string }) {
  const ship = useLiveQuery(() => shipRepo.forCampaign(campaignId), [campaignId], undefined);
  const [cargo, setCargo] = useState('');
  const [curse, setCurse] = useState('');

  if (!ship) return <Panel title="Ship" icon={<ShipIcon size={18} />}><Empty>No ship.</Empty></Panel>;

  const set = (patch: Partial<typeof ship>) => shipRepo.update(ship.id, patch);
  const log = (title: string, body = '') => logRepo.add(campaignId, 'ship', title, body, { sceneId });

  const hullPct = Math.round((ship.hull / Math.max(1, ship.maxHull)) * 100);
  const hullColor = hullPct <= 25 ? 'bg-rust' : hullPct <= 60 ? 'bg-gold' : 'bg-sea';

  return (
    <Panel title="Ship" icon={<ShipIcon size={18} />}
      right={<span className="text-[11px] uppercase tracking-wider text-fog">{hullPct}% hull</span>}>
      <input
        className="w-full bg-transparent font-title text-2xl text-gold focus:outline-none mb-1"
        value={ship.name} onChange={(e) => set({ name: e.target.value })}
      />
      <div className="h-2 bg-ink border border-edge mb-3 overflow-hidden">
        <div className={`h-full ${hullColor}`} style={{ width: `${hullPct}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <Stepper label="Hull" value={ship.hull} max={ship.maxHull} accent="text-parch" onChange={(v) => set({ hull: v })} />
        <Stepper label="Max" value={ship.maxHull} onChange={(v) => set({ maxHull: v, hull: Math.min(ship.hull, v) })} />
        <Stepper label="Crew" value={ship.crew} max={ship.maxCrew} onChange={(v) => set({ crew: v })} />
        <Stepper label="Max crew" value={ship.maxCrew} onChange={(v) => set({ maxCrew: v, crew: Math.min(ship.crew, v) })} />
        <Stepper label="Morale" value={ship.morale} max={10} accent="text-sea" onChange={(v) => set({ morale: v })} />
        <Stepper label="Supplies" value={ship.supplies} max={99} accent="text-gold" onChange={(v) => set({ supplies: v })} />
        <Stepper label="Plunder" value={ship.plunder} max={9999} accent="text-gold" onChange={(v) => set({ plunder: v })} />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => { set({ hull: Math.max(0, ship.hull - 1) }); log('Hull takes a hit', `Hull → ${Math.max(0, ship.hull - 1)}/${ship.maxHull}`); }}>− Hull (log)</Button>
        <Button variant="sea" className="px-2 py-1 text-xs" onClick={() => { set({ hull: Math.min(ship.maxHull, ship.hull + 1) }); log('Repairs', `Hull → ${Math.min(ship.maxHull, ship.hull + 1)}/${ship.maxHull}`); }}>+ Repair (log)</Button>
        <Button variant="default" className="px-2 py-1 text-xs" onClick={() => { set({ supplies: Math.max(0, ship.supplies - 1) }); log('Supplies consumed', `Supplies → ${Math.max(0, ship.supplies - 1)}`); }}>− Supplies</Button>
      </div>

      {/* cargo */}
      <div className="mt-3 border-t border-edge pt-2">
        <div className="text-xs uppercase tracking-widest text-fog mb-1">Cargo</div>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {ship.cargo.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1"><Tag>{c.name}</Tag>
              <button className="text-fog/50 hover:text-rust" onClick={() => set({ cargo: ship.cargo.filter((x) => x.id !== c.id) })}><X size={12} /></button>
            </span>
          ))}
          {!ship.cargo.length && <Empty>hold is empty</Empty>}
        </div>
        <div className="flex gap-1.5">
          <TextInput className="text-sm py-1" value={cargo} placeholder="add cargo…" onChange={(e) => setCargo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && cargo.trim()) { set({ cargo: [...ship.cargo, { id: uid(), name: cargo.trim(), tags: [] }] }); setCargo(''); } }} />
        </div>
      </div>

      {/* curses */}
      <div className="mt-2 border-t border-edge pt-2">
        <div className="text-xs uppercase tracking-widest text-rust mb-1 flex items-center gap-1"><Skull size={12} /> Curses</div>
        {ship.curses.map((c, i) => (
          <div key={i} className="flex items-start gap-1.5 text-sm text-parch/90 font-serif italic mb-1">
            <span className="flex-1">• {c}</span>
            <button className="text-fog/50 hover:text-rust" onClick={() => set({ curses: ship.curses.filter((_, j) => j !== i) })}><X size={12} /></button>
          </div>
        ))}
        <div className="flex gap-1.5">
          <TextInput className="text-sm py-1" value={curse} placeholder="lay a curse…" onChange={(e) => setCurse(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && curse.trim()) { set({ curses: [...ship.curses, curse.trim()] }); log('A curse takes hold', curse.trim()); setCurse(''); } }} />
          <Button variant="default" className="px-2 py-1 text-xs" onClick={() => { if (curse.trim()) { set({ curses: [...ship.curses, curse.trim()] }); log('A curse takes hold', curse.trim()); setCurse(''); } }}><Plus size={13} /></Button>
        </div>
      </div>
    </Panel>
  );
}
