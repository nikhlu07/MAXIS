# Program keypair (`program-devnet.json`)

This file holds the **program upgrade authority** for the Anchor build that matches [`declare_id!`](../programs/maxis/src/lib.rs).

- **Intent:** Lets judges / teammates run `prep-program-keypair.sh` + `anchor build` without generating a fresh program id first.
- **Scope:** Intended for **devnet / demos only.** Do **not** fund this program or use these bytes for production mainnet.
- **If you fork this repo:** Regenerate (`solana-keygen new`), run `anchor keys sync`, redeploy under your own authority.
