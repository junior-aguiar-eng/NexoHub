# ADR-012: LanguageTool Community para revisão pt-BR

- **Status:** aceito
- **Contexto:** regras determinísticas próprias não cobrem revisão ortográfica, gramatical e de
  estilo em português brasileiro. O serviço público externo é mutável e implicaria envio de texto.
- **Decisão:** usar obrigatoriamente o LanguageTool Community em `pt-BR`, executado como sidecar pelo
  Temurin JRE 21. Fixar o snapshot `6.9-SNAPSHOT-20260901` e o JRE `21.0.12.1+1-LTS` em manifesto com
  URL, tamanho, SHA-256 e licença. Snapshot, Java e avisos legais são instalados separadamente e não
  integram o Git. A adoção da LGPL-2.1-or-later e do runtime GPL-2.0 com Classpath Exception é
  expressamente restrita a esses componentes isolados e não altera a licença MPL-2.0 do NexoHub.
- **Consequências:** revisão fica indisponível quando a instalação não puder ser validada. O core
  inicia apenas caminhos confinados e verificados, não usa API remota e preserva os avisos de licença
  e de terceiros. Atualizar snapshot ou Java exige novo hash, teste e decisão registrada.
