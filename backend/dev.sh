#!/bin/bash
echo "🚀 Khởi động Backend (UNO Game)..."

# Chạy server với uvicorn, hỗ trợ hot-reload
uvicorn main:socket_app --host 0.0.0.0 --port 10000 --reload
