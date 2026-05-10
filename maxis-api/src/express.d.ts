import type { JwtMerchantPayload } from "./auth-lib.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by `authRequired` after valid Bearer JWT */
      merchant?: JwtMerchantPayload;
    }
  }
}

export {};
