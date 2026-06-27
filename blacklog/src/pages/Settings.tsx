import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Download, Trash2 } from 'lucide-react';
import { Panel, Button, Card } from '../ui';
import { db, campaignRepo } from '../db';
import { buildCampaignMarkdown } from '../lib/markdown';
import { downloadText } from '../lib/util';
import { ORACLE_LADDER } from '../lib/oracle';
import { useState } from 'react';

export function Settings() {
  const campaigns = useLiveQuery(() => campaignRepo.list(), [], []);
  const [wipe, setWipe] = useState(false);

  async function exportAll() {
    const parts: string[] = [];
    for (const c of campaigns) parts.push(await buildCampaignMarkdown(c), '\n\n');
    downloadText('black-log-all.md', parts.join('') || '# Black Log\n\n_No campaigns._\n');
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link to="/" className="text-fog hover:text-gold flex items-center text-sm"><ChevronLeft size={16} /> Campaigns</Link>
        <h1 className="font-title text-3xl text-parch flex-1">Settings</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="About">
          <p className="text-parch/90 font-serif text-sm leading-relaxed">
            <b>Black Log</b> is a local-first solo cockpit for dark pirate campaigns: an oracle, dice,
            ship tracker, threat clocks, threads, crew and a journal that exports to Markdown.
          </p>
          <p className="text-fog text-sm mt-2">
            Everything is stored only in this browser (IndexedDB). No account, no server, no cloud.
            Clear your browser data and it's gone — so export your logs.
          </p>
          <p className="text-fog text-xs mt-2 italic">
            All tables and flavor text are original to Black Log. No third-party RPG text or art is included.
          </p>
        </Panel>

        <Panel title="The Oracle Ladder">
          <table className="w-full text-sm">
            <tbody>
              {ORACLE_LADDER.map((r) => (
                <tr key={r.range} className="border-b border-edge/60 last:border-0">
                  <td className="py-1 font-title text-gold w-16">{r.range}</td>
                  <td className="py-1 text-parch">{r.answer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Data">
          <div className="flex flex-col gap-2">
            <Button variant="default" onClick={exportAll}><Download size={15} /> Export all campaigns (.md)</Button>
            {!wipe ? (
              <Button variant="danger" onClick={() => setWipe(true)}><Trash2 size={15} /> Erase all local data</Button>
            ) : (
              <Card className="border-rust/60">
                <p className="text-parch text-sm mb-2">This deletes <b>every</b> campaign, log and setting in this browser. There is no undo.</p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setWipe(false)}>Cancel</Button>
                  <Button variant="danger" onClick={async () => { await db.delete(); location.reload(); }}>Erase everything</Button>
                </div>
              </Card>
            )}
          </div>
        </Panel>

        <Panel title="Campaigns">
          {campaigns.length
            ? <ul className="text-sm text-parch/90 space-y-1">{campaigns.map((c) => (
                <li key={c.id}><Link className="hover:text-gold" to={`/c/${c.id}`}>{c.name}</Link></li>
              ))}</ul>
            : <p className="text-fog text-sm italic">No campaigns yet.</p>}
        </Panel>
      </div>
    </div>
  );
}
