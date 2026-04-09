#!/bin/bash
# =====================================================
# PAPO DE BOLA - Deploy Script
# Atualiza o site no servidor via git pull
# =====================================================

SERVER="ivan@138.117.60.14"
PORT="1822"
KEY="~/.ssh/debian_ed25519"
REMOTE_DIR="/home/ivan/site-papodebola"

echo "=== PAPO DE BOLA - Deploy ==="
echo ""

# 1. Push local changes to GitHub
echo "[1/3] Enviando para GitHub..."
git push origin main
if [ $? -ne 0 ]; then
    echo "ERRO: Falha ao enviar para GitHub"
    exit 1
fi
echo "OK"

# 2. Pull changes on server
echo "[2/3] Atualizando servidor..."
ssh -i $KEY -p $PORT $SERVER "cd $REMOTE_DIR && git pull origin main"
if [ $? -ne 0 ]; then
    echo "ERRO: Falha ao atualizar servidor"
    exit 1
fi
echo "OK"

# 3. Reload nginx to clear cache
echo "[3/3] Recarregando Nginx..."
ssh -i $KEY -p $PORT $SERVER "sudo docker exec signsimples-nginx-1 nginx -s reload"
echo "OK"

echo ""
echo "=== Deploy concluído! ==="
echo "Site: http://papodebola.net (ou pelo IP do servidor)"
