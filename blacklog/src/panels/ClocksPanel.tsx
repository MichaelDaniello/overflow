import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock as ClockIcon, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Panel, Button, TextInput, Select, Empty, Pips, Modal, Field, TextArea } from '../ui';
import { clockRepo, logRepo } from '../db';
import type { Clock } from '../types';
import { cn } from '../lib/util';

const SIZES: Clock['max'][] = [4, 6, 8, 10, 12];

export function ClocksPanel({ campaignId, sceneId }: { campaignId: string; sceneId?: string }) {
  const clocks = useLiveQuery(() => clockRepo.forCampaign(campaignId), [campaignId], []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [size, setSize] = useState<Clock['max']>(6);
  const [done, setDone] = useState<Clock | null>(null);

  async function create() {
    if (!name.trim()) return;
    await clockRepo.create(campaignId, name.trim(), size, desc.trim() || undefined);
    setOpen(false); setName(''); setDesc(''); setSize(6);
  }

  async function tick(c: Clock, to: number) {
    const next = Math.max(0, Math.min(c.max, to));
    if (next === c.current) return;
    const status = next >= c.max ? 'completed' : 'active';
    await clockRepo.update(c.id, { current: next, status });
    await logRepo.add(campaignId, 'clock', `${c.name} ${next > c.current ? 'ticks' : 'eases'} ${c.current}→${next}/${c.max}`, '', { sceneId });
    if (status === 'completed') setDone({ ...c, current: next, status });
  }

  const active = clocks.filter((c) => c.status !== 'completed');
  const completed = clocks.filter((c) => c.status === 'completed');

  return (
    <Panel title="Threat Clocks" icon={<ClockIcon size={18} />}
      right={<Button variant="default" className="px-2 py-1 text-xs" onClick={() => setOpen(true)}><Plus size={13} /> New</Button>}>
      {!clocks.length && <Empty>No clocks. Wind one up: Mutiny, Navy Hunt, The Curse Wakes…</Empty>}

      <div className="space-y-2.5">
        {active.map((c) => (
          <div key={c.id} className="bg-ink border border-edge p-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-parch flex-1">{c.name} <span className="text-fog text-xs">{c.current}/{c.max}</span></span>
              <button className="text-fog/50 hover:text-gold" title="reset" onClick={() => tick(c, 0)}><RotateCcw size={13} /></button>
              <button className="text-fog/50 hover:text-rust" onClick={() => clockRepo.remove(c.id)}><Trash2 size={13} /></button>
            </div>
            {c.description && <p className="text-fog text-xs font-serif italic">{c.description}</p>}
            <div className="flex items-center gap-2 mt-1">
              <Pips current={c.current} max={c.max} onTick={(n) => tick(c, n)} />
              <button className="text-xs text-sea hover:text-gold uppercase tracking-wider ml-auto" onClick={() => tick(c, c.current + 1)}>tick +1</button>
            </div>
          </div>
        ))}
      </div>

      {completed.length > 0 && (
        <div className="mt-3 border-t border-edge pt-2">
          <div className="text-[11px] uppercase tracking-widest text-rust mb-1">Struck</div>
          {completed.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-sm">
              <span className="text-rust font-semibold flex-1 line-through">{c.name}</span>
              <button className="text-fog/50 hover:text-gold" onClick={() => clockRepo.update(c.id, { current: 0, status: 'active' })}><RotateCcw size={13} /></button>
              <button className="text-fog/50 hover:text-rust" onClick={() => clockRepo.remove(c.id)}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Threat Clock"
        actions={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={create} disabled={!name.trim()}>Wind it up</Button></>}>
        <Field label="Name"><TextInput value={name} autoFocus placeholder="Mutiny" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} /></Field>
        <Field label="Segments">
          <div className="flex gap-1.5">
            {SIZES.map((s) => (
              <button key={s} onClick={() => setSize(s)}
                className={cn('px-3 py-1.5 border-2 font-title text-lg', size === s ? 'border-gold text-gold' : 'border-edge text-fog')}>{s}</button>
            ))}
          </div>
        </Field>
        <Field label="What happens when it fills? (optional)"><TextArea value={desc} placeholder="The crew turns on the captain." onChange={(e) => setDesc(e.target.value)} /></Field>
      </Modal>

      <Modal open={!!done} onClose={() => setDone(null)} title={`"${done?.name}" is struck`}
        actions={<Button variant="primary" onClick={() => setDone(null)}>So it goes</Button>}>
        <p className="text-parch font-serif">The clock has filled. {done?.description || 'Decide the consequence and play it out — then log what happens.'}</p>
      </Modal>
    </Panel>
  );
}

export { SIZES };
