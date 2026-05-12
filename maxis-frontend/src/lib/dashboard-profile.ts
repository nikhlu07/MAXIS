import { apiRequest } from "@/lib/api";

export type MerchantProfile = {
  id: string;
  name: string;
  slug: string;
  city: string;
  email: string;
  payoutWallet: string;
};

export async function fetchMerchantProfile(token: string): Promise<MerchantProfile> {
  return apiRequest<MerchantProfile>("/dashboard/profile", { method: "GET", token });
}

export async function patchMerchantProfile(
  token: string,
  body: Partial<Pick<MerchantProfile, "name" | "city" | "payoutWallet">>,
): Promise<MerchantProfile> {
  return apiRequest<MerchantProfile>("/dashboard/profile", {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}
