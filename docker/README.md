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

## Formbricks Hub and Cube

The stack includes the [Formbricks Hub](https://github.com/formbricks/hub) API (`ghcr.io/formbricks/hub`) and the bundled Cube service. Hub and Cube share the same database as Formbricks by default and both start as part of the baseline `docker compose up`.

- **Migrations**: A `hub-migrate` service runs Hub's database migrations (goose + river) before the Hub API starts. It runs on every `docker compose up` and is idempotent.
- **Production** (`docker/docker-compose.yml`): Set `HUB_API_KEY` and `CUBEJS_API_SECRET` (both required). `HUB_API_URL` defaults to `http://hub:8080` and `CUBEJS_API_URL` defaults to `http://cube:4000` so the Formbricks app reaches Hub and Cube inside the compose network. Cube JWT issuer/audience default to `formbricks-web` and `formbricks-cube`, and the bundled Cube service exposes only `meta,data` API scopes. Override `HUB_DATABASE_URL` and `CUBEJS_DB_*` only if Hub or Cube should use a separate database. The Hub image tracks `:latest` by default so `formbricks.sh update` advances Hub in lockstep with the app. `hub` and `hub-migrate` always resolve to the same image. To pin to an immutable reference, set `HUB_IMAGE_REF` in `docker/.env` to either a tag (e.g. `:0.3.0`) or a digest (e.g. `@sha256:14db7b3d...`).
- **Development** (`docker-compose.dev.yml`): Hub uses a dedicated local `hub` database and `HUB_API_KEY` defaults to `dev-api-key`. The dev stack starts `hub` plus `hub-worker`; set `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, and any provider credentials in the repo root `.env` to enable Hub embeddings locally. See the [Hub embeddings environment reference](https://hub.formbricks.com/reference/environment-variables/#embeddings) for provider-specific values. Cube starts with the dev stack, `CUBEJS_API_URL` defaults to `http://localhost:4000`, and `pnpm dev:setup` generates `CUBEJS_API_SECRET` in the repo root `.env`. The Hub image is pinned to a semver tag (`hub`, `hub-worker`, and `hub-migrate` share the same value); override `HUB_IMAGE_TAG` in the repo root `.env` to test a specific Hub release.

In development, Hub is exposed locally on port **8080** and Cube on **4000** (with the Cube playground on **4001**). In production Docker Compose, both stay internal to the compose network at `http://hub:8080` and `http://cube:4000`.

The one-click Traefik installer exposes Hub-backed FeedbackRecords on the Formbricks origin at
`/api/v3/feedbackRecords` and `/v1/feedback-records`. Traefik uses Formbricks gateway auth, rewrites the v3
path to Hub's `/v1/feedback-records`, injects `Authorization: Bearer ${HUB_API_KEY}` for Hub, and strips client
API key/cookie headers before the Hub hop.
