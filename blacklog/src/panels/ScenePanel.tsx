import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MapPin, Play, Flag } from 'lucide-react';
import { Panel, Button, TextInput, TextArea, Select, Empty, Field } from '../ui';
import { sceneRepo, logRepo } from '../db';
import type { Scene } from '../types';
import { cn } from '../lib/util';

const danger = ['—', 'calm', 'uneasy', 'dangerous', 'deadly', 'doomed'];

export function ScenePanel({ campaignId, scene }: { campaignId: string; scene?: Scene }) {
  const scenes = useLiveQuery(() => sceneRepo.forCampaign(campaignId), [campaignId], []);
  const [newTitle, setNewTitle] = useState('');
  const resolvedCount = scenes.filter((s) => s.status === 'resolved').length;

  async function start() {
    const title = newTitle.trim() || 'A New Scene';
    const s = await sceneRepo.start(campaignId, title);
    await logRepo.add(campaignId, 'scene', `Scene begins: ${title}`, '', { sceneId: s.id });
    setNewTitle('');
  }
  async function end() {
    if (!scene) return;
    await logRepo.add(campaignId, 'scene', `Scene ends: ${scene.title}`, scene.summary || '', { sceneId: scene.id });
    await sceneRepo.resolve(scene.id, campaignId);
  }

  return (
    <Panel title="Current Scene" icon={<MapPin size={18} />}
      right={scene && <span className="text-[11px] uppercase tracking-wider text-fog">{resolvedCount} past</span>}>
      {!scene && (
        <div>
          <Empty>No active scene. Frame the moment, then play into it.</Empty>
          <div className="flex gap-2 mt-1">
            <TextInput value={newTitle} placeholder="The Black Harbor" onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && start()} />
            <Button variant="primary" onClick={start}><Play size={15} /> Start</Button>
          </div>
        </div>
      )}

      {scene && (
        <div className="space-y-2">
          <Field label="Title">
            <TextInput value={scene.title} onChange={(e) => sceneRepo.update(scene.id, { title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Location">
              <TextInput value={scene.location || ''} placeholder="where" onChange={(e) => sceneRepo.update(scene.id, { location: e.target.value })} />
            </Field>
            <Field label="Danger">
              <Select value={scene.dangerLevel}
                onChange={(e) => sceneRepo.update(scene.id, { dangerLevel: Number(e.target.value) as Scene['dangerLevel'] })}>
                {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} · {danger[d]}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Notes / summary">
            <TextArea value={scene.summary || ''} placeholder="What's happening, who's here, what's at stake…"
              onChange={(e) => sceneRepo.update(scene.id, { summary: e.target.value })} />
          </Field>
          <div className={cn('text-[11px] uppercase tracking-wider',
            scene.dangerLevel >= 4 ? 'text-rust' : 'text-fog')}>
            Danger: {danger[scene.dangerLevel]} — new log entries attach to this scene
          </div>
          <div className="flex justify-end">
            <Button variant="danger" onClick={end}><Flag size={15} /> End scene</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
