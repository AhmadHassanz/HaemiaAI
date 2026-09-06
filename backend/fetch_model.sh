#!/usr/bin/env bash
# Downloads the Keras model from a GitHub Release when MODEL_URL is set.
# The model file (~110 MB) exceeds GitHub's 100 MB per-file limit, so it is
# shipped as a release asset instead of living in the repository.
#
# Env vars:
#   MODEL_URL    - required - asset URL, e.g.
#                 https://github.com/<user>/<repo>/releases/download/v1.0/haemia_research_demo.keras
#   MODEL_TOKEN  - optional - GitHub token; REQUIRED when the repo is private.
#                 Fine-grained PAT with Contents: Read-only on this repo.
#
# NOTE: the plain releases/download URL returns 404 for PRIVATE repos even
# with a valid token — private assets must be fetched through the GitHub API,
# which is what this script does (works for public repos anonymously too).
set -euo pipefail

MODEL_PATH="model/haemia_research_demo.keras"

if [ -f "$MODEL_PATH" ]; then
  echo "fetch_model.sh: model already present, skipping download."
  exit 0
fi

if [ -z "${MODEL_URL:-}" ]; then
  echo "fetch_model.sh: MODEL_URL is not set - the backend will run in mock mode."
  exit 0
fi

# Parse https://github.com/<owner>/<repo>/releases/download/<tag>/<file>
url_path="${MODEL_URL#https://github.com/}"
owner="$(printf '%s' "$url_path" | cut -d/ -f1)"
repo="$(printf '%s' "$url_path" | cut -d/ -f2)"
tag="$(printf '%s' "$url_path" | cut -d/ -f5)"
filename="$(printf '%s' "$url_path" | cut -d/ -f6)"

echo "fetch_model.sh: owner=${owner} repo=${repo} tag=${tag} file=${filename}"

auth_args=()
if [ -n "${MODEL_TOKEN:-}" ]; then
  echo "fetch_model.sh: MODEL_TOKEN detected - using authenticated download."
  auth_args=(-H "Authorization: Bearer ${MODEL_TOKEN}")
else
  echo "fetch_model.sh: MODEL_TOKEN not set - anonymous download (public repos only)."
fi

echo "fetch_model.sh: resolving asset id from the GitHub API..."
asset_url=$(curl -fsSL ${auth_args[@]+"${auth_args[@]}"} \
  "https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
for asset in data.get('assets', []):
    if asset['name'] == '${filename}':
        print(asset['url'])
        break
else:
    raise SystemExit('asset not found in release')
")

echo "fetch_model.sh: downloading model (this can take a minute)..."
curl -fsSL ${auth_args[@]+"${auth_args[@]}"} \
  -H "Accept: application/octet-stream" \
  -o "$MODEL_PATH" "$asset_url"

echo "fetch_model.sh: model downloaded ($(du -h "$MODEL_PATH" | cut -f1))."
