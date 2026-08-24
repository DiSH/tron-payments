#!/usr/bin/env bash
# First-time Let's Encrypt certificate for fboardpagec.com (HTTP-01 webroot).
#
# Prerequisites:
#   - DNS A record for fboardpagec.com points at this host
#   - Ports 80 and 443 are open
#   - CERTBOT_EMAIL is set in .env
#
# Optional:
#   CERTBOT_STAGING=1  — use Let's Encrypt staging (avoid rate limits while testing)
#   REPLACE_CERTS=1    — replace an existing certificate
set -euo pipefail

DOMAIN="fboardpagec.com"
RSA_KEY_SIZE=4096
COMPOSE=(docker compose -f docker-compose.prod.yml)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

env_value() {
  local key="$1"
  local line=""
  if [[ -f .env ]]; then
    line="$(grep -E "^${key}=" .env | tail -n 1 || true)"
  fi
  if [[ -z "$line" ]]; then
    return 0
  fi
  echo "${line#*=}" | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

if [[ -z "${CERTBOT_EMAIL:-}" ]]; then
  CERTBOT_EMAIL="$(env_value CERTBOT_EMAIL)"
fi
if [[ -z "${CERTBOT_STAGING:-}" ]]; then
  CERTBOT_STAGING="$(env_value CERTBOT_STAGING)"
fi
if [[ -z "${CERTBOT_STAGING:-}" ]]; then
  CERTBOT_STAGING="$(env_value CERTBOT_STAGING)"
fi

if [[ -z "${CERTBOT_EMAIL:-}" ]]; then
  echo "Set CERTBOT_EMAIL in .env before requesting a certificate." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is required." >&2
  exit 1
fi

STAGING_ARGS=()
if [[ "${CERTBOT_STAGING:-}" == "1" || "${CERTBOT_STAGING:-}" == "true" || "${CERTBOT_STAGING:-}" == "1" || "${CERTBOT_STAGING:-}" == "true" ]]; then
  STAGING_ARGS=(--staging)
  echo "Using Let's Encrypt staging (CERTBOT_STAGING=${CERTBOT_STAGING})"
fi

if "${COMPOSE[@]}" run --no-deps --rm --entrypoint sh certbot -c \
  "test -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"; then
  if [[ "${REPLACE_CERTS:-}" != "1" ]]; then
    echo "Certificate already exists for ${DOMAIN}. Re-run with REPLACE_CERTS=1 to replace."
    exit 0
  fi
fi

echo "Creating dummy certificate so nginx can bind :443..."
"${COMPOSE[@]}" run --no-deps --rm --entrypoint sh certbot -c "
  mkdir -p /etc/letsencrypt/live/${DOMAIN}
  if ! command -v openssl >/dev/null 2>&1; then
    if command -v apk >/dev/null 2>&1; then
      apk add --no-cache openssl >/dev/null
    else
      echo 'openssl is required to create a dummy certificate' >&2
      exit 1
    fi
  fi
  openssl req -x509 -nodes -newkey rsa:${RSA_KEY_SIZE} -days 1 \\
    -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem \\
    -out /etc/letsencrypt/live/${DOMAIN}/fullchain.pem \\
    -subj '/CN=localhost'
"

echo "Starting nginx and API..."
"${COMPOSE[@]}" up -d --build api web

echo "Waiting for nginx..."
for _ in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T web nginx -t >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Removing dummy certificate..."
"${COMPOSE[@]}" run --no-deps --rm --entrypoint sh certbot -c "
  rm -rf /etc/letsencrypt/live/${DOMAIN}
  rm -rf /etc/letsencrypt/archive/${DOMAIN}
  rm -f /etc/letsencrypt/renewal/${DOMAIN}.conf
"

echo "Requesting Let's Encrypt certificate for ${DOMAIN}..."
"${COMPOSE[@]}" run --no-deps --rm --entrypoint certbot certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${CERTBOT_EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --rsa-key-size "${RSA_KEY_SIZE}" \
  --non-interactive \
  --force-renewal \
  "${STAGING_ARGS[@]}" \
  -d "${DOMAIN}"

echo "Reloading nginx..."
"${COMPOSE[@]}" exec -T web nginx -s reload
"${COMPOSE[@]}" up -d certbot

echo "Certificate issued for https://${DOMAIN}"
