#!/bin/bash

# Dokter Ulun Backend Setup Script

echo "⚙️  Setting up Dokter Ulun Backend..."
echo "==================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "💡 Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Navigate to backend directory
cd "$(dirname "$0")/.."

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Database Configuration
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=sik
MYSQL_PORT=3306

# Server Configuration
FRONTEND_URL=http://localhost:8084
NODE_ENV=development
PORT=3000

# Security (optional)
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-super-secret-session-key
EOF
    echo "✅ .env file created"
    echo "⚠️  Please edit .env file with your actual database configuration"
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x scripts/*.sh
echo "✅ Scripts are now executable"

# Test database connection
echo "🔍 Testing database connection..."
node -e "
const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: process.env.MYSQL_PORT
        });
        
        await connection.execute('SELECT 1');
        await connection.end();
        
        console.log('✅ Database connection successful');
        process.exit(0);
    } catch (error) {
        console.log('❌ Database connection failed:', error.message);
        console.log('💡 Please check your .env configuration');
        process.exit(1);
    }
}

testConnection();
"

DB_TEST_RESULT=$?

echo ""
echo "🎉 Setup completed!"
echo "=================="
echo ""

if [ $DB_TEST_RESULT -eq 0 ]; then
    echo "✅ Database connection: OK"
    echo "🚀 You can now start the server with: ./scripts/start.sh"
else
    echo "⚠️  Database connection: FAILED"
    echo "📝 Please edit .env file with correct database settings"
    echo "🔧 Then run: ./scripts/start.sh"
fi

echo ""
echo "📚 Available commands:"
echo "  ./scripts/start.sh  - Start the backend server"
echo "  ./scripts/stop.sh   - Stop the backend server"
echo "  npm run dev         - Start in development mode"
echo "  npm start           - Start in production mode"
echo "  npm test            - Run tests (if available)"
echo ""
echo "📖 For more information, see README.md"