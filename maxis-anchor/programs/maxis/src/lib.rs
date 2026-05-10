//! MAXIS on-chain checkout + **USDC escrow settlement**.
//!
//! - **`commit_checkout`** — creates the checkout PDA and an **ATA vault** whose authority is that PDA.
//!   The buyer funds the vault with a normal SPL **transfer** (wallet → vault) for at least the committed amount.
//! - **`release_escrow_to_merchant`** — merchant signs; program **CPI `transfer_checked`** vault → merchant ATA.
//! - **`refund_escrow_to_depositor`** — depositor (same pubkey that paid rent at commit) signs; full vault balance
//!   returned to their ATA (before release / refund).
//! - **`mark_paid`** — optional **audit-only** flag (no token movement); kept for backward-compatible demos.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

declare_id!("8xnqY7BbiFDaSKtYjgreQdgNjvvh9nteNs5azqPg6DTX");

/// Devnet/mainnet USDC uses 6 decimals.
pub const SPL_USDC_DECIMALS: u8 = 6;

#[program]
pub mod maxis {
    use super::*;

    /// Persist checkout intent and create an empty **escrow vault** (ATA owned by the checkout PDA).
    pub fn commit_checkout(
        ctx: Context<CommitCheckout>,
        order_id_hash: [u8; 32],
        payment_request_id_hash: [u8; 32],
        amount_micro_usdc: u64,
    ) -> Result<()> {
        require!(amount_micro_usdc > 0, ErrorCode::InvalidAmount);

        let c = &mut ctx.accounts.checkout;
        c.merchant = ctx.accounts.merchant.key();
        c.depositor = ctx.accounts.payer.key();
        c.order_id_hash = order_id_hash;
        c.payment_request_id_hash = payment_request_id_hash;
        c.amount_micro_usdc = amount_micro_usdc;
        c.bump = ctx.bumps.checkout;
        c.paid = false;
        c.usdc_mint = ctx.accounts.usdc_mint.key();
        c.released = false;
        c.refunded = false;
        Ok(())
    }

    /// Merchant signer: move **exactly** `amount_micro_usdc` from escrow vault → merchant USDC ATA.
    pub fn release_escrow_to_merchant(ctx: Context<ReleaseEscrowToMerchant>) -> Result<()> {
        let checkout = &mut ctx.accounts.checkout;
        require!(!checkout.released, ErrorCode::AlreadyReleased);
        require!(!checkout.refunded, ErrorCode::AlreadyRefunded);
        require!(
            ctx.accounts.escrow_vault.amount >= checkout.amount_micro_usdc,
            ErrorCode::InsufficientEscrowBalance
        );

        let bump_seed = [checkout.bump];
        let seeds: [&[u8]; 3] = [
            CheckoutCommit::SEED_PREFIX,
            checkout.order_id_hash.as_ref(),
            &bump_seed,
        ];
        let signer_seeds: &[&[u8]] = &seeds;
        let signers = &[signer_seeds];

        let cpi = TransferChecked {
            from: ctx.accounts.escrow_vault.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            to: ctx.accounts.merchant_token_account.to_account_info(),
            authority: checkout.to_account_info(),
        };
        let cpi_ctx =
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi, signers);
        token::transfer_checked(
            cpi_ctx,
            checkout.amount_micro_usdc,
            SPL_USDC_DECIMALS,
        )?;

        checkout.released = true;
        checkout.paid = true;
        Ok(())
    }

    /// Depositor signer: return **entire** vault balance to depositor (cancel / dispute demo path).
    pub fn refund_escrow_to_depositor(ctx: Context<RefundEscrowToDepositor>) -> Result<()> {
        let checkout = &mut ctx.accounts.checkout;
        require!(!checkout.released, ErrorCode::AlreadyReleased);
        require!(!checkout.refunded, ErrorCode::AlreadyRefunded);
        let bal = ctx.accounts.escrow_vault.amount;
        require!(bal > 0, ErrorCode::EmptyVault);

        let bump_seed = [checkout.bump];
        let seeds: [&[u8]; 3] = [
            CheckoutCommit::SEED_PREFIX,
            checkout.order_id_hash.as_ref(),
            &bump_seed,
        ];
        let signer_seeds: &[&[u8]] = &seeds;
        let signers = &[signer_seeds];

        let cpi = TransferChecked {
            from: ctx.accounts.escrow_vault.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            to: ctx.accounts.depositor_token_account.to_account_info(),
            authority: checkout.to_account_info(),
        };
        let cpi_ctx =
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi, signers);
        token::transfer_checked(cpi_ctx, bal, SPL_USDC_DECIMALS)?;

        checkout.refunded = true;
        Ok(())
    }

    /// Merchant signer marks checkout reconciled (audit only — does not CPI transfer).
    pub fn mark_paid(ctx: Context<MarkPaid>) -> Result<()> {
        ctx.accounts.checkout.paid = true;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(order_id_hash: [u8; 32], payment_request_id_hash: [u8; 32], amount_micro_usdc: u64)]
