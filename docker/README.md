# Self Host Formbricks Production Instance

Follow this guide to get your Formbricks instance up and running with a Postgres DB and SSL certificate using a single script:

## Requirements

Before you proceed, make sure you have the following:

- A Linux Ubuntu Virtual Machine deployed with SSH access.

- An A record set up to connect a custom domain to your instance. Formbricks will automatically create an SSL certificate for your domain using Let's Encrypt.

## Single Command Setup

Copy and paste the following command into your terminal:

```bash
/bin/sh -c "$(curl -fsSL https://raw.githubusercontent.com/formbricks/formbricks/stable/docker/formbricks.sh)"
```

The script will prompt you for the following information:

1. **Overwriting Docker GPG Keys**: If Docker GPG keys already exist, the script will ask if you want to overwrite them.

2. **Email Address**: Provide your email address for SSL certificate registration with Let's Encrypt.

3. **Domain Name**: Enter the domain name that Traefik will use to create the SSL certificate and forward requests to Formbricks.

That's it! After running the command and providing the required information, visit the domain name you entered, and you should see the Formbricks home wizard!

## Formbricks Hub

The stack includes the [Formbricks Hub](https://github.com/formbricks/hub) API (`ghcr.io/formbricks/hub`). Hub shares the same database as Formbricks by default.

- **Migrations**: A `hub-migrate` service runs Hub's database migrations (goose + river) before the Hub API starts. It runs on every `docker compose up` and is idempotent.
- **Production** (`docker/docker-compose.yml`): Set `HUB_API_KEY` (required). `HUB_API_URL` defaults to `http://hub:8080` so the Formbricks app can reach Hub inside the compose network. Override `HUB_DATABASE_URL` only if you want Hub to use a separate database.
- **Development** (`docker-compose.dev.yml`): Hub uses the same Postgres database; `HUB_API_KEY` defaults to `dev-api-key` (override with `HUB_API_KEY`) and the local Hub URL is `http://localhost:8080`.

In development, Hub is exposed locally on port **8080**. In production Docker Compose, Hub stays internal to the compose network and is reached via `http://hub:8080`.
