# ADR-018: Atualização do snapshot LanguageTool para 20261027

- **Status:** adoção e instalação local autorizadas explicitamente pelo usuário em 27/10/2026;
  distribuição pendente das condições de fontes/licenças abaixo.
- **Contexto:** o snapshot fixado em ADR-012 retorna 404 no endereço oficial, não há cópia
  local fornecida pelo usuário e o pacote portátil da release pública não inclui o runtime.
  A revisão nativa fica indisponível sem um pacote que passe pelos hashes do manifesto.
- **Decisão local autorizada:** manter LanguageTool Community, CLI local `pt-BR`, argumentos fixos e Temurin
  JRE 21 já aprovado. Atualizar somente o snapshot para `6.9-SNAPSHOT-20261027`, com a
  autorização explícita registrada acima. Não habilitar servidor, API remota, modelos ou configuração fornecidos
  pelo documento. Não substituir JARs transitivos individualmente.
- **Identidade do candidato:**
  - [ZIP oficial datado](https://languagetool.org/download/snapshots/LanguageTool-20261027-snapshot.zip),
    263.225.695 bytes; SHA-256
    `d5aa893ca8a86506af6ab0eac81473e86f1b563bfb1fab6fc1d9622552bb9814`.
  - JAR CLI: `6c77a1b21ef2102eb7a7c47b6fa0d70b106ea1d63aef478e9fdedc730b57db0c`.
  - Metadado do produtor declara fonte
    [4cff70080064056e6ca239f8498368731eb90c6d](https://github.com/languagetool-org/languagetool/tree/4cff70080064056e6ca239f8498368731eb90c6d),
    árvore limpa. Isso não comprova reprodução do binário nem fontes de todos os recursos externos.
- **Prova realizada:** CLI, integração Rust e aplicativo instalado reconheceram os três
  problemas esperados no corpus autoral pt-BR. Instalação limpa em Windows Sandbox com
  4 GB e upgrade foram exercitados. O download corrigido coincide com a referência.
  [Medição](../benchmarks/2026-10-27-languagetool-q-c0.json): 15.182/15.612/14.524 ms,
  pico Java observado de até 503.959.552 bytes; runtime de 571.817.453 bytes. Cada chamada
  inicia JVM nova; cache do SO não foi esvaziado. O custo restaura uma capacidade indisponível
  no pacote anterior sem runtime, no mesmo corpus e configuração de VM. Não há comparação
  linguística ou de desempenho com o snapshot antigo, indisponível. Heap limitado a 768 MiB;
  texto curto não certifica latência no limite de entrada. A interface permaneceu interativa
  durante o ensaio, sem promessa de revisão instantânea.
- **Licenças:** o pacote completo contém, além do LT LGPL e JRE GPL com Classpath Exception,
  recursos GPL sem essa exceção: dicionários/POS asturiano e irlandês, Hunspell alemão,
  esperanto, galego, italiano e tagalo, além de outros dados e avisos por arquivo. Não
  considerar a exceção do JRE uma aprovação desses recursos. ADR-008 e regra 7 do projeto
  exigem decisão explícita antes da adoção. A licença MPL do código NexoHub permanece
  distinta da análise de agregação e redistribuição desses componentes.
- **Segurança:** 155 JARs examinados, com versões e licenças declaradas identificadas;
  50 têm hash idêntico ao artefato MavenCentral. A auditoria ampliada de 170 coordenadas,
  incluindo componentes embutidos, mantém oito coordenadas com 19 alertas OSV. Revisão independente
  distinguiu caminhos de rede/servidor/SQL, configuração, desserialização Java e modelos
  binários da entrada textual restrita. Não demonstrou exploração pelo documento, mas
  isso não corrige os componentes nem certifica todos os caminhos. Preservar modelos e
  configuração confiáveis, limites do executor e acompanhamento dos avisos.
- **Condições de distribuição:** preservar todos os avisos, resolver opções/divergências de
  licença por recurso, obter fontes correspondentes e receitas dos dados transformados e
  oferecer mecanismo concreto de acesso às fontes aplicáveis. O README transitivo tem
  versões desatualizadas e não substitui inventário dos JARs reais. Não liberar um instalador
  completo como qualificado antes dessas verificações.
- **Alternativa:** preparar distribuição restrita a português e provar funcionamento,
  integridade e licenças. Remover idiomas/JARs sem essa prova não é uma alternativa aprovada.

## Decisão posterior de composição

O [ADR-019](ADR-019-distribuicao-runtime-languagetool.md), autorizado explicitamente
em 27/10/2026, retira os binários LanguageTool/Java do instalador NexoHub e oferece
instalação opcional do mesmo runtime por download oficial com hashes. Esta decisão
preserva a adoção local acima e as pendências de fontes do pacote completo; não é
aprovação para redistribuí-lo nem autorização para push, release ou deploy.
