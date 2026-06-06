#!/bin/bash

# Dokter Ulun Backend Startup Script

echo "🚀 Starting Dokter Ulun Backend Server..."
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to backend directory
cd "$(dirname "$0")/.."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the backend directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating template..."
    cat > .env << EOF
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=test
MYSQL_PORT=3306
FRONTEND_URL=http://localhost:8084
NODE_ENV=development
PORT=3000
EOF
    echo "📝 Please edit .env file with your database configuration."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies."
        exit 1
    fi
fi

# Check if all required dependencies are installed
echo "🔍 Checking dependencies..."
npm list --depth=0 > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "📦 Installing missing dependencies..."
    npm install
fi

# Start the server
echo "🌐 Starting server..."
echo "📍 Environment: $(grep NODE_ENV .env | cut -d '=' -f2)"
echo "🔌 Port: $(grep PORT .env | cut -d '=' -f2)"
echo ""

# Check if we should run in development or production mode
if grep -q "NODE_ENV=production" .env; then
    echo "🚀 Starting in production mode..."
    npm start
else
    echo "🔧 Starting in development mode..."
    if command -v nodemon &> /dev/null; then
        npm run dev
    else
        echo "⚠️  nodemon not found, installing..."
        npm install -g nodemon
        npm run dev
    fi
fi