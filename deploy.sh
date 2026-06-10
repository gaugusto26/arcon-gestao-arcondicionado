#!/bin/bash
# deploy.sh — Envia o projeto para a VPS e sobe com Docker Compose
# Uso: ./deploy.sh <usuario> <ip-da-vps>
# Exemplo: ./deploy.sh root 123.45.67.89

set -e

VPS_USER="${1:?Informe o usuário SSH. Ex: ./deploy.sh root 123.45.67.89}"
VPS_HOST="${2:?Informe o IP/host da VPS. Ex: ./deploy.sh root 123.45.67.89}"
REMOTE_DIR="/opt/arcon"

echo "==> Enviando arquivos para $VPS_USER@$VPS_HOST:$REMOTE_DIR ..."
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='dist' \
  ./ "$VPS_USER@$VPS_HOST:$REMOTE_DIR/"

echo "==> Subindo containers na VPS ..."
ssh "$VPS_USER@$VPS_HOST" bash <<EOF
  cd $REMOTE_DIR
  docker compose down --remove-orphans || true
  docker compose build --no-cache
  docker compose up -d
  echo ""
  echo "==> Containers rodando:"
  docker compose ps
EOF

echo ""
echo "==> Deploy concluído!"
echo "==> Acesse: https://arcon.digitalfive.com.br"
