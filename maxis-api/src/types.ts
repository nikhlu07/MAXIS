/** Shared domain types for MAXIS API (in-memory MVP). */

export const OrderStatus = {
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  PAID: "PAID",
  ACCEPTED: "ACCEPTED",
  READY: "READY",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export type MerchantRecord = {
  id: string;
  name: string;
  slug: string;
  city: string;
  payoutWallet: string;
  email: string;
  password: string;
};

export type CatalogItemRecord = {
  id: string;
  merchantId: string;
  name: string;
  priceUsd: number;
  available: boolean;
};

export type OrderLine = {
  itemId: string;
  name: string;
  qty: number;
  unitPriceUsd: number;
  lineTotalUsd: number;
};

export type OrderPayment = {
  paymentRequestId: string;
  txSignature: string;
  amount: string;
  amountUsd: number;
  paidAt: string;
  asset: "USDC";
  chain: "solana-devnet";
  mint: string;
  verifiedOnChain: boolean;
};

export type OrderRecord = {
  id: string;
  merchantId: string;
  merchantSlug: string;
  lines: OrderLine[];
  totalUsd: number;
  status: OrderStatus;
  fulfillment: { type: "pickup"; pickupAt?: string };
  createdAt: string;
  checkoutExpiresAt: string | null;
  activePaymentRequestId: string | null;
  payment: OrderPayment | null;
};

export type PayIdempotencyEntry = { status: number; body: Record<string, unknown> };
