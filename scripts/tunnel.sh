#!/usr/bin/env bash
# ========================================================
# Self-Healing Resilient Tunnel & Telegram Webhook Sync
# ========================================================
set -u

BOT_TOKEN="8622772288:AAH2scInhgx-pHRztpVhoXmZ1q4a50f-6Nw"
SECRET="super_secret_webhook_token_123"
LOCAL_PORT="${LOCAL_PORT:-4321}"

echo "🚀 [Tunnel Service] Starting Self-Healing SSH Tunnel..."

while true; do
  echo "[Tunnel Service] Connecting to localhost.run..."

  ssh -T \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o ServerAliveInterval=15 \
    -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    -R 80:localhost:"$LOCAL_PORT" \
    nokey@localhost.run 2>&1 | while read -r line; do
      echo "$line"
      # Match URL pattern like https://xxxxxx.lhr.life
      if [[ "$line" =~ (https://[a-zA-Z0-9.-]+\.lhr\.life) ]]; then
        TUNNEL_URL="${BASH_REMATCH[1]}"
        WEBHOOK_URL="${TUNNEL_URL}/api/telegram/webhook"
        echo ""
        echo "=========================================================="
        echo "🌐 LIVE TUNNEL DETECTED: $TUNNEL_URL"
        echo "📡 REGISTERING TELEGRAM WEBHOOK -> $WEBHOOK_URL"
        echo "=========================================================="
        
        RESP=$(curl -s -F "url=${WEBHOOK_URL}" -F "secret_token=${SECRET}" "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook")
        echo "[Telegram API Response] $RESP"
        echo ""
      fi
  done

  echo "⚠️ [Tunnel Service] SSH connection closed or failed. Retrying in 5 seconds..."
  sleep 5
done
