"""Testes do extrator de informações e inteligência documental local."""

import json
from io import StringIO

from nexohub_document_engine.extraction import (
    extract_information,
    extract_sections_from_text,
    extract_tables_from_text,
    validate_cnpj,
    validate_cpf,
)
from nexohub_document_engine.protocol import serve


def test_cpf_validation():
    # CPFs com dígitos verificadores matematicamente válidos
    assert validate_cpf("52998224725") is True
    # Dígito inválido
    assert validate_cpf("52998224726") is False
    # Dígitos todos iguais
    assert validate_cpf("11111111111") is False


def test_cnpj_validation():
    # CNPJ válido
    assert validate_cnpj("11222333000181") is True
    # CNPJ com dígito inválido
    assert validate_cnpj("11222333000182") is False
    # Dígitos todos iguais
    assert validate_cnpj("00000000000000") is False


def test_extract_entities_and_key_values():
    sample_text = """
    CONTRATO DE PRESTAÇÃO DE SERVIÇOS
    
    Cliente: Empresa Modelo Ltda
    CNPJ: 11.222.333/0001-81
    Responsável: João da Silva
    CPF: 529.982.247-25
    E-mail: contato@empresamodelo.com.br
    Telefone: (11) 98765-4321
    CEP: 01310-100
    Data: 15/09/2026
    Valor Total: R$ 15.500,00
    
    | Item | Quantidade | Preço Unitário |
    | :--- | :---: | ---: |
    | Licença NexoHub | 10 | R$ 1.500,00 |
    | Suporte Anual | 1 | R$ 500,00 |
    """

    res = extract_information(text=sample_text, mode="all")
    assert res.metrics["charCount"] > 0
    assert res.metrics["language"] == "pt-BR"
    assert res.markdown is not None

    # Checar entidades
    categories = {e.category for e in res.entities}
    assert "cpf" in categories
    assert "cnpj" in categories
    assert "email" in categories
    assert "phone" in categories
    assert "cep" in categories
    assert "money" in categories
    assert "date" in categories

    # Verificar confiança no CPF válido
    cpf_entity = next(e for e in res.entities if e.category == "cpf")
    assert cpf_entity.confidence == 1.0
    assert cpf_entity.normalized_value == "529.982.247-25"

    # Checar chave-valor
    assert res.key_values.get("Cliente") == "Empresa Modelo Ltda"
    assert res.key_values.get("Responsável") == "João da Silva"

    # Checar tabelas
    assert len(res.tables) == 1
    assert "Item" in res.tables[0].headers
    assert len(res.tables[0].rows) == 2


def test_hierarchical_sections_extraction():
    sample = """
    MANUAL TÉCNICO DE ENGENHARIA
    Capítulo 1 - Fundamentos
    1. Introdução ao Sistema
    1.1 Arquitetura e Modelagem
    1.1.1 Camada de Processamento
    A. Especificação de Componentes
    B. Parâmetros Operacionais
    I. Configuração Inicial
    II. Conclusão da Etapa
    Seção 2 - Validação
    """

    sections = extract_sections_from_text(sample)
    titles = [s.title for s in sections]
    levels = [s.level for s in sections]

    # Título principal em maiúsculas (nível 1)
    assert "MANUAL TÉCNICO DE ENGENHARIA" in titles
    assert levels[titles.index("MANUAL TÉCNICO DE ENGENHARIA")] == 1

    # Divisão estrutural (Capítulo / Seção)
    assert "Capítulo 1 - Fundamentos" in titles
    assert levels[titles.index("Capítulo 1 - Fundamentos")] == 2
    assert "Seção 2 - Validação" in titles
    assert levels[titles.index("Seção 2 - Validação")] == 2

    # Numeração decimal hierárquica
    idx_1 = titles.index("1. Introdução ao Sistema")
    idx_1_1 = titles.index("1.1 Arquitetura e Modelagem")
    idx_1_1_1 = titles.index("1.1.1 Camada de Processamento")
    assert levels[idx_1] == 2
    assert levels[idx_1_1] == 3
    assert levels[idx_1_1_1] == 4

    # Letras e Romanos organizados contextualmente
    idx_a = titles.index("A. Especificação de Componentes")
    idx_b = titles.index("B. Parâmetros Operacionais")
    assert levels[idx_a] == levels[idx_b]


def test_extract_tables_with_alignment_and_titles():
    markdown = """
    Tabela 1: Demonstrativo de Valores
    | Produto | Preço | Estoque |
    | :--- | ---: | :---: |
    | Software NexoHub | R$ 1.200 | 50 |
    | Consultoria | R$ 3.000 | 5 |
    """

    tables = extract_tables_from_text(markdown)
    assert len(tables) == 1
    assert tables[0].title == "Tabela 1: Demonstrativo de Valores"
    assert tables[0].headers == ["Produto", "Preço", "Estoque"]
    assert len(tables[0].rows) == 2
    assert tables[0].rows[0] == ["Software NexoHub", "R$ 1.200", "50"]


def test_extract_via_protocol_serve():
    request = {
        "id": "req-extract-1",
        "method": "extract",
        "params": {
            "text": (
                "Fatura 12345. Valor: R$ 250,00. Vencimento: 20/10/2026. "
                "E-mail: financeiro@exemplo.com"
            ),
            "mode": "all",
        },
    }

    in_stream = StringIO(json.dumps(request) + "\n")
    out_stream = StringIO()

    serve(in_stream, out_stream)

    out_lines = out_stream.getvalue().strip().splitlines()
    assert len(out_lines) == 1
    response = json.loads(out_lines[0])
    assert response["id"] == "req-extract-1"
    assert "result" in response
    result = response["result"]
    assert any(e["category"] == "money" for e in result["entities"])
    assert any(e["category"] == "email" for e in result["entities"])
    assert "markdown" in result
    assert result["markdown"] != ""
