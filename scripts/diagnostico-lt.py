import json
import subprocess
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

root = Path(__file__).resolve().parent.parent
java_exe = root / "runtime" / "languagetool" / "java" / "bin" / "java.exe"
jar_path = root / "runtime" / "languagetool" / "languagetool" / "languagetool-commandline.jar"

text = """Malgrado os esforços da equipe, a vultosa quantia despendida na reforma não surtiu o efeito almejado, haja vista os problemas estruturais que ainda persistem no edifício central. Se houvesse mais atenção aos detalhes, o engenheiro-chefe teria intervindo antes que as infiltrações cometessem tamanha avaria no subsolo. Fazem cinco anos que a manutenção preventiva foi negligenciada, o que culminou numa situação onde os prejuízos são vultuosos e de difícil reparação imediata.Seguem inclusos os relatórios periciais para que sejam tomadas as providências cabíveis. Informamos-lhe de que a diretoria assistiu ao desenrolar dos fatos com preocupação, preferindo retificar o contrato a ratificar os erros da gestão anterior. Hão de existir soluções viáveis se todos propuserem mudanças céleres. Espera-se que, a nível de urgência, o plano seja implementado e que os condôminos, cujos os direitos foram lesados, recebam o devido ressarcimento face à gravidade do cenário atual."""

with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as f:
    f.write(text)
    temp_name = f.name

cmd = [str(java_exe), "-jar", str(jar_path), "-l", "pt-BR", "--json", temp_name]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", check=False)

data = json.loads(res.stdout)
matches = data.get("matches", [])
print(f"Total de achados encontrados pelo LanguageTool: {len(matches)}")
for i, m in enumerate(matches):
    offset = m["offset"]
    length = m["length"]
    trecho = text[offset : offset + length]
    rule_id = m["rule"]["id"]
    issue_type = m["rule"].get("issueType", "")
    print(f'\n[{i+1}] Regra: {rule_id} | Tipo: {issue_type} | Trecho: "{trecho}"')
    print(f"    Mensagem: {m['message']}")
    replacements = [r["value"] for r in m.get("replacements", [])[:3]]
    print(f"    Sugestões: {replacements}")
