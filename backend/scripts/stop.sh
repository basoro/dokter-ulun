#!/bin/bash

# Dokter Ulun Backend Stop Script

echo "🛑 Stopping Dokter Ulun Backend Server..."
echo "====================================="

# Function to kill process by port
kill_by_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    
    if [ ! -z "$pid" ]; then
        echo "🔍 Found process $pid running on port $port"
        kill -TERM $pid 2>/dev/null
        
        # Wait for graceful shutdown
        sleep 2
        
        # Check if process is still running
        if kill -0 $pid 2>/dev/null; then
            echo "⚠️  Process still running, forcing kill..."
            kill -KILL $pid 2>/dev/null
        fi
        
        echo "✅ Process $pid stopped"
    else
        echo "ℹ️  No process found running on port $port"
    fi
}

# Get port from .env file
if [ -f ".env" ]; then
    PORT=$(grep PORT .env | cut -d '=' -f2)
    if [ ! -z "$PORT" ]; then
        echo "🔌 Stopping server on port $PORT..."
        kill_by_port $PORT
    fi
fi

# Also try default port 3000
echo "🔌 Checking default port 3000..."
kill_by_port 3000

# Kill any node processes that might be running the backend
echo "🔍 Looking for node processes..."
PROCESSES=$(ps aux | grep "[n]ode.*index.js" | awk '{print $2}')

if [ ! -z "$PROCESSES" ]; then
    echo "🛑 Stopping node processes: $PROCESSES"
    echo $PROCESSES | xargs kill -TERM 2>/dev/null
    sleep 2
    
    # Force kill if still running
    STILL_RUNNING=$(ps aux | grep "[n]ode.*index.js" | awk '{print $2}')
    if [ ! -z "$STILL_RUNNING" ]; then
        echo "⚠️  Force killing remaining processes: $STILL_RUNNING"
        echo $STILL_RUNNING | xargs kill -KILL 2>/dev/null
    fi
fi

# Kill nodemon processes
echo "🔍 Looking for nodemon processes..."
NODEMON_PROCESSES=$(ps aux | grep "[n]odemon" | awk '{print $2}')

if [ ! -z "$NODEMON_PROCESSES" ]; then
    echo "🛑 Stopping nodemon processes: $NODEMON_PROCESSES"
    echo $NODEMON_PROCESSES | xargs kill -TERM 2>/dev/null
    sleep 1
    
    # Force kill if still running
    STILL_RUNNING=$(ps aux | grep "[n]odemon" | awk '{print $2}')
    if [ ! -z "$STILL_RUNNING" ]; then
        echo "⚠️  Force killing remaining nodemon processes: $STILL_RUNNING"
        echo $STILL_RUNNING | xargs kill -KILL 2>/dev/null
    fi
fi

echo "✅ Backend server stopped successfully"
echo ""
echo "💡 To start the server again, run: ./scripts/start.sh"