#!/usr/bin/env bash
# Downloads the Keras model from a GitHub Release when MODEL_URL is set.
# The model file (~110 MB) exceeds GitHub's 100 MB per-file limit, so it is
# shipped as a release asset instead of living in the repository.
#
# Env vars:
#   MODEL_URL    - required - asset URL, e.g.
#                 https://github.com/<user>/<repo>/releases/download/v1.0/haemia_research_demo.keras
#   MODEL_TOKEN  - optional - GitHub token; REQUIRED when the repo is private.
#                 Use a fine-grained PAT with Contents: Read-only on this repo.
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

echo "fetch_model.sh: downloading model from release asset..."
if [ -n "${MODEL_TOKEN:-}" ]; then
  # Private repo: authenticate against github.com; the signed redirect
  # to objects.githubusercontent.com needs no further auth.
  curl -L --fail --retry 3 --retry-delay 2 \
    -H "Authorization: token ${MODEL_TOKEN}" \
    -o "$MODEL_PATH" "$MODEL_URL"
else
  curl -L --fail --retry 3 --retry-delay 2 -o "$MODEL_PATH" "$MODEL_URL"
fi
echo "fetch_model.sh: model downloaded ($(du -h "$MODEL_PATH" | cut -f1))."
