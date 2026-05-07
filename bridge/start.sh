#!/bin/bash
# 启动本地 bridge 服务
# 首次运行前需要：cp .env.example .env，然后 npm install

cd "$(dirname "$0")"

if [ ! -f ".env" ]; then
  echo "⚠️  未找到 .env 文件，请先复制配置："
  echo "   cp .env.example .env"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  npm install
fi

echo "🚀 启动 Bridge 服务..."
node server.js
