import { PublicKey } from "@solana/web3.js";

type InjectedSolana = {
  connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
};

function firstInjectedProvider(): InjectedSolana | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    phantom?: { solana?: InjectedSolana };
    solana?: InjectedSolana;
    backpack?: { solana?: InjectedSolana };
    solflare?: InjectedSolana;
  };
  return w.phantom?.solana ?? w.solana ?? w.backpack?.solana ?? w.solflare;
}

export function isValidSolanaAddress(s: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(s.trim());
    return true;
  } catch {
    return false;
  }
}

/** Connect Phantom / Backpack / Solflare-style injected wallets (browser only). */
export async function connectInjectedSolanaWallet(): Promise<string> {
  const provider = firstInjectedProvider();
  if (!provider?.connect) {
    throw new Error(
      "No injected Solana wallet found. Install Phantom, Backpack, or Solflare — or paste your payout address manually.",
    );
  }
  const { publicKey } = await provider.connect();
  return publicKey.toBase58();
}
