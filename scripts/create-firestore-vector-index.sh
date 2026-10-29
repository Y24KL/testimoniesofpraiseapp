#!/usr/bin/env bash
set -euo pipefail
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-testimoniesofpraiseapp}"

# Create a vector index on published testimony docs; BGE-M3 currently returns 1,024 dimensions.
# This is a one-time command. The index can take a few minutes to build.
gcloud firestore indexes composite create \
  --project="$PROJECT_ID" \
  --collection-group=testimonies \
  --query-scope=COLLECTION \
  --field-config=field-path=isPublished,order=ASCENDING \
  --field-config='field-path=aiEmbedding,vector-config={"dimension":1024,"flat":{}}'
