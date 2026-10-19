#!/usr/bin/env bash
# Reviewable host-only test workflow. No publication, submission or credential access.
set +x
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
entry=$(pwd)
official="$entry/../official"
base=cc687957f44307444ea76bb51484734bbced5c04
image=mcr.microsoft.com/playwright@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27
unset LAUNCHPAD_API_KEY LAUNCHPAD_JUDGE_KEY
mkdir -p .work/browser .work/gate
exec 9>.work/heavy.lock
flock -n 9 || { echo 'Another Wildseed test job is running.' >&2; exit 75; }
available=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
(( available >= 2097152 )) || { echo 'Less than 2 GiB available; retry when the host is free.' >&2; exit 75; }
git merge-base --is-ancestor "$base" HEAD
git diff --exit-code "$base" -- .launchpad src/rules.mjs .github/workflows/launchpad-gate.yml
[[ -z "$(git status --porcelain)" ]] || { echo 'Commit the intended candidate locally before running the official gate.' >&2; exit 1; }
printf '%s  %s\n' '78dbfc8e583c6fdb89962b775f3b2630cedc2e85c91b8b3e426c2af66c508e28' "$official/runner_gate.mjs" | sha256sum --check
export XDG_RUNTIME_DIR=/run/user/1000
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
export LAUNCHPAD_CONTAINER=podman
export PATH=/home/hotpod/crt-fighters/runner-tools/usr/bin:$PATH
podman info --format '{{.Host.Security.Rootless}}'
podman image exists "$image" || podman pull "$image"
# All installs, builds, browsers and gates are sequential. Nothing publishes a host port.
npm ci --ignore-scripts --no-audit --no-fund --cache .work/npm-cache 2>&1 | tee .work/install.log
node --test tests/core.test.mjs 2>&1 | tee .work/unit-tests.log
npm run build 2>&1 | tee .work/build.log
podman run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --userns keep-id --user 1000:1000 --cpus 2 --memory 2g --pids-limit 512 \
  --tmpfs /tmp:rw,exec,size=512m,mode=1777 --shm-size 256m \
  -e HOME=/tmp -v "$entry:/work:ro" -v "$entry/.work/browser:/work/.work/browser:rw" \
  -w /work "$image" node tests/browser.mjs 2>&1 | tee .work/browser-review.log
node "$official/runner_gate.mjs" --base "$base" --project wildseed --round 1 \
  --repo "$entry" --container podman --image "$image" --work "$entry/.work/gate" \
  --out "$entry/.work/gate-transcript.json" --verbose 2>&1 | tee .work/gate-run.log
git rev-parse HEAD > .work/tested-commit.txt
sha256sum .work/gate-transcript.json > .work/gate-transcript.sha256
printf '%s\n' 'Tests complete. Evidence is in entry/.work/. Nothing was submitted.'
