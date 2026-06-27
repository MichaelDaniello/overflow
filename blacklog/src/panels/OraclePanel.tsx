import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Panel, Button, TextInput, TextArea, Empty } from '../ui';
import { rollOracle, type OracleResult } from '../lib/oracle';
import { logRepo } from '../db';
import { cn } from '../lib/util';

const toneColor: Record<string, string> = {
  bad: 'text-rust', neutral: 'text-fog', mixed: 'text-gold', good: 'text-sea',
};

export function OraclePanel({ campaignId, sceneId }: { campaignId: string; sceneId?: string }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<OracleResult | null>(null);
  const [interp, setInterp] = useState('');
  const [saved, setSaved] = useState(false);

  function ask() {
    setRes(rollOracle());
    setInterp('');
    setSaved(false);
  }

  function save() {
    if (!res) return;
    const title = q.trim() ? q.trim() : 'Oracle';
    const body = `${res.roll} — ${res.answer}, ${res.flourish}${interp.trim() ? `\n${interp.trim()}` : ''}`;
    logRepo.add(campaignId, 'oracle', title, body, { sceneId, metadata: { roll: res.roll, answer: res.answer } });
    setSaved(true);
  }

  return (
    <Panel title="The Oracle" icon={<Eye size={18} />}>
      <div className="flex gap-2 mb-2">
        <TextInput
          value={q}
          placeholder="Is the harbor master lying?"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
        />
        <Button variant="sea" onClick={ask}>Ask the Sea</Button>
      </div>

      {!res && <Empty>Ask a yes/no question. The sea answers in sevenfold tides.</Empty>}

      {res && (
        <div className="bg-ink border border-edge p-3">
          <div className="flex items-baseline gap-2">
            <span className="font-title text-3xl text-gold">{res.roll}</span>
            <span className={cn('font-title text-2xl', toneColor[res.tone])}>{res.answer}</span>
          </div>
          <p className="text-parch/90 font-serif italic text-sm mt-0.5">…{res.flourish}</p>
          <TextArea
            className="mt-2"
            placeholder="Your interpretation (optional) — what does it mean for the fiction?"
            value={interp}
            onChange={(e) => { setInterp(e.target.value); setSaved(false); }}
          />
          <div className="flex justify-end mt-2">
            <Button variant={saved ? 'ghost' : 'primary'} onClick={save} disabled={saved}>
              {saved ? 'Logged ✓' : 'Save to log'}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
