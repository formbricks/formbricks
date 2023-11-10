#!/bin/sh

# Generate a random 32-character hexadecimal string using openssl rand
CRON_SECRET=$(openssl rand -hex 32)

# Export the CRON_SECRET as an environment variable
export CRON_SECRET

# Start the cron service
crond -l 2 -L /var/log/cron/cron.log

# Schedule all the cron jobs in the /cron directory
for file in /cron/cron-*; do
    crontab $file
done

# Check if NEXTAUTH_SECRET is set and run the appropriate command
if [ "$NEXTAUTH_SECRET" != "RANDOM_STRING" ]; then
    pnpm dlx prisma migrate deploy
    node apps/web/server.js
else
    echo "ERROR: Please set a value for NEXTAUTH_SECRET in your docker-compose variables!"
    exit 1
fi
