import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "dev-only-change-me");
const JWT_EXPIRES =
  process.env.JWT_EXPIRES_IN ?? ("7d" as jwt.SignOptions["expiresIn"]);

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? "12");

export type JwtMerchantPayload = { sub: string; slug: string };

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signMerchantToken(payload: JwtMerchantPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES } as jwt.SignOptions);
}

export function verifyMerchantToken(token: string): JwtMerchantPayload {
  const decoded = jwt.verify(token, JWT_SECRET!) as jwt.JwtPayload & Partial<JwtMerchantPayload>;
  if (!decoded.sub || typeof decoded.sub !== "string" || typeof decoded.slug !== "string") {
    throw new Error("invalid_token_payload");
  }
  return { sub: decoded.sub, slug: decoded.slug };
}
