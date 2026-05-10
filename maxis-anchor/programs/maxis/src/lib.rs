//! MAXIS on-chain checkout commit — explorer-verifiable record of merchant + amount + payment-request id hashes.
//!
//! SPL USDC transfer is still executed by wallets via the standard Token program; this program anchors
//! commerce metadata on Solana before/around settlement (Frontier-friendly custom program).

use anchor_lang::prelude::*;

declare_id!("8xnqY7BbiFDaSKtYjgreQdgNjvvh9nteNs5azqPg6DTX");

#[program]
pub mod maxis {
    use super::*;

    /// Persist a checkout intent (links API `402` payloads to immutable on-chain metadata).
    pub fn commit_checkout(
        ctx: Context<CommitCheckout>,
        order_id_hash: [u8; 32],
        payment_request_id_hash: [u8; 32],
        amount_micro_usdc: u64,
    ) -> Result<()> {
        require!(amount_micro_usdc > 0, ErrorCode::InvalidAmount);

        let c = &mut ctx.accounts.checkout;
        c.merchant = ctx.accounts.merchant.key();
        c.order_id_hash = order_id_hash;
        c.payment_request_id_hash = payment_request_id_hash;
        c.amount_micro_usdc = amount_micro_usdc;
        c.bump = ctx.bumps.checkout;
        c.paid = false;
        Ok(())
    }

    /// Merchant signer marks checkout reconciled after USDC settles (audit only — does not CPI transfer).
    pub fn mark_paid(ctx: Context<MarkPaid>) -> Result<()> {
        ctx.accounts.checkout.paid = true;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(order_id_hash: [u8; 32])]
pub struct CommitCheckout<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + CheckoutCommit::INIT_SPACE,
        seeds = [CheckoutCommit::SEED_PREFIX, order_id_hash.as_ref()],
        bump
    )]
    pub checkout: Account<'info, CheckoutCommit>,

    /// CHECK: merchant wallet receiving USDC off-program (referenced for proofs / explorers).
    pub merchant: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MarkPaid<'info> {
    #[account(
        mut,
        seeds = [CheckoutCommit::SEED_PREFIX, checkout.order_id_hash.as_ref()],
        bump = checkout.bump,
        constraint = checkout.merchant == merchant.key() @ ErrorCode::UnauthorizedMerchant
    )]
    pub checkout: Account<'info, CheckoutCommit>,

    pub merchant: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct CheckoutCommit {
    pub merchant: Pubkey,
    pub order_id_hash: [u8; 32],
    pub payment_request_id_hash: [u8; 32],
    pub amount_micro_usdc: u64,
    pub paid: bool,
    pub bump: u8,
}

impl CheckoutCommit {
    pub const SEED_PREFIX: &'static [u8] = b"checkout";
}

#[error_code]
pub enum ErrorCode {
    #[msg("amount_micro_usdc must be > 0")]
    InvalidAmount,
    #[msg("Signer is not recorded merchant")]
    UnauthorizedMerchant,
}
