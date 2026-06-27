import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Download } from 'lucide-react';
import { campaignRepo, sceneRepo } from '../db';
import { Button } from '../ui';
import { ScenePanel } from '../panels/ScenePanel';
import { OraclePanel } from '../panels/OraclePanel';
import { DicePanel } from '../panels/DicePanel';
import { LogPanel } from '../panels/LogPanel';
import { ShipPanel } from '../panels/ShipPanel';
import { ClocksPanel } from '../panels/ClocksPanel';
import { ThreadsPanel } from '../panels/ThreadsPanel';
import { CrewPanel } from '../panels/CrewPanel';
import { GeneratorsPanel } from '../panels/GeneratorsPanel';
import { buildCampaignMarkdown } from '../lib/markdown';
import { downloadText, slugify } from '../lib/util';

export function Dashboard() {
  const { id = '' } = useParams();
  const campaign = useLiveQuery(async () => (await campaignRepo.get(id)) ?? null, [id], undefined);
  const scene = useLiveQuery(
    async () => (campaign?.activeSceneId ? await sceneRepo.get(campaign.activeSceneId) : undefined),
    [campaign?.activeSceneId], undefined,
  );

  if (campaign === undefined) return <p className="text-fog">Loading…</p>;
  if (campaign === null) return (
    <div className="text-center py-12">
      <p className="text-fog mb-3">This campaign has slipped beneath the waves.</p>
      <Link to="/"><Button variant="primary">Back to campaigns</Button></Link>
    </div>
  );

  const sceneId = scene?.id;

  async function exportMd() {
    if (!campaign) return;
    const md = await buildCampaignMarkdown(campaign);
    downloadText(`${slugify(campaign.name)}.md`, md);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link to="/" className="text-fog hover:text-gold flex items-center text-sm"><ChevronLeft size={16} /> Campaigns</Link>
        <h1 className="font-title text-3xl text-gold leading-none flex-1">{campaign.name}</h1>
        <Button variant="default" onClick={exportMd}><Download size={15} /> Export</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* left */}
        <div className="lg:col-span-4 space-y-4">
          <ScenePanel campaignId={id} scene={scene ?? undefined} />
          <OraclePanel campaignId={id} sceneId={sceneId} />
          <DicePanel campaignId={id} sceneId={sceneId} />
        </div>
        {/* center */}
        <div className="lg:col-span-4 space-y-4">
          <GeneratorsPanel campaignId={id} sceneId={sceneId} />
          <LogPanel campaignId={id} sceneId={sceneId} />
        </div>
        {/* right */}
        <div className="lg:col-span-4 space-y-4">
          <ShipPanel campaignId={id} sceneId={sceneId} />
          <ClocksPanel campaignId={id} sceneId={sceneId} />
          <ThreadsPanel campaignId={id} sceneId={sceneId} />
          <CrewPanel campaignId={id} />
        </div>
      </div>
    </div>
  );
}
