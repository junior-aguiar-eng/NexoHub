#!/usr/bin/env bash
# Publica somente recursos candidatos; não altera o URL map nem serviços existentes.
set -euo pipefail
cd "$(dirname "$0")/../.."

project_id='project-bbbe1209-c295-4720-867'
region='southamerica-east1'
service='nexohub-hub'
neg='nexohub-hub-neg'
backend='nexohub-hub-backend'
url_map='forgelex-api-hml-map'
image_uri="${region}-docker.pkg.dev/${project_id}/forgelex-prod/nexohub-hub"

command -v gcloud >/dev/null
command -v node >/dev/null
sha256sum --check --quiet DEPLOY-SHA256SUMS
source_id="$(sha256sum DEPLOY-SHA256SUMS | cut -d ' ' -f 1)"

# Inventário e precondições: qualquer erro aborta antes de publicar o candidato.
repository_format="$(gcloud artifacts repositories describe forgelex-prod --location="$region" --project="$project_id" --format='value(format)')"
[[ "$repository_format" == 'DOCKER' ]] || { echo 'Repositório Docker esperado não encontrado.' >&2; exit 1; }
existing_services="$(gcloud run services list --region="$region" --project="$project_id" --filter="metadata.name=$service" --format='value(metadata.name)')"
[[ -z "$existing_services" ]] || { echo 'Serviço candidato já existe; conferir antes de continuar.' >&2; exit 1; }
existing_backends="$(gcloud compute backend-services list --project="$project_id" --filter="name=$backend" --format='value(name)')"
[[ -z "$existing_backends" ]] || { echo 'Backend candidato já existe; conferir antes de continuar.' >&2; exit 1; }
existing_negs="$(gcloud compute network-endpoint-groups list --project="$project_id" --filter="name=$neg" --format='value(name)')"
[[ -z "$existing_negs" ]] || { echo 'NEG candidato já existe; conferir antes de continuar.' >&2; exit 1; }

evidence_dir="${HOME}/nexohub-hub-${source_id:0:12}-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir "$evidence_dir"
gcloud compute url-maps describe "$url_map" --global --project="$project_id" --format=json > "$evidence_dir/url-map-antes.json"
gcloud compute url-maps export "$url_map" --global --project="$project_id" --destination="$evidence_dir/url-map-rollback.yaml"
backend_link="https://www.googleapis.com/compute/v1/projects/${project_id}/global/backendServices/${backend}"
node scripts/deploy/prepare-hub-url-map.mjs "$evidence_dir/url-map-antes.json" "$backend_link" "$evidence_dir/url-map-candidato.json"

# Um build /hub/ separado mantém o serviço nexohub e o site ForgeLex inalterados.
gcloud builds submit . --config=scripts/deploy/cloudbuild-hub.yaml --project="$project_id" \
  --substitutions="_IMAGE_URI=${image_uri},_SOURCE_SHA=${source_id}"
digest="$(gcloud artifacts docker images describe "${image_uri}:${source_id}-hub" --project="$project_id" --format='value(image_summary.digest)')"
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Digest da imagem não confirmado.' >&2; exit 1; }
gcloud run deploy "$service" --project="$project_id" --region="$region" \
  --image="${image_uri}@${digest}" --allow-unauthenticated --ingress=all \
  --port=8080 --memory=1Gi --cpu=1 --min-instances=0 --max-instances=2 \
  --set-env-vars='HOST=0.0.0.0,STATIC_DIR=/app/dist,RUST_LOG=info' --quiet
candidate_url="$(gcloud run services describe "$service" --region="$region" --project="$project_id" --format='value(status.url)')"
curl --fail --silent --show-error "${candidate_url}/api/v1/health" > "$evidence_dir/health.json"

# Recursos novos no mesmo projeto do Cloud Run; o balanceador ainda não os utiliza.
gcloud compute network-endpoint-groups create "$neg" --region="$region" --project="$project_id" \
  --network-endpoint-type=serverless --cloud-run-service="$service"
gcloud compute backend-services create "$backend" --global --project="$project_id" \
  --load-balancing-scheme=EXTERNAL_MANAGED --protocol=HTTP
gcloud compute backend-services add-backend "$backend" --global --project="$project_id" \
  --network-endpoint-group="$neg" --network-endpoint-group-region="$region"
gcloud compute url-maps validate --source="$evidence_dir/url-map-candidato.json" \
  --global --project="$project_id" --load-balancing-scheme=EXTERNAL_MANAGED --format=json > "$evidence_dir/validacao.json"

printf 'Candidato: %s\nImagem: %s@%s\nEvidências: %s\n' "$candidate_url" "$image_uri" "$digest" "$evidence_dir"
cat "$evidence_dir/validacao.json"
printf '\nNenhuma regra de tráfego foi alterada. Compartilhe esta saída antes da ativação.\n'
