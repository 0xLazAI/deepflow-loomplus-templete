#!/usr/bin/env bash
set -euo pipefail

BRANCH="$1"
CONFIG="${2:-/opt/deepflow-config/config.yaml}"
PROJECT_PREFIX="${3:-deepflow}"
CONF_DIR="/etc/nginx/conf.d/deepflow"
TARGET_CONF="$CONF_DIR/${PROJECT_PREFIX}-$BRANCH.conf"

DOMAIN=$(yq -r ".environments[\"$BRANCH\"].domain" "$CONFIG")
PORT=$(yq -r ".environments[\"$BRANCH\"].port" "$CONFIG")

if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "null" ]; then
  echo "Invalid domain for $BRANCH"
  exit 1
fi

CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

if [ -d "$CERT_DIR" ]; then
cat > "$TARGET_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    include snippets/deepflow-ssl.conf;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        include snippets/deepflow-proxy.conf;
    }
}
EOF
else
cat > "$TARGET_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        include snippets/deepflow-proxy.conf;
    }
}
EOF
fi

nginx -t
nginx -s reload
echo "Nginx config updated for $BRANCH"
