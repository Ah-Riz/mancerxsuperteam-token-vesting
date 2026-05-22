export function getMilestoneCampaignId(baseCampaignId: number, milestoneIndex: number): number {
  return baseCampaignId * 100 + milestoneIndex;
}
