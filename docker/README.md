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

- **Migrations**: A `formbricks-migrate` service runs Formbricks Prisma migrations before `hub-migrate` writes Hub tables to the shared database. `hub-migrate` then runs Hub's database migrations (goose + river) before the Hub API starts. Both migration services run on every `docker compose up` and are idempotent.
- **Production** (`docker/docker-compose.yml`): Set non-empty `HUB_API_KEY` and `CUBEJS_API_SECRET` in `.env` before starting the stack. `docker compose config >/dev/null` validates compose syntax, but missing secrets are reported by the service that needs them at startup. `HUB_API_URL` defaults to `http://hub:8080` and `CUBEJS_API_URL` defaults to `http://cube:4000` so the Formbricks app reaches Hub and Cube inside the compose network. Cube JWT issuer/audience default to `formbricks-web` and `formbricks-cube`, and the bundled Cube service exposes only `meta,data` API scopes. Override `HUB_DATABASE_URL` and `CUBEJS_DB_*` only if Hub or Cube should use a separate database. The Hub image tracks `:latest` by default so `formbricks.sh update` advances Hub in lockstep with the app. `hub` and `hub-migrate` always resolve to the same image. To pin to an immutable reference, set `HUB_IMAGE_REF` in `docker/.env` to either a tag (e.g. `:0.3.0`) or a digest (e.g. `@sha256:14db7b3d...`).
- **Development** (`docker-compose.dev.yml`): Hub uses a dedicated local `hub` database and `HUB_API_KEY` defaults to `dev-api-key`. The dev stack starts `hub` plus `hub-worker`; set `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, and any provider credentials in the repo root `.env` to enable Hub embeddings locally. See the [Hub embeddings environment reference](https://hub.formbricks.com/reference/environment-variables/#embeddings) for provider-specific values. Cube starts with the dev stack, `CUBEJS_API_URL` defaults to `http://localhost:4000`, and `pnpm dev:setup` generates `CUBEJS_API_SECRET` in the repo root `.env`. The Hub image is pinned to a semver tag (`hub`, `hub-worker`, and `hub-migrate` share the same value); override `HUB_IMAGE_TAG` in the repo root `.env` to test a specific Hub release.

## Smart Functionality AI with Qwen/vLLM

The Docker stack can optionally run Qwen through vLLM as an OpenAI-compatible `/v1` endpoint. Baseline installs are unchanged: `docker compose up -d` does not start the vLLM service and Formbricks can still run without AI.

To use the bundled Qwen/vLLM service, add these values to `.env`:

```bash
COMPOSE_PROFILES=qwen
AI_PROVIDER=openai-compatible
AI_MODEL=qwen3-14b-awq
AI_OPENAI_COMPATIBLE_BASE_URL=http://vllm:8000/v1
AI_OPENAI_COMPATIBLE_PROVIDER_NAME=vllm
AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS=1
```

Then start the stack with the profile:

```bash
COMPOSE_PROFILES=qwen docker compose up -d
docker compose --profile qwen ps
docker compose logs vllm formbricks
```

The vLLM service requires a GPU-capable Docker host with the NVIDIA Container Toolkit installed. It stores downloaded model files in the `qwen-model-cache` Docker volume and binds the OpenAI-compatible endpoint to `127.0.0.1:8000` by default for local checks.

Use these optional overrides when needed:

```bash
QWEN_VLLM_IMAGE=vllm/vllm-openai:v0.14.0
QWEN_MODEL_ID=Qwen/Qwen3-14B-AWQ
QWEN_SERVED_MODEL_NAME=qwen3-14b-awq
QWEN_MAX_MODEL_LEN=8192
QWEN_MAX_NUM_SEQS=8
QWEN_GPU_MEMORY_UTILIZATION=0.9
QWEN_VLLM_PORT=8000
```

If you run your own Qwen/vLLM service, do not enable the `qwen` profile. Set `AI_PROVIDER=openai-compatible`, `AI_MODEL`, and `AI_OPENAI_COMPATIBLE_BASE_URL` to your endpoint instead.

## AI Taxonomy Beta

The standalone AI taxonomy service is included as an opt-in Docker Compose profile. Baseline installs are unchanged: `docker compose up -d` starts Formbricks, Hub, and Cube, but not taxonomy.

