#!/usr/bin/env bash
# Golden-path API smoke test (health → order → 402 checkout → pay → statuses).
# Prerequisites: API already running (e.g. `npm run dev` in maxis-api).
# Note: POST /orders/checkout returns 402 — do not use curl -f for that request.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3001}"

echo "== MAXIS demo verify → $BASE"

curl -sf "$BASE/health" | jq -e '.ok == true' >/dev/null
echo "OK GET /health"

ORDER_JSON=$(curl -sf -X POST "$BASE/orders" \
  -H "Content-Type: application/json" \
  -d '{"merchantSlug":"north-star-cafe","items":[{"itemId":"item_latte_sm","qty":1}]}')
OID=$(echo "$ORDER_JSON" | jq -r '.orderId')
test -n "$OID" && echo "$ORDER_JSON" | jq -e '.status == "AWAITING_PAYMENT"' >/dev/null
echo "OK POST /orders → $OID"

CODE=$(curl -s -o /tmp/maxis_chk.json -w "%{http_code}" -X POST "$BASE/orders/checkout" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$OID\"}")
if [[ "$CODE" != "402" ]]; then
  echo "FAIL POST /orders/checkout expected 402, got $CODE" >&2
  cat /tmp/maxis_chk.json >&2
  exit 1
fi
echo "OK POST /orders/checkout → HTTP $CODE"
jq -e '.paymentRequestId and .amount and .recipient' /tmp/maxis_chk.json >/dev/null

PRID=$(jq -r '.paymentRequestId' /tmp/maxis_chk.json)
AMT=$(jq -r '.amount' /tmp/maxis_chk.json)
REC=$(jq -r '.recipient' /tmp/maxis_chk.json)

IDI="idem_verify_$(date +%s)"
PAY_JSON=$(curl -sf -X POST "$BASE/orders/$OID/pay" \
  -H "Content-Type: application/json" \
  -d "{\"paymentRequestId\":\"$PRID\",\"txSignature\":\"demo_tx_sig_verify_run\",\"amount\":\"$AMT\",\"recipient\":\"$REC\",\"asset\":\"USDC\",\"chain\":\"solana-devnet\",\"reference\":\"$OID\",\"idempotencyKey\":\"$IDI\"}")
echo "$PAY_JSON" | jq -e '.status == "PAID"' >/dev/null
echo "OK POST /orders/$OID/pay → PAID"

TOKEN=$(curl -sf -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@maxis.local","password":"demo123"}' | jq -r '.token')
curl -sf "$BASE/dashboard/orders" -H "Authorization: Bearer $TOKEN" \
  | jq -e --arg id "$OID" '.orders | map(.orderId) | index($id) != null' >/dev/null
echo "OK GET /dashboard/orders (order present)"

curl -sf -X PATCH "$BASE/dashboard/orders/$OID/status" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"ACCEPTED"}' | jq -e '.status == "ACCEPTED"' >/dev/null
echo "OK PATCH status ACCEPTED"

curl -sf -X PATCH "$BASE/dashboard/orders/$OID/status" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"READY"}' | jq -e '.status == "READY"' >/dev/null
echo "OK PATCH status READY"

curl -sf "$BASE/orders/$OID/status" | jq -e '.status == "READY"' >/dev/null
echo "OK GET /orders/$OID/status → READY"

echo "== All steps passed."
