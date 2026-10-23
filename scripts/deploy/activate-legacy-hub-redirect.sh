#!/usr/bin/env bash
set -euo pipefail

readonly project="ratione-nexojuris"
readonly url_map="ratione-urlmap"
readonly generator="${HOME}/prepare-legacy-hub-redirect.mjs"
readonly evidence_dir="${HOME}/nexohub-legacy-redirect-$(date -u +%Y%m%dT%H%M%SZ)"

if [[ ! -f "${generator}" ]]; then
  printf 'Envie prepare-legacy-hub-redirect.mjs para %s e tente novamente.\n' "${HOME}" >&2
  exit 1
fi

mkdir -m 700 "${evidence_dir}"
gcloud compute url-maps export "${url_map}" \
  --global --project="${project}" \
  --destination="${evidence_dir}/rollback.yaml"
gcloud compute url-maps describe "${url_map}" \
  --global --project="${project}" --format=json \
  > "${evidence_dir}/antes.json"

node "${generator}" "${evidence_dir}/antes.json" "${evidence_dir}/candidato.json"
gcloud compute url-maps validate \
  --source="${evidence_dir}/candidato.json" \
  --global --project="${project}" \
  --load-balancing-scheme=EXTERNAL_MANAGED

# Refuse the import if another operator changed the map after the snapshot.
gcloud compute url-maps describe "${url_map}" \
  --global --project="${project}" --format=json \
  > "${evidence_dir}/antes-da-aplicacao.json"
if ! cmp --silent "${evidence_dir}/antes.json" "${evidence_dir}/antes-da-aplicacao.json"; then
  printf 'O URL map mudou durante a preparação. Nenhuma alteração foi aplicada. Evidências: %s\n' "${evidence_dir}" >&2
  exit 1
fi

gcloud compute url-maps import "${url_map}" \
  --source="${evidence_dir}/candidato.json" \
  --global --project="${project}" --quiet

printf 'Backup e respostas salvos em %s\n' "${evidence_dir}"
printf 'Rollback: gcloud compute url-maps import %s --source=%s/rollback.yaml --global --project=%s\n' \
  "${url_map}" "${evidence_dir}" "${project}"

# A successful import does not establish that the new map has reached public frontends.
# Check exact destinations and retry while the configuration propagates, without reimporting it.
readonly deadline=$((SECONDS + 600))
readonly paths=('/?origem=subdominio' '/pdf?origem=subdominio' '/hub/pdf?origem=subdominio')
readonly targets=(
  'https://nexojuris.ia.br/hub/?origem=subdominio'
  'https://nexojuris.ia.br/hub/pdf?origem=subdominio'
  'https://nexojuris.ia.br/hub/pdf?origem=subdominio'
)
while true; do
  passed=true
  for index in "${!paths[@]}"; do
    actual=$(curl --silent --show-error --max-time 15 --output /dev/null \
      --dump-header "${evidence_dir}/resposta-${index}.txt" \
      --write-out '%{http_code} %{redirect_url}' \
      "https://nexohub.nexojuris.ia.br${paths[index]}") || actual='erro de conexão'
    if [[ "${actual}" != "301 ${targets[index]}" ]]; then
      passed=false
      printf 'Ainda aguardando %s: %s\n' "${paths[index]}" "${actual}"
    fi
  done
  for path in '/' '/hub/'; do
    code=$(curl --silent --show-error --max-time 15 --output /dev/null \
      --write-out '%{http_code}' "https://nexojuris.ia.br${path}") || code='erro de conexão'
    if [[ "${code}" != '200' ]]; then
      passed=false
      printf 'Destino %s ainda não confirmado: %s\n' "${path}" "${code}"
    fi
  done
  if [[ "${passed}" == true ]]; then
    printf 'Confirmado: 301 com caminhos e query corretos; raiz e /hub/ respondem 200.\n'
    break
  fi
  if (( SECONDS >= deadline )); then
    printf 'Mapa aplicado, mas a conferência pública não passou em 10 minutos. Consulte as respostas em %s.\n' "${evidence_dir}" >&2
    exit 1
  fi
  printf 'Nova conferência em 10 segundos; nenhuma regra será reaplicada.\n'
  sleep 10
done
