#!/bin/bash
echo "🚀 Khởi động Backend (UNO Game)..."
cd backend || { echo "❌ Không tìm thấy thư mục backend!"; exit 1; }

# Chạy server với uvicorn, hỗ trợ hot-reload
uvicorn main:socket_app --host 0.0.0.0 --port 10000 --reload