pub struct CommitCheckout<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + CheckoutCommit::INIT_SPACE,
        seeds = [CheckoutCommit::SEED_PREFIX, order_id_hash.as_ref()],
        bump
    )]
    pub checkout: Account<'info, CheckoutCommit>,

    /// CHECK: merchant wallet (and expected recipient after `release_escrow_to_merchant`).
    pub merchant: UncheckedAccount<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = checkout,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct ReleaseEscrowToMerchant<'info> {
    #[account(
        mut,
        seeds = [CheckoutCommit::SEED_PREFIX, checkout.order_id_hash.as_ref()],
        bump = checkout.bump,
        constraint = checkout.merchant == merchant.key() @ ErrorCode::UnauthorizedMerchant,
        constraint = !checkout.released @ ErrorCode::AlreadyReleased,
        constraint = !checkout.refunded @ ErrorCode::AlreadyRefunded,
    )]
    pub checkout: Account<'info, CheckoutCommit>,

    #[account(mut)]
    pub merchant: Signer<'info>,

    #[account(mut, constraint = usdc_mint.key() == checkout.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = escrow_vault.key() != merchant_token_account.key() @ ErrorCode::InvalidVault,
        constraint = escrow_vault.mint == checkout.usdc_mint @ ErrorCode::InvalidMint,
        constraint = escrow_vault.owner == checkout.key() @ ErrorCode::InvalidVault,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = merchant_token_account.mint == checkout.usdc_mint @ ErrorCode::InvalidMint,
        constraint = merchant_token_account.owner == merchant.key() @ ErrorCode::UnauthorizedMerchant,
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundEscrowToDepositor<'info> {
    #[account(
        mut,
        seeds = [CheckoutCommit::SEED_PREFIX, checkout.order_id_hash.as_ref()],
        bump = checkout.bump,
        constraint = checkout.depositor == depositor.key() @ ErrorCode::UnauthorizedDepositor,
        constraint = !checkout.released @ ErrorCode::AlreadyReleased,
        constraint = !checkout.refunded @ ErrorCode::AlreadyRefunded,
    )]
    pub checkout: Account<'info, CheckoutCommit>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(mut, constraint = usdc_mint.key() == checkout.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = escrow_vault.mint == checkout.usdc_mint @ ErrorCode::InvalidMint,
        constraint = escrow_vault.owner == checkout.key() @ ErrorCode::InvalidVault,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = depositor_token_account.mint == checkout.usdc_mint @ ErrorCode::InvalidMint,
        constraint = depositor_token_account.owner == depositor.key() @ ErrorCode::UnauthorizedDepositor,
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
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
    pub depositor: Pubkey,
    pub order_id_hash: [u8; 32],
    pub payment_request_id_hash: [u8; 32],
    pub amount_micro_usdc: u64,
    pub paid: bool,
    pub bump: u8,
    pub usdc_mint: Pubkey,
    pub released: bool,
    pub refunded: bool,
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
    #[msg("Signer is not recorded depositor")]
    UnauthorizedDepositor,
    #[msg("Vault already released to merchant")]
    AlreadyReleased,
    #[msg("Escrow already refunded")]
    AlreadyRefunded,
    #[msg("Escrow vault balance below committed amount")]
    InsufficientEscrowBalance,
    #[msg("Vault is empty")]
    EmptyVault,
    #[msg("Mint does not match checkout")]
    InvalidMint,
    #[msg("Invalid vault token account")]
    InvalidVault,
}
