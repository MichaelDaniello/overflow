import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { GitBranch, Plus, Dice5, Check, X } from 'lucide-react';
import { Panel, Button, TextInput, Select, Empty, Modal, Field, TextArea } from '../ui';
import { threadRepo, logRepo } from '../db';
import type { Thread } from '../types';
import { weightedPick, cn } from '../lib/util';

const weightLabel: Record<number, string> = { 1: 'minor', 2: 'notable', 3: 'driving' };

export function ThreadsPanel({ campaignId, sceneId }: { campaignId: string; sceneId?: string }) {
  const threads = useLiveQuery(() => threadRepo.forCampaign(campaignId), [campaignId], []);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [weight, setWeight] = useState<Thread['weight']>(2);
  const [picked, setPicked] = useState<Thread | null>(null);

  const openThreads = threads.filter((t) => t.status === 'open');
  const closed = threads.filter((t) => t.status !== 'open');

  async function create() {
    if (!title.trim()) return;
    await threadRepo.create(campaignId, title.trim(), weight, desc.trim() || undefined);
    setOpen(false); setTitle(''); setDesc(''); setWeight(2);
  }
  function pickRandom() {
    const t = weightedPick(openThreads, (x) => x.weight);
    setPicked(t);
  }

  return (
    <Panel title="Threads" icon={<GitBranch size={18} />}
      right={
        <div className="flex gap-1">
          <Button variant="default" className="px-2 py-1 text-xs" disabled={!openThreads.length} onClick={pickRandom}><Dice5 size={13} /> Pull</Button>
          <Button variant="default" className="px-2 py-1 text-xs" onClick={() => setOpen(true)}><Plus size={13} /> New</Button>
        </div>
      }>
      {!threads.length && <Empty>No threads. Hang your hooks here: find the drowned admiral's map, escape the bounty…</Empty>}

      <div className="space-y-1.5">
        {openThreads.map((t) => (
          <div key={t.id} className="bg-ink border border-edge p-2">
            <div className="flex items-start gap-2">
              <span className={cn('mt-0.5 w-2 h-2 rounded-full shrink-0', t.weight === 3 ? 'bg-rust' : t.weight === 2 ? 'bg-gold' : 'bg-fog')} />
              <div className="flex-1">
                <div className="text-parch font-semibold text-sm leading-tight">{t.title}</div>
                {t.description && <div className="text-fog text-xs font-serif italic">{t.description}</div>}
                <div className="text-[10px] uppercase tracking-wider text-fog/70">{weightLabel[t.weight]}</div>
              </div>
              <button title="resolve" className="text-fog/50 hover:text-sea" onClick={() => threadRepo.update(t.id, { status: 'resolved' }).then(() => logRepo.add(campaignId, 'thread', `Thread resolved: ${t.title}`, '', { sceneId }))}><Check size={14} /></button>
              <button title="abandon" className="text-fog/50 hover:text-rust" onClick={() => threadRepo.update(t.id, { status: 'abandoned' })}><X size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {closed.length > 0 && (
        <details className="mt-2">
          <summary className="text-[11px] uppercase tracking-widest text-fog cursor-pointer">{closed.length} closed</summary>
          <div className="mt-1 space-y-0.5">
            {closed.map((t) => (
              <div key={t.id} className="text-xs text-fog flex items-center gap-1">
                <span className="line-through flex-1">{t.title}</span>
                <span className="uppercase tracking-wider">{t.status}</span>
                <button className="hover:text-gold" onClick={() => threadRepo.update(t.id, { status: 'open' })}>reopen</button>
              </div>
            ))}
          </div>
        </details>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Thread"
        actions={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={create} disabled={!title.trim()}>Add thread</Button></>}>
        <Field label="Title"><TextInput value={title} autoFocus placeholder="Learn who cursed the ship" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} /></Field>
        <Field label="Detail (optional)"><TextArea value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Field label="Weight">
          <Select value={weight} onChange={(e) => setWeight(Number(e.target.value) as Thread['weight'])}>
            <option value={1}>1 · minor</option><option value={2}>2 · notable</option><option value={3}>3 · driving</option>
          </Select>
        </Field>
      </Modal>

      <Modal open={!!picked} onClose={() => setPicked(null)} title="The tide pulls toward…"
        actions={<>
          <Button variant="ghost" onClick={() => setPicked(null)}>Close</Button>
          <Button variant="primary" onClick={() => { if (picked) logRepo.add(campaignId, 'thread', `Focus: ${picked.title}`, picked.description || '', { sceneId }); setPicked(null); }}>Log this focus</Button>
        </>}>
        {picked ? <p className="font-title text-2xl text-gold">{picked.title}</p> : null}
        {picked?.description && <p className="text-parch/90 font-serif italic mt-1">{picked.description}</p>}
      </Modal>
    </Panel>
  );
}
