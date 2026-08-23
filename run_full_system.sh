#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================="
echo "CareSync Hospital Manager - Local Setup"
echo "========================================="

# 1. Load Environment Variables from .env file if it exists
ENV_FILE="$(dirname "$0")/.env"
if [ -f "$ENV_FILE" ]; then
    echo "Loading environment variables from .env file..."
    # Export variables ignoring comments and empty lines
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo "WARNING: .env configuration file not found at $ENV_FILE"
    echo "Using default/empty variables."
fi

# 2. Free up ports 8080, 5173, and 5174 by killing any orphaned processes
echo "Cleaning up local ports..."
lsof -t -i:8080 | xargs kill -9 2>/dev/null || true
lsof -t -i:5173 | xargs kill -9 2>/dev/null || true
lsof -t -i:5174 | xargs kill -9 2>/dev/null || true

# Add Postgres.app and Maven binaries path to PATH immediately
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:/Users/air/maven/bin:$PATH"

# 3. Check if Postgres is running
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "Postgres database server is not running."
    echo "Please open Applications -> Postgres.app and click Initialize/Start."
    exit 1
fi

# 4. Locate JDK 21
echo "Locating JDK 21..."
if [ -d "/Users/air/jdk21/Contents/Home" ]; then
    export JAVA_HOME="/Users/air/jdk21/Contents/Home"
elif [ -d "/Users/air/jdk21" ]; then
    export JAVA_HOME="/Users/air/jdk21"
elif [ -x "/usr/libexec/java_home" ]; then
    export JAVA_HOME=$(/usr/libexec/java_home -v 21 2>/dev/null || echo "")
fi

if [ -z "$JAVA_HOME" ] || [ ! -d "$JAVA_HOME" ]; then
    echo "JDK 21 could not be located."
    echo "Please ensure you have installed Java 21."
    exit 1
fi

export PATH="$JAVA_HOME/bin:$PATH"

echo "Using Java Home: $JAVA_HOME"
echo "Java Version:"
java -version

# 5. Create database if it does not exist
echo "Checking database..."
if ! psql -h localhost -U postgres -lqt | cut -d \| -f 1 | grep -qw hospital_db; then
    echo "Creating database 'hospital_db'..."
    createdb -h localhost -U postgres hospital_db
else
    echo "Database 'hospital_db' already exists."
fi

# 6. Start Spring Boot Backend using global Maven
echo "Starting Spring Boot Backend..."
cd "$(dirname "$0")/backend"
mvn spring-boot:run &
BACKEND_PID=$!

echo "Backend started in background with PID: $BACKEND_PID"

# 7. Start React Frontend
echo "Starting React Frontend..."
cd "../frontend"
npm run dev &
FRONTEND_PID=$!

echo "Frontend started in background with PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both servers."

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
