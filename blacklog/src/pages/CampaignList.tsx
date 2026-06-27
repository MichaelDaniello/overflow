import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, Skull, Ship as ShipIcon } from 'lucide-react';
import { campaignRepo } from '../db';
import type { Tone } from '../types';
import { Button, Card, Field, Modal, Select, TextInput, Empty } from '../ui';
import { fmtDate } from '../lib/util';

const TONES: Tone[] = ['grim', 'weird', 'survival', 'swashbuckling', 'horror'];

export function CampaignList() {
  const nav = useNavigate();
  const campaigns = useLiveQuery(() => campaignRepo.list(), [], []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [captain, setCaptain] = useState('');
  const [ship, setShip] = useState('');
  const [tone, setTone] = useState<Tone>('grim');
  const [confirm, setConfirm] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    const c = await campaignRepo.create({
      name: name.trim(),
      captainName: captain.trim() || undefined,
      shipName: ship.trim() || undefined,
      tone,
    });
    setOpen(false);
    setName(''); setCaptain(''); setShip(''); setTone('grim');
    nav(`/c/${c.id}`);
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-title text-4xl text-parch tracking-wide">Your Campaigns</h1>
          <p className="text-fog text-sm font-serif italic">Pick up a black log, or start a new doomed voyage.</p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> New Campaign</Button>
      </div>

      {!campaigns.length && (
        <Card className="text-center py-10">
          <Skull className="mx-auto text-fog mb-2" size={36} />
          <Empty>No campaigns yet. Every legend starts with an empty page and a bad idea.</Empty>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c) => (
          <Card key={c.id} className="flex flex-col gap-2 hover:border-gold/60 transition-colors">
            <Link to={`/c/${c.id}`} className="block">
              <h3 className="font-title text-2xl text-gold leading-tight">{c.name}</h3>
              <div className="text-sm text-parch/90 flex items-center gap-1 mt-1">
                <ShipIcon size={14} className="text-sea" /> {c.shipName || 'an unnamed ship'}
              </div>
              {c.captainName && <div className="text-xs text-fog">Captain {c.captainName}</div>}
            </Link>
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-edge">
              <span className="text-[11px] uppercase tracking-wider text-fog">
                {c.tone || 'grim'} · {fmtDate(c.updatedAt)}
              </span>
              <button
                className="text-fog hover:text-rust"
                title="Delete campaign"
                onClick={() => setConfirm(c.id)}
              ><Trash2 size={16} /></button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Campaign"
        actions={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={create}>Begin the Voyage</Button>
        </>}
      >
        <Field label="Campaign name *">
          <TextInput value={name} autoFocus placeholder="The Salt-Cursed Account" onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Captain"><TextInput value={captain} placeholder="Kargunt" onChange={(e) => setCaptain(e.target.value)} /></Field>
          <Field label="Ship"><TextInput value={ship} placeholder="The Gull's Lament" onChange={(e) => setShip(e.target.value)} /></Field>
        </div>
        <Field label="Tone">
          <Select value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
            {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </Modal>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Scuttle this campaign?"
        actions={<>
          <Button variant="ghost" onClick={() => setConfirm(null)}>Keep it</Button>
          <Button variant="danger" onClick={async () => { if (confirm) await campaignRepo.remove(confirm); setConfirm(null); }}>
            Delete forever
          </Button>
        </>}
      >
        <p className="text-parch">This erases the campaign, its ship, log, clocks, threads and crew. There is no salvage.</p>
      </Modal>
    </div>
  );
}
