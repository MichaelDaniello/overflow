import { useState } from 'react';
import { Wand2, Save } from 'lucide-react';
import { Panel, Button, Empty } from '../ui';
import { rollOnTable, PRIMARY_TABLES } from '../lib/tables';
import { CORE_TABLE_PACK } from '../data/coreTables';
import { logRepo } from '../db';

export function GeneratorsPanel({ campaignId, sceneId }: { campaignId: string; sceneId?: string }) {
  const [result, setResult] = useState<{ label: string; key: string; text: string } | null>(null);

  function generate(key: string, label: string) {
    setResult({ label, key, text: rollOnTable(CORE_TABLE_PACK, key) });
  }

  return (
    <Panel title="Generators" icon={<Wand2 size={18} />}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
        {PRIMARY_TABLES.map((t) => (
          <Button key={t.key} variant="default" className="px-2 py-1 text-xs justify-start" onClick={() => generate(t.key, t.label)}>
            {t.label}
          </Button>
        ))}
      </div>

      {!result && <Empty>Roll an omen from the original Black Log tables — sea complications, islands, treasure, curses…</Empty>}

      {result && (
        <div className="bg-ink border border-edge p-3">
          <div className="text-[11px] uppercase tracking-widest text-gold mb-1">{result.label}</div>
          <p className="text-parch font-serif text-lg leading-snug">{result.text}</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" className="text-xs" onClick={() => generate(result.key, result.label)}>Reroll</Button>
            <Button variant="primary" className="text-xs" onClick={() => logRepo.add(campaignId, 'generator', result.label, result.text, { sceneId })}>
              <Save size={13} /> Log it
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
