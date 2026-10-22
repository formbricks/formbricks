# Redis TLS configuration

`getRedisTlsOptions(redisUrl, caPem?)` is shared by the cache, authentication storage, and job connections. `redis://` keeps plaintext development behavior when no CA is configured. `rediss://` always verifies the server certificate and hostname, including while a deployment still has a legacy global TLS bypass.

`REDIS_TLS_CA` accepts one or more PEM CA certificates, separated by newlines. It replaces the default CA list only for Redis connections. It never changes the process-wide HTTPS trust store. An empty, malformed, non-CA, or plaintext/CA configuration fails closed without logging the PEM or URL credentials. Public-CA Redis installations can leave it unset.

For CA rotation, distribute the old and new CA certificates together, restart every application and worker process, rotate Redis, then remove the retired CA and restart again. Secret updates alone do not reload environment variables or established connections.

## Verify against real TLS

Build the web dependencies first:

```sh
pnpm build --filter=@formbricks/web^...
pnpm --filter @formbricks/web exec tsx scripts/verify-redis-tls.mjs
```

The harness requires a TLS-capable `redis-server` and OpenSSL 3 on `PATH`. Set `REDIS_SERVER_BIN` or `OPENSSL_BIN` to override their locations. It creates disposable loopback-only servers and certificates, verifies cache, authentication records/rate limits, and BullMQ processing, and checks missing/wrong CA, hostname mismatch, expiration, and unrelated self-signed HTTPS rejection. No deployed Redis credentials are used.
