use anchor_lang::prelude::*;

use crate::errors::VestingError;
use crate::events::{CampaignPaused, CampaignUnpaused};

#[derive(Accounts)]
pub struct PauseCampaign<'info> {
    pub pause_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"tree",
                 vesting_tree.creator.as_ref(),
                 vesting_tree.mint.as_ref(),
                 &vesting_tree.campaign_id.to_le_bytes()],
        bump = vesting_tree.bump,
        constraint = vesting_tree.pause_authority.is_some() @ VestingError::NotPausable,
        constraint = vesting_tree.pause_authority == Some(pause_authority.key()) @ VestingError::Unauthorized,
        constraint = vesting_tree.cancelled_at.is_none() @ VestingError::CampaignCancelled,
    )]
    pub vesting_tree: Account<'info, crate::state::VestingTree>,
}

pub type UnpauseCampaign<'info> = PauseCampaign<'info>;

pub fn pause_handler(ctx: Context<PauseCampaign>) -> Result<()> {
    require!(
        ctx.accounts.vesting_tree.total_claimed < ctx.accounts.vesting_tree.total_supply,
        VestingError::CampaignCompleted
    );
    require!(!ctx.accounts.vesting_tree.paused, VestingError::AlreadyPaused);
    ctx.accounts.vesting_tree.paused = true;
    emit!(CampaignPaused {
        tree: ctx.accounts.vesting_tree.key(),
    });
    Ok(())
}

pub fn unpause_handler(ctx: Context<PauseCampaign>) -> Result<()> {
    require!(
        ctx.accounts.vesting_tree.total_claimed < ctx.accounts.vesting_tree.total_supply,
        VestingError::CampaignCompleted
    );
    require!(ctx.accounts.vesting_tree.paused, VestingError::NotPaused);
    ctx.accounts.vesting_tree.paused = false;
    emit!(CampaignUnpaused {
        tree: ctx.accounts.vesting_tree.key(),
    });
    Ok(())
}
