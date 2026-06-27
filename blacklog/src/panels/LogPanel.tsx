import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ScrollText, Plus, Trash2, ArrowDownUp } from 'lucide-react';
import { Panel, Button, TextInput, TextArea, Empty, Modal, Field } from '../ui';
import { logRepo, settingsRepo } from '../db';
import { fmtDate } from '../lib/util';

const typeColor: Record<string, string> = {
  oracle: 'text-sea', dice: 'text-fog', generator: 'text-gold', clock: 'text-rust',
  ship: 'text-parch', npc: 'text-parch', thread: 'text-gold', scene: 'text-sea', note: 'text-parch',
};

export function LogPanel({ campaignId, sceneId }: { campaignId: string; sceneId?: string }) {
  const logs = useLiveQuery(() => logRepo.forCampaign(campaignId), [campaignId], []);
  const settings = useLiveQuery(() => settingsRepo.get(), [], undefined);
  const newestFirst = settings?.logNewestFirst ?? true;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const sorted = [...logs].sort((a, b) =>
    newestFirst ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt));

  async function addNote() {
    if (!title.trim() && !body.trim()) return;
    await logRepo.add(campaignId, 'note', title.trim() || 'Note', body.trim(), { sceneId });
    setOpen(false); setTitle(''); setBody('');
  }

  return (
    <Panel
      title="Campaign Log"
      icon={<ScrollText size={18} />}
      right={
        <div className="flex gap-1">
          <button title="Flip order" className="text-fog hover:text-gold p-1"
            onClick={() => settingsRepo.set({ logNewestFirst: !newestFirst })}><ArrowDownUp size={15} /></button>
          <Button variant="default" className="px-2 py-1 text-xs" onClick={() => setOpen(true)}><Plus size={13} /> Note</Button>
        </div>
      }
    >
      {!sorted.length && <Empty>The log is empty. Every roll, oracle and generated omen can be written here.</Empty>}
      <div className="max-h-[28rem] overflow-y-auto scrollbar-thin pr-1 space-y-2">
        {sorted.map((e) => (
          <div key={e.id} className="group bg-ink border border-edge p-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
              <span className={typeColor[e.type] || 'text-parch'}>[{e.type}]</span>
              <span className="text-fog flex-1">{fmtDate(e.createdAt)}</span>
              <button className="text-fog/40 group-hover:text-rust" onClick={() => logRepo.remove(e.id)}><Trash2 size={13} /></button>
            </div>
            <div className="text-parch font-semibold text-sm">{e.title}</div>
            {e.body && <div className="text-parch/80 text-sm whitespace-pre-wrap font-serif">{e.body}</div>}
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Note"
        actions={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={addNote}>Write it down</Button></>}>
        <Field label="Title"><TextInput value={title} autoFocus placeholder="What happened" onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Detail"><TextArea value={body} placeholder="The longer account…" onChange={(e) => setBody(e.target.value)} /></Field>
      </Modal>
    </Panel>
  );
}
