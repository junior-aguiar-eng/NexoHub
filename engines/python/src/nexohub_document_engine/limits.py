"""Leitura estrita de limites configuráveis do sidecar."""

from __future__ import annotations

import os


def env_limit(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise RuntimeError(f"O limite configurado em {name} é inválido.") from error
    if not minimum <= value <= maximum:
        raise RuntimeError(f"O limite configurado em {name} é inválido.")
    return value
