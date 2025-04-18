#!/bin/sh
# verify-components.sh
echo "Checking security-critical components..."
busybox --help | head -n1
openssl version
sqlite3 --version
apk info -v libxml2
apk info -v zstd