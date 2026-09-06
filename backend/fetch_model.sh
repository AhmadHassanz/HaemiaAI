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
echo "fetch_model.sh: URL: ${MODEL_URL}"

if [ -n "${MODEL_TOKEN:-}" ]; then
  echo "fetch_model.sh: MODEL_TOKEN detected - using authenticated download."
  # Bearer works for both classic PATs and fine-grained PATs (github_pat_...).
  curl -L --fail --retry 3 --retry-delay 2 \
    -H "Authorization: Bearer ${MODEL_TOKEN}" \
    -o "$MODEL_PATH" "$MODEL_URL"
else
  echo "fetch_model.sh: MODEL_TOKEN is NOT set - trying anonymous download."
  echo "fetch_model.sh: anonymous download only works for PUBLIC repositories."
  curl -L --fail --retry 3 --retry-delay 2 -o "$MODEL_PATH" "$MODEL_URL"
fi
echo "fetch_model.sh: model downloaded ($(du -h "$MODEL_PATH" | cut -f1))."