To enable taxonomy in Docker Compose, add the required values to `.env`:

```bash
# Use COMPOSE_PROFILES=taxonomy when taxonomy points at your own LLM endpoint.
# Use COMPOSE_PROFILES=qwen,taxonomy when taxonomy should share the bundled Qwen/vLLM service.
COMPOSE_PROFILES=qwen,taxonomy
TAXONOMY_SERVICE_URL=http://taxonomy:8000
TAXONOMY_SERVICE_TOKEN=<strong-random-secret>
HUB_INTERNAL_API_TOKEN=<strong-random-secret>
TAXONOMY_IMAGE_REF=:v0.1.0
TAXONOMY_LLM_PROVIDER=openai-compatible
TAXONOMY_LLM_MODEL=qwen3-14b-awq
TAXONOMY_LLM_BASE_URL=http://vllm:8000/v1
TAXONOMY_LLM_API_KEY=<api-key-or-dummy-value>
```

Replace `:v0.1.0` with the current released `ghcr.io/formbricks/taxonomy` image tag for your Formbricks version. Production installs should pin a release tag instead of relying on `:latest`.

If you run your own OpenAI-compatible endpoint, keep only the `taxonomy` profile and point `TAXONOMY_LLM_BASE_URL` at that `/v1` endpoint. The selected model must reliably return strict JSON because taxonomy generation validates an exact 5-level tree.

Secret wiring is server-side only: Hub receives `TAXONOMY_SERVICE_URL`, `TAXONOMY_SERVICE_TOKEN`, and `HUB_INTERNAL_API_TOKEN`; taxonomy receives `TAXONOMY_SERVICE_TOKEN`, `HUB_INTERNAL_API_URL`, `HUB_INTERNAL_API_TOKEN`, and the LLM settings. Formbricks Web continues to call Hub with `HUB_API_KEY` and never receives taxonomy service credentials.

To use Amazon Bedrock instead of an OpenAI-compatible endpoint, set:

```bash
TAXONOMY_LLM_PROVIDER=bedrock
TAXONOMY_LLM_MODEL=eu.anthropic.claude-sonnet-4-5-20250929-v1:0
AWS_REGION=eu-north-1
AWS_BEARER_TOKEN_BEDROCK=<bedrock-api-key>
```

Then start the stack with the selected profile set:

```bash
COMPOSE_PROFILES=qwen,taxonomy docker compose up -d
docker compose --profile qwen --profile taxonomy ps
docker compose logs vllm taxonomy hub
```

Run the authenticated preflight after startup to verify Hub internal auth and LLM reachability:

```bash
docker compose --profile taxonomy exec taxonomy python -c 'import os, urllib.request; req = urllib.request.Request("http://127.0.0.1:8000/v1/preflight", headers={"Authorization": "Bearer " + os.environ["TAXONOMY_SERVICE_TOKEN"]}); print(urllib.request.urlopen(req, timeout=10).read().decode())'
```

The taxonomy service remains internal to the compose network by default. For production workloads, `TAXONOMY_MAX_RECORDS` defaults to `50000`. Override it only as an advanced safety limit after sizing CPU, memory, and LLM capacity.

For local unreleased taxonomy testing, build the taxonomy image as `ghcr.io/formbricks/taxonomy:local`, set `TAXONOMY_IMAGE_REF=:local`, and start the stack with `COMPOSE_PROFILES=taxonomy`.

The one-click installer does not prompt for taxonomy settings. One-click users can enable the beta later by editing `./formbricks/.env`, adding the variables above, and restarting with `COMPOSE_PROFILES=taxonomy docker compose up -d`.

In development, Hub is exposed locally on port **8080** and Cube on **4000** (with the Cube playground on **4001**). In production Docker Compose, both stay internal to the compose network at `http://hub:8080` and `http://cube:4000`.

The one-click Traefik installer exposes Hub-backed FeedbackRecords on the Formbricks origin at
`/api/v3/feedbackRecords` and `/v1/feedback-records`. Traefik uses Formbricks gateway auth, rewrites the v3
path to Hub's `/v1/feedback-records`, injects `Authorization: Bearer ${HUB_API_KEY}` for Hub, and strips client
API key/cookie headers before the Hub hop.
