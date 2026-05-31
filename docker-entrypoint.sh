#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting fatoven-api..."
exec node dist/server.js
