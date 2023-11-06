#!/bin/sh

# Start the cron service
crond -l 2 -L /var/log/cron/cron.log
crontab /cron.yaml
tail -f /var/log/cron/cron.log &

# Check if NEXTAUTH_SECRET is set and run the appropriate command
if [ "$NEXTAUTH_SECRET" != "RANDOM_STRING" ]; then
    pnpm dlx prisma migrate deploy
    node apps/web/server.js
else
    echo "ERROR: Please set a value for NEXTAUTH_SECRET in your docker-compose variables!"
    exit 1
fi
