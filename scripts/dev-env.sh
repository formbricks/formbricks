#!/usr/bin/env bash

# Read only a literal value; never execute environment-file contents as shell code.
#
# `export KEY=value` is matched as well as a bare assignment: dotenv and @next/env both accept the
# prefix, so a developer whose .env carries it has a secret the app reads and these readers would
# otherwise miss — and a missed NEXTAUTH_SECRET means the generation loop mints a new
# BETTER_AUTH_SECRET and logs them out.
read_env_value() {
  local key="$1"

  awk -F= -v key="${key}" '
    $0 ~ "^[[:space:]]*(export[[:space:]]+)?" key "[[:space:]]*=" {
      value = substr($0, index($0, "=") + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)

      if ((value ~ /^".*"$/) || (value ~ /^'\''.*'\''$/)) {
        value = substr(value, 2, length(value) - 2)
      }

      print value
      exit
    }
  ' "${ENV_PATH}"
}

# Read the assignment exactly as written, with no trimming and no quote stripping. Copying a secret
# between keys has to go through this rather than read_env_value: the trim/unquote above resolves a
# value the way dotenv would, which is right for comparing but wrong for copying — writing the
# resolved form back unquoted changes what dotenv then resolves, and a changed auth secret logs every
# developer out.
read_env_raw_value() {
  local key="$1"

  awk -v key="${key}" '
    $0 ~ "^[[:space:]]*(export[[:space:]]+)?" key "[[:space:]]*=" {
      print substr($0, index($0, "=") + 1)
      exit
    }
  ' "${ENV_PATH}"
}
