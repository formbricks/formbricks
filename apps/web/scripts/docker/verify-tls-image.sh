#!/usr/bin/env bash
# Checks which CA store a built image's Node trusts (ENG-4065); the checks live in verify-tls.mjs.
#
#   verify-tls-image.sh <image>                    offline: throwaway PKI, no network
#   verify-tls-image.sh <image> --incident-hosts   needs network: the published eMudhra chains must be rejected
#
# The PKI is generated per run so no private key is committed. It mirrors the incident's shape:
# a root the OS store trusts, an intermediate the server sends, and a leaf.
set -euo pipefail

image="${1:?usage: verify-tls-image.sh <image> [--incident-hosts]}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
verifier=(-v "$here/verify-tls.mjs:/verify-tls.mjs:ro")

if [[ "${2:-}" == "--incident-hosts" ]]; then
  exec docker run --rm --entrypoint node "${verifier[@]}" "$image" /verify-tls.mjs --incident-hosts
fi

pki="$(mktemp -d)"
trap 'rm -rf "$pki"' EXIT
cd "$pki"

# Extension sections live in a config file rather than -addext, which older LibreSSL (macOS) lacks.
cat > ext.cnf <<'EOF'
[root]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
[intermediate]
basicConstraints = critical,CA:TRUE,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
[leaf]
basicConstraints = CA:FALSE
subjectAltName = DNS:localhost
EOF

# One request config per subject: LibreSSL ignores -subj when the config sets prompt = no, and it does
# not expand environment variables in the config.
request_config() {
  local common_name="$1" output="$2"
  { printf '[req]\ndistinguished_name = dn\nprompt = no\n[dn]\nCN = %s\n' "$common_name"; cat ext.cnf; } > "$output"
}

# openssl is chatty on success; show its output only when a step fails.
quiet() {
  local output
  output="$("$@" 2>&1)" || {
    echo "$output" >&2
    return 1
  }
}

for name in root intermediate leaf self; do
  quiet openssl ecparam -name prime256v1 -genkey -noout -out "$name.key"
done

request_config "Formbricks TLS Test Root" root.cnf
request_config "Formbricks TLS Test Intermediate" intermediate.cnf
request_config "localhost" leaf.cnf

quiet openssl req -x509 -new -key root.key -sha256 -days 7 -config root.cnf -extensions root -out root.pem
quiet openssl req -new -key intermediate.key -config intermediate.cnf -out intermediate.csr
quiet openssl x509 -req -in intermediate.csr -CA root.pem -CAkey root.key -CAcreateserial -sha256 -days 7 \
  -extfile ext.cnf -extensions intermediate -out intermediate.pem
quiet openssl req -new -key leaf.key -config leaf.cnf -out leaf.csr
quiet openssl x509 -req -in leaf.csr -CA intermediate.pem -CAkey intermediate.key -CAcreateserial -sha256 \
  -days 7 -extfile ext.cnf -extensions leaf -out leaf.pem
cat leaf.pem intermediate.pem > chain.pem
quiet openssl req -x509 -new -key self.key -sha256 -days 7 -config leaf.cnf -extensions leaf -out self.pem

# The container's user differs from the one that owns this directory.
chmod -R a+rX "$pki"

docker run --rm --network none --entrypoint node "${verifier[@]}" -v "$pki:/pki:ro" "$image" /verify-tls.mjs /pki
