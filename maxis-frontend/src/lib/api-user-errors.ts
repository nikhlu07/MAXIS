/** Map API `error` codes to short UI copy (auth / register). */
export function friendlyApiError(code: string): string {
  switch (code) {
    case "merchant_exists":
      return "That email or shop URL is already taken. Try another shop name, or sign in with the demo account (demo@maxis.local).";
    case "invalid_payload":
      return "Some fields failed validation. Check email, password length, and a valid Solana payout address.";
    case "internal_server_error":
      return "Server error — try again in a moment. If this persists, the API database may be unavailable.";
    case "database_unavailable":
      return "The API cannot reach its database (Supabase paused, wrong DATABASE_URL password, or network). Fix maxis-api .env and restart the API.";
    case "request_failed":
      return "Could not reach the API (wrong URL, server down, or no network). Check VITE_API_BASE_URL and that maxis-api is running.";
    case "invalid_credentials":
      return "Invalid email or password.";
    default:
      return code;
  }
}
