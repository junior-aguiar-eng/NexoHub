"""Extração estruturada de entidades, chave-valor, seções e tabelas em documentos."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

import pypdfium2 as pdfium

from .limits import env_limit

MAX_INPUT_BYTES = env_limit(
    "NEXOHUB_EXTRACT_MAX_INPUT_BYTES", 64 * 1024 * 1024, minimum=1024, maximum=256 * 1024 * 1024
)
MAX_TEXT_CHARACTERS = env_limit(
    "NEXOHUB_EXTRACT_MAX_CHARACTERS", 10_000_000, minimum=10_000, maximum=50_000_000
)


class ExtractionInputError(ValueError):
    """Entrada de extração inválida ou não suportada."""


@dataclass(frozen=True, slots=True)
class ExtractedEntity:
    category: str
    value: str
    normalized_value: str
    confidence: float
    count: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "category": self.category,
            "value": self.value,
            "normalizedValue": self.normalized_value,
            "confidence": self.confidence,
            "count": self.count,
        }


@dataclass(frozen=True, slots=True)
class ExtractedTable:
    title: str | None
    headers: list[str]
    rows: list[list[str]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "headers": self.headers,
            "rows": self.rows,
        }


@dataclass(frozen=True, slots=True)
class ExtractedSection:
    title: str
    level: int
    line_number: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "level": self.level,
            "lineNumber": self.line_number,
        }


@dataclass(frozen=True, slots=True)
class ExtractionResult:
    text: str
    markdown: str
    mode: str
    metrics: dict[str, Any]
    entities: list[ExtractedEntity]
    key_values: dict[str, str]
    tables: list[ExtractedTable]
    sections: list[ExtractedSection]

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "markdown": self.markdown,
            "mode": self.mode,
            "metrics": self.metrics,
            "entities": [entity.to_dict() for entity in self.entities],
            "keyValues": self.key_values,
            "tables": [table.to_dict() for table in self.tables],
            "sections": [section.to_dict() for section in self.sections],
        }


# --- Funções de Validação de Documentos Oficiais (CPF / CNPJ) ---


def validate_cpf(digits: str) -> bool:
    if len(digits) != 11 or len(set(digits)) == 1:
        return False
    s = sum(int(digits[i]) * (10 - i) for i in range(9))
    d1 = (s * 10 % 11) % 10
    if d1 != int(digits[9]):
        return False
    s = sum(int(digits[i]) * (11 - i) for i in range(10))
    d2 = (s * 10 % 11) % 10
    return d2 == int(digits[10])


def validate_cnpj(digits: str) -> bool:
    if len(digits) != 14 or len(set(digits)) == 1:
        return False
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s1 = sum(int(digits[i]) * weights1[i] for i in range(12))
    rem1 = s1 % 11
    d1 = 0 if rem1 < 2 else 11 - rem1
    if d1 != int(digits[12]):
        return False
    weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s2 = sum(int(digits[i]) * weights2[i] for i in range(13))
    rem2 = s2 % 11
    d2 = 0 if rem2 < 2 else 11 - rem2
    return d2 == int(digits[13])


# --- Extração de Entidades Nomeadas e Campos ---


def extract_entities_from_text(text: str) -> list[ExtractedEntity]:
    entities: list[ExtractedEntity] = []

    # 1. CPF
    cpf_pattern = re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b")
    cpf_counts: dict[str, int] = {}
    for match in cpf_pattern.finditer(text):
        raw = match.group(0)
        clean = re.sub(r"\D", "", raw)
        if len(clean) == 11:
            cpf_counts[raw] = cpf_counts.get(raw, 0) + 1
    for raw, count in cpf_counts.items():
        clean = re.sub(r"\D", "", raw)
        is_valid = validate_cpf(clean)
        formatted = f"{clean[:3]}.{clean[3:6]}.{clean[6:9]}-{clean[9:]}"
        entities.append(
            ExtractedEntity(
                category="cpf",
                value=raw,
                normalized_value=formatted,
                confidence=1.0 if is_valid else 0.5,
                count=count,
            )
        )

    # 2. CNPJ
    cnpj_pattern = re.compile(r"\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b|\b\d{14}\b")
    cnpj_counts: dict[str, int] = {}
    for match in cnpj_pattern.finditer(text):
        raw = match.group(0)
        clean = re.sub(r"\D", "", raw)
        if len(clean) == 14:
            cnpj_counts[raw] = cnpj_counts.get(raw, 0) + 1
    for raw, count in cnpj_counts.items():
        clean = re.sub(r"\D", "", raw)
        is_valid = validate_cnpj(clean)
        formatted = f"{clean[:2]}.{clean[2:5]}.{clean[5:8]}/{clean[8:12]}-{clean[12:]}"
        entities.append(
            ExtractedEntity(
                category="cnpj",
                value=raw,
                normalized_value=formatted,
                confidence=1.0 if is_valid else 0.5,
                count=count,
            )
        )

    # 3. E-mail
    email_pattern = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
    email_counts: dict[str, int] = {}
    for match in email_pattern.finditer(text):
        val = match.group(0).lower()
        email_counts[val] = email_counts.get(val, 0) + 1
    for val, count in email_counts.items():
        entities.append(
            ExtractedEntity(
                category="email",
                value=val,
                normalized_value=val,
                confidence=0.98,
                count=count,
            )
        )

    # 4. Telefone brasileiro
    phone_pattern = re.compile(
        r"(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*)?(?:(9\s*\d{4})|(\d{4}))[-\s]?(\d{4})\b"
    )
    phone_counts: dict[str, int] = {}
    for match in phone_pattern.finditer(text):
        raw = match.group(0).strip()
        clean = re.sub(r"\D", "", raw)
        if 8 <= len(clean) <= 13:
            phone_counts[raw] = phone_counts.get(raw, 0) + 1
    for raw, count in phone_counts.items():
        clean = re.sub(r"\D", "", raw)
        entities.append(
            ExtractedEntity(
                category="phone",
                value=raw,
                normalized_value=clean,
                confidence=0.90,
                count=count,
            )
        )

    # 5. CEP
    cep_pattern = re.compile(r"\b\d{5}-\d{3}\b")
    cep_counts: dict[str, int] = {}
    for match in cep_pattern.finditer(text):
        raw = match.group(0)
        cep_counts[raw] = cep_counts.get(raw, 0) + 1
    for raw, count in cep_counts.items():
        entities.append(
            ExtractedEntity(
                category="cep",
                value=raw,
                normalized_value=raw,
                confidence=0.95,
                count=count,
            )
        )

    # 6. Valores Monetários (BRL, USD, EUR)
    money_pattern = re.compile(
        r"(?:(R\$|\$|€|USD|EUR|BRL)\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?)"
        r"|"
        r"(?:(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))\s*(reais|dólares|dolares|euros))",
        re.IGNORECASE,
    )
    money_counts: dict[str, int] = {}
    for match in money_pattern.finditer(text):
        raw = match.group(0).strip()
        money_counts[raw] = money_counts.get(raw, 0) + 1
    for raw, count in money_counts.items():
        num_part = re.search(r"(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?", raw)
        normalized = raw
        if num_part:
            integers = num_part.group(1).replace(".", "")
            cents = num_part.group(2) or "00"
            normalized = f"{integers}.{cents}"
        entities.append(
            ExtractedEntity(
                category="money",
                value=raw,
                normalized_value=normalized,
                confidence=0.92,
                count=count,
            )
        )

    # 7. Datas (BR: DD/MM/AAAA e extenso)
    date_pattern = re.compile(
        r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b"
        r"|"
        r"\b(\d{1,2})\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})\b",
        re.IGNORECASE,
    )
    date_counts: dict[str, int] = {}
    for match in date_pattern.finditer(text):
        raw = match.group(0).strip()
        date_counts[raw] = date_counts.get(raw, 0) + 1
    for raw, count in date_counts.items():
        entities.append(
            ExtractedEntity(
                category="date",
                value=raw,
                normalized_value=raw,
                confidence=0.92,
                count=count,
            )
        )

    return entities


def extract_key_values_from_text(text: str) -> dict[str, str]:
    key_values: dict[str, str] = {}
    pattern = re.compile(
        r"(?:^|[.;\n])\s*([A-ZÀ-Úa-zà-ú0-9\s_\-]{2,40})\s*[:=]\s*([^.;\n]+)"
    )

    for match in pattern.finditer(text):
        key = match.group(1).strip()
        val = match.group(2).strip()
        if key and val and len(val) < 200:
            key_values[key] = val

    return key_values


# --- Parser de Tabelas Inspirado no Repositório de Referência ---

_TABLE_SEPARATOR = re.compile(r"^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$")


def extract_tables_from_text(text: str) -> list[ExtractedTable]:
    """Extrai tabelas Markdown de forma protegida e precisa."""
    tables: list[ExtractedTable] = []
    lines = text.splitlines()
    index = 0

    while index < len(lines):
        line = lines[index].strip()
        # Verifica se temos potencial tabela com cabeçalho e separador na próxima linha
        if index + 1 < len(lines) and "|" in line:
            sep_line = lines[index + 1].strip()
            if _TABLE_SEPARATOR.match(sep_line):
                # Linha anterior pode ser título da tabela (ex: "Tabela 1 - Produtos:")
                table_title: str | None = None
                if index > 0 and lines[index - 1].strip():
                    prev_line = lines[index - 1].strip()
                    if re.match(r"^(tabela|quadro|painel|dados)\b", prev_line, re.IGNORECASE):
                        table_title = prev_line.rstrip(":")

                # Extrai colunas do cabeçalho
                headers = [c.strip() for c in line.strip("|").split("|")]
                headers = [h for h in headers if h]

                # Coleta as linhas de dados
                rows: list[list[str]] = []
                index += 2
                while index < len(lines):
                    current_line = lines[index].strip()
                    if not current_line or "|" not in current_line:
                        break
                    # Pula linha repetida de separador se houver
                    if _TABLE_SEPARATOR.match(current_line):
                        index += 1
                        continue
                    cols = [c.strip() for c in current_line.strip("|").split("|")]
                    if any(cols):
                        rows.append(cols)
                    index += 1

                if headers and rows:
                    tables.append(ExtractedTable(title=table_title, headers=headers, rows=rows))
                continue
        index += 1

    return tables


# --- Normalização e Extração Hierárquica de Seções ---

DOCUMENT_DIVISION_PATTERN = re.compile(
    r"^(Capítulo|Capitulo|Seção|Secao|Parte|Unidade|Módulo|Modulo|Tópico|Topico|Item|"
    r"Artigo|Art\.|Cláusula|Clausula|Apêndice|Apendice|Anexo)\s+([0-9A-Za-zº°ª.-]+)",
    re.IGNORECASE,
)

NUMERIC_HEADING_PATTERN = re.compile(r"^(\d+(?:\.\d+)*)\.?(?:\s+|$)")
UPPERCASE_LETTER_HEADING_PATTERN = re.compile(r"^[A-Z]\s*\.(?:\s+|$)")
LOWERCASE_PAREN_HEADING_PATTERN = re.compile(r"^[a-z]\s*\)(?:\s+|$)")

_ROMAN_NUMERAL_CORE = (
    r"(?=[MDCLXVI])M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})"
)
ROMAN_HEADING_PATTERN = re.compile(
    rf"^({_ROMAN_NUMERAL_CORE})\s*[).](?:\s+|$)", re.IGNORECASE
)
_ROMAN_AMBIGUOUS_LETTERS = frozenset("IVXLCDM")
_ROMAN_NUMERAL_VALUES = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(char for char in normalized if not unicodedata.combining(char))


def _roman_to_int(roman: str) -> int:
    total = 0
    previous_value = 0
    for char in reversed(roman.upper()):
        value = _ROMAN_NUMERAL_VALUES.get(char, 0)
        if value < previous_value:
            total -= value
        else:
            total += value
            previous_value = value
    return total


class _HierarchicalHeadingState:
    """Rastreia a pilha contextual de headings para preservar a hierarquia precisa."""

    def __init__(self) -> None:
        self._stack: list[tuple[str, int, int | None]] = []

    def register_numeric(self, level: int) -> None:
        self._stack = [("numeric", level, None)]

    def register_letter_or_roman(self, heading_type: str, roman_value: int | None = None) -> int:
        for index in range(len(self._stack) - 1, -1, -1):
            if self._stack[index][0] == heading_type:
                del self._stack[index + 1 :]
                self._stack[index] = (heading_type, self._stack[index][1], roman_value)
                return self._stack[index][1]
        parent_level = self._stack[-1][1] if self._stack else 1
        level = min(parent_level + 1, 6)
        self._stack.append((heading_type, level, roman_value))
        return level

    @property
    def last_type(self) -> str | None:
        return self._stack[-1][0] if self._stack else None

    @property
    def last_roman_value(self) -> int | None:
        return self._stack[-1][2] if self._stack else None


def _resolve_letter_or_roman_type(
    letter: str, state: _HierarchicalHeadingState
) -> tuple[str, int | None]:
    if letter.upper() not in _ROMAN_AMBIGUOUS_LETTERS:
        return ("uppercase" if letter.isupper() else "lowercase"), None
    if letter.upper() == "I":
        return "roman", 1
    value = _roman_to_int(letter.upper())
    if state.last_type == "roman" and state.last_roman_value == value - 1:
        return "roman", value
    return ("uppercase" if letter.isupper() else "lowercase"), None


def extract_sections_from_text(text: str) -> list[ExtractedSection]:
    """Detecta e normaliza hierarquias semânticas de seções no documento."""
    sections: list[ExtractedSection] = []
    lines = text.splitlines()

    state = _HierarchicalHeadingState()
    markdown_heading_re = re.compile(r"^(#{1,6})\s+(.+)$")

    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped:
            continue

        # 1. Heading explícito de Markdown (# Título)
        m_match = markdown_heading_re.match(stripped)
        if m_match:
            level = len(m_match.group(1))
            title = m_match.group(2).strip()
            sections.append(ExtractedSection(title=title, level=level, line_number=idx))
            state.register_numeric(level)
            continue

        # Ignora linhas muito longas que são claramente parágrafos em prosa
        if len(stripped) > 160:
            continue

        canonical = stripped.replace("**", "").replace("__", "").strip()

        # 2. Divisões estruturais canônicas (Capítulo, Seção, Módulo, Parte, Item, etc.)
        div_match = DOCUMENT_DIVISION_PATTERN.match(canonical)
        if div_match:
            sections.append(ExtractedSection(title=canonical, level=2, line_number=idx))
            state.register_numeric(2)
            continue

        # 3. Títulos em MAIÚSCULAS destacados (Títulos de abertura / tópicos de nível 1)
        if canonical.isupper() and 3 <= len(canonical) <= 60 and not canonical.endswith("."):
            sections.append(ExtractedSection(title=canonical, level=1, line_number=idx))
            state.register_numeric(1)
            continue

        # 4. Numeração decimal hierárquica universal (ex: "1.", "1.1.", "1.2.3")
        num_match = NUMERIC_HEADING_PATTERN.match(canonical)
        if num_match:
            prefix = num_match.group(1)
            level = min(prefix.count(".") + 2, 6)
            sections.append(ExtractedSection(title=canonical, level=level, line_number=idx))
            state.register_numeric(level)
            continue

        # 5. Alfanumérico e Romano com contexto
        roman_match = ROMAN_HEADING_PATTERN.match(canonical)
        if roman_match:
            raw_roman = roman_match.group(1)
            val = _roman_to_int(raw_roman)
            lvl = state.register_letter_or_roman("roman", val)
            sections.append(ExtractedSection(title=canonical, level=lvl, line_number=idx))
            continue

        letter_match = UPPERCASE_LETTER_HEADING_PATTERN.match(canonical)
        if letter_match:
            letter = canonical[0]
            resolved_type, r_val = _resolve_letter_or_roman_type(letter, state)
            lvl = state.register_letter_or_roman(resolved_type, r_val)
            sections.append(ExtractedSection(title=canonical, level=lvl, line_number=idx))
            continue

        lower_paren_match = LOWERCASE_PAREN_HEADING_PATTERN.match(canonical)
        if lower_paren_match:
            letter = canonical[0]
            resolved_type, r_val = _resolve_letter_or_roman_type(letter, state)
            lvl = state.register_letter_or_roman(resolved_type, r_val)
            sections.append(ExtractedSection(title=canonical, level=lvl, line_number=idx))
            continue

    return sections


# --- Extração Híbrida de PDF (Vetorial + OCR) ---


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> tuple[str, int]:
    """Extrai texto de um documento PDF com fallback automático para OCR em páginas escaneadas."""
    if len(pdf_bytes) > MAX_INPUT_BYTES:
        raise ExtractionInputError("O PDF excede o tamanho máximo suportado.")

    try:
        doc = pdfium.PdfDocument(pdf_bytes)
        page_count = len(doc)
        if page_count == 0:
            return "", 0

        rendered_pages: list[str] = []
        ocr_engine = None

        for page_idx in range(page_count):
            page_num = page_idx + 1
            page = doc[page_idx]
            textpage = page.get_textpage()
            native_text = (textpage.get_text_range() or "").strip()

            status = "native"
            page_text = native_text

            # Se a página contiver pouquíssimo texto vetorial (< 30 chars), tentamos OCR
            if len(native_text) < 30:
                try:
                    if ocr_engine is None:
                        from rapidocr import RapidOCR

                        ocr_engine = RapidOCR()

                    pil_img = page.render(scale=2).to_pil().convert("RGB")
                    ocr_output = ocr_engine(pil_img)
                    pil_img.close()

                    ocr_lines = ocr_output.txts if ocr_output and ocr_output.txts else []
                    if ocr_lines:
                        ocr_content = "\n".join(str(t) for t in ocr_lines).strip()
                        if len(ocr_content) > len(native_text):
                            page_text = ocr_content
                            status = "ocr"
                except Exception:
                    # Falha suave no OCR; mantém o texto nativo disponível
                    pass

            if not page_text:
                status = "empty"
                page_text = f"*Página {page_num} vazia.*"

            marker = f"<!-- NEXOHUB_PAGE page={page_num} status={status} -->"
            rendered_pages.append(f"{marker}\n\n{page_text}")

        return "\n\n---\n\n".join(rendered_pages), page_count
    except Exception as exc:
        raise ExtractionInputError(f"Falha ao ler o PDF: {exc}") from exc


# --- Geração de Markdown Estruturado de Alta Fidelidade ---


def generate_structured_markdown(
    text: str, sections: list[ExtractedSection], tables: list[ExtractedTable]
) -> str:
    """Produz uma representação Markdown canônica com os headings e tabelas identificados."""
    lines = text.splitlines()
    section_map = {sec.line_number: sec for sec in sections}

    output_lines: list[str] = []
    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        if idx in section_map:
            sec = section_map[idx]
            # Se a linha já tiver marcador de Markdown #, preserva; senão aplica #{level}
            if not stripped.startswith("#"):
                output_lines.append(f"{'#' * sec.level} {stripped}")
            else:
                output_lines.append(stripped)
        else:
            output_lines.append(line)

    return "\n".join(output_lines)


# --- Função Principal de Entrada ---


def extract_information(
    *,
    text: str | None = None,
    content_bytes: bytes | None = None,
    mime_type: str | None = None,
    mode: str = "all",
) -> ExtractionResult:
    """Extrai informações estruturadas, entidades, tabelas e seções em documentos."""
    if not text and not content_bytes:
        raise ExtractionInputError("Texto ou conteúdo de arquivo deve ser fornecido.")

    page_count = 1
    extracted_text = ""

    if content_bytes:
        if mime_type == "application/pdf":
            extracted_text, page_count = extract_text_from_pdf_bytes(content_bytes)
        elif mime_type in ("text/plain", "text/markdown") or not mime_type:
            try:
                extracted_text = content_bytes.decode("utf-8")
            except UnicodeDecodeError:
                extracted_text = content_bytes.decode("latin-1", errors="replace")
        else:
            raise ExtractionInputError(f"MIME type '{mime_type}' não suportado para extração.")
    elif text is not None:
        extracted_text = text

    if len(extracted_text) > MAX_TEXT_CHARACTERS:
        raise ExtractionInputError("O texto excede o limite máximo de caracteres suportado.")

    lines = extracted_text.splitlines()
    words = extracted_text.split()
    char_count = len(extracted_text)
    word_count = len(words)
    line_count = len(lines)

    # Detecção básica de idioma
    pt_sample = re.findall(
        r"\b(?:de|da|do|em|para|com|não|que|os|as|um|uma)\b", extracted_text.lower()
    )
    en_sample = re.findall(
        r"\b(?:of|the|in|to|with|not|that|and|is|are|a|an)\b", extracted_text.lower()
    )
    language = "pt-BR" if len(pt_sample) >= len(en_sample) else "en"

    normalized_mode = mode.lower().strip()

    entities: list[ExtractedEntity] = []
    key_values: dict[str, str] = {}
    tables: list[ExtractedTable] = []
    sections: list[ExtractedSection] = []

    if normalized_mode in ("all", "entities"):
        entities = extract_entities_from_text(extracted_text)

    if normalized_mode in ("all", "key_values", "keyvalues"):
        key_values = extract_key_values_from_text(extracted_text)

    if normalized_mode in ("all", "tables"):
        tables = extract_tables_from_text(extracted_text)

    if normalized_mode in ("all", "sections", "outline"):
        sections = extract_sections_from_text(extracted_text)

    # Geração do Markdown estruturado
    markdown_output = generate_structured_markdown(extracted_text, sections, tables)

    metrics = {
        "charCount": char_count,
        "wordCount": word_count,
        "lineCount": line_count,
        "pageCount": page_count,
        "language": language,
        "entityCount": len(entities),
        "keyValueCount": len(key_values),
        "tableCount": len(tables),
        "sectionCount": len(sections),
    }

    return ExtractionResult(
        text=extracted_text,
        markdown=markdown_output,
        mode=normalized_mode,
        metrics=metrics,
        entities=entities,
        key_values=key_values,
        tables=tables,
        sections=sections,
    )
