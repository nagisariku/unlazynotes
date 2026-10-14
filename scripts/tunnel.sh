#!/usr/bin/env bash
# ========================================================
# Self-Healing Resilient Tunnel & Telegram Webhook Sync
# Multi-Relay Fallback (localhost.run & pinggy.io)
# ========================================================
set -u

BOT_TOKEN="8622772288:AAH2scInhgx-pHRztpVhoXmZ1q4a50f-6Nw"
SECRET="super_secret_webhook_token_123"
LOCAL_PORT="${LOCAL_PORT:-4321}"

echo "🚀 [Tunnel Service] Starting Self-Healing Multi-Relay Tunnel..."

update_telegram_webhook() {
  local target_url="$1"
  local webhook_url="${target_url}/api/telegram/webhook"
  echo ""
  echo "=========================================================="
  echo "🌐 LIVE TUNNEL DETECTED: $target_url"
  echo "📡 REGISTERING TELEGRAM WEBHOOK -> $webhook_url"
  echo "=========================================================="
  
  local resp
  resp=$(curl -s -F "url=${webhook_url}" -F "secret_token=${SECRET}" "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook")
  echo "[Telegram API Response] $resp"
  echo ""
}

while true; do
  echo "[Tunnel Service] Attempting connection via localhost.run..."
  ssh -T \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=10 \
    -o ServerAliveInterval=10 \
    -o ServerAliveCountMax=2 \
    -o ExitOnForwardFailure=yes \
    -R 80:localhost:"$LOCAL_PORT" \
    nokey@localhost.run 2>&1 | while read -r line; do
      echo "$line"
      if [[ "$line" =~ (https://[a-zA-Z0-9.-]+\.lhr\.life) ]]; then
        update_telegram_webhook "${BASH_REMATCH[1]}"
      fi
  done

  echo "⚠️ [Tunnel Service] localhost.run disconnected. Attempting fallback via pinggy.io..."
  sleep 3

  ssh -T \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=10 \
    -o ServerAliveInterval=10 \
    -o ServerAliveCountMax=2 \
    -o ExitOnForwardFailure=yes \
    -p 443 \
    -R 0:localhost:"$LOCAL_PORT" \
    a.pinggy.io 2>&1 | while read -r line; do
      echo "$line"
      if [[ "$line" =~ (https://[a-zA-Z0-9.-]+\.free\.pinggy\.net) ]]; then
        update_telegram_webhook "${BASH_REMATCH[1]}"
      fi
  done

  echo "⚠️ [Tunnel Service] Relay disconnected. Retrying in 5 seconds..."
  sleep 5
done
