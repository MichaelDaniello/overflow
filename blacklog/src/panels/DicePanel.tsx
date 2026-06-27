import { useState } from 'react';
import { Dices } from 'lucide-react';
import { Panel, Button, TextInput } from '../ui';
import { rollDice, describeRoll, type DiceRollResult } from '../lib/dice';
import { logRepo } from '../db';

const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd66', 'd100'];

export function DicePanel({ campaignId, sceneId }: { campaignId: string; sceneId?: string }) {
  const [expr, setExpr] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<DiceRollResult[]>([]);

  function roll(e: string) {
    try {
      const r = rollDice(e);
      setErr(null);
      setHistory((h) => [r, ...h].slice(0, 12));
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Bad expression.');
    }
  }

  function logLast() {
    const r = history[0];
    if (r) logRepo.add(campaignId, 'dice', `Rolled ${r.expression}`, describeRoll(r), { sceneId });
  }

  return (
    <Panel title="Dice" icon={<Dices size={18} />}>
      <div className="flex gap-2 mb-2">
        <TextInput
          value={expr}
          placeholder="2d6+1, 1d20-1, d66…"
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && expr.trim()) { roll(expr); setExpr(''); } }}
        />
        <Button variant="primary" onClick={() => { if (expr.trim()) { roll(expr); setExpr(''); } }}>Roll</Button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK.map((q) => (
          <Button key={q} variant="default" className="px-2 py-1 text-xs" onClick={() => roll(q)}>{q}</Button>
        ))}
      </div>
      {err && <p className="text-rust text-sm mb-2">{err}</p>}
      {history.length > 0 && (
        <div className="bg-ink border border-edge p-2 max-h-40 overflow-y-auto scrollbar-thin text-sm">
          {history.map((r, i) => (
            <div key={i} className={i === 0 ? 'text-parch' : 'text-fog'}>
              {i === 0 ? <span className="text-gold font-title text-lg mr-1">{r.total}</span> : null}
              <span className="font-mono text-xs">{describeRoll(r)}</span>
            </div>
          ))}
          <button className="text-xs text-sea hover:text-gold mt-1 uppercase tracking-wider" onClick={logLast}>
            + log last roll
          </button>
        </div>
      )}
    </Panel>
  );
}
