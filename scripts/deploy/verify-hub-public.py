"""Confere o contrato público da migração sem alterar configuração ou seguir redirects."""

import argparse
import json
import re
import time
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def fetch_url(url):
    opener = urllib.request.build_opener(NoRedirect)
    try:
        response = opener.open(url, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.code, response.headers, response.read()


def verify(fetch=fetch_url):
    failures = []
    for path, target in [
        ("/?origem=deploy", "/hub/?origem=deploy"),
        ("/pdf?origem=deploy", "/hub/pdf?origem=deploy"),
        ("/hub/pdf?origem=deploy", "/hub/pdf?origem=deploy"),
    ]:
        try:
            code, headers, _ = fetch("https://nexohub.nexojuris.ia.br" + path)
            location = headers.get("Location")
            expected = "https://nexojuris.ia.br" + target
            if code != 301 or location != expected:
                failures.append(f"{path}: HTTP {code}, Location={location}; esperado 301 {expected}")
        except Exception as error:
            failures.append(f"{path}: {error}")

    for path in ["/", "/hub/", "/hub/pdf", "/hub/img", "/hub/api/v1/health"]:
        try:
            code, _, body = fetch("https://nexojuris.ia.br" + path)
            if code != 200:
                raise ValueError(f"HTTP {code}")
            if path.endswith("/health"):
                if json.loads(body).get("status") != "healthy":
                    raise ValueError("API sem status healthy")
            elif path.startswith("/hub"):
                title = re.search(r"<title[^>]*>(.*?)</title>", body.decode("utf-8"), re.I | re.S)
                if not title or "NexoHub" not in title.group(1):
                    raise ValueError("Título recebido não identifica NexoHub")
        except Exception as error:
            failures.append(f"{path}: {error}")
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--attempts", type=int, default=1)
    parser.add_argument("--delay", type=float, default=10)
    args = parser.parse_args()
    if args.attempts < 1 or args.delay < 0:
        parser.error("attempts deve ser positivo e delay não pode ser negativo")
    for attempt in range(args.attempts):
        failures = verify()
        if not failures:
            print("Confirmado: 301 e destinos corretos; raiz, catálogos PDF/Imagem e API respondendo.", flush=True)
            return 0
        print(f"Conferência {attempt + 1}/{args.attempts}: " + "; ".join(failures), flush=True)
        if attempt + 1 < args.attempts:
            time.sleep(args.delay)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
