# Fontes de recursos GPL — snapshot LanguageTool 20261027

Revisão técnica em 27/10/2026. Nenhum código externo foi executado, nenhum arquivo do produto ou runtime foi modificado. Downloads foram usados somente como evidência. A adoção local já autorizada não equivale à aprovação de redistribuição. Este relatório não declara compliance jurídico.

## Critérios e evidência

- **Incluído:** dados editáveis realmente presentes no snapshot/JAR, ou script/aviso efetivamente presente. Um arquivo `.dict` Morfologik é binário; sua presença em Git não demonstra, por si só, a forma preferida para modificação.
- **Determinável:** URL e revisão concretas ligadas ao arquivo distribuído por comparação de bytes/Git blob. Não significa que a receita gera o mesmo binário.
- **Não demonstrado:** fonte de entrada exata, revisão upstream, patches ou receita completa não foram identificados na evidência examinada. Não significa automaticamente violação; impede declarar a lacuna resolvida tecnicamente.

O commit LT é [4cff70080064056e6ca239f8498368731eb90c6d](https://github.com/languagetool-org/languagetool/tree/4cff70080064056e6ca239f8498368731eb90c6d). `lt-pinned-source-tree.json` contém a árvore completa, 5.266 entradas, `truncated=false`. Para 206 arquivos distribuídos dos idiomas examinados, calculei `SHA1("blob " + comprimento + NUL + bytes)` e comparei ao blob do commit: **206/206 coincidem**. O registro é `lt-sources-local-correspondence.json`, com SHA-256 local e caminhos. Isso liga fontes/avisos/binários existentes ao commit; não demonstra reprodução nem completude da forma preferida.

Os caminhos `resource/...` abaixo abreviam `org/languagetool/resource/...`; no repositório LT ficam em `languagetool-language-modules/<idioma>/src/main/resources/`.

## Asturiano — org.languagetool:asturian-pos-dict:0.1

**Incluído:** JAR contém `resource/ast/hunspell/ast_ES.dic` e `.aff`, editáveis, `LICENSES-en.txt` (Hunspell 2.80, GPLv3), `.info`, e binários `ast_ES.dict` e `asturian.dict` (POS). A presença das fontes Hunspell não resolve automaticamente a fonte do POS Freeling.

**Determinável:** SCM do POM aponta [esbardu/asturian-pos-dict](https://github.com/esbardu/asturian-pos-dict/tree/b7cd3a69691b5a3070221094947cfa265a720ab1). Commit `b7cd3a69691b5a3070221094947cfa265a720ab1` declara POM 0.1; **8/8 recursos compartilhados com o JAR coincidem** por blob. `lt-source-asturian-pos-dict.json` guarda árvore/comparações. README e POM foram baixados em `lt-sources/esbardu/asturian-pos-dict/`.

**Receita/lacuna:** README diz que o projeto contém binários Morfologik e orienta exportar dados pelo LT. POM comenta o plugin de fontes com “there is currently no source”. O endpoint Maven `asturian-pos-dict-0.1-sources.jar` respondeu 404. Isso não prova que exportar o binário seja a forma preferida: falta demonstrar entrada POS editável/Freeling e como o `asturian.dict` foi construído. O script LT `ast/hunspell/create_dict.sh` usa LT 6.4-SNAPSHOT, Morfologik 2.1.7 e exige `/tmp/Addition_dict.txt`, `/tmp/Unknown_Hunspell.txt` e `/tmp/empty` não identificados por hash. É uma receita parcial para spelling, não fonte comprovada do POS nem reprodução demonstrada do JAR 0.1. O comentário POM sobre Morphy diverge da atribuição Freeling do README LT; resolver proveniência, sem preencher por analogia.

## Irlandês — io.github.jimregan:languagetool-ga-dicts:0.02

**Incluído:** JAR contém `ga_IE.aff` e `ga_IE.dic` editáveis, `LICENSES-en.txt`, três binários `ga_IE.dict`, `irish.dict`, `irish_synth.dict`, metadados `.info` e listas de tags. Listas de tags não são o léxico POS de entrada completo.

**Determinável:** história pública do POM identifica versão 0.02 no commit [2a127b3d079fb3824b89b60d21ae3db1cb348b28](https://github.com/jimregan/languagetool-ga-dicts/tree/2a127b3d079fb3824b89b60d21ae3db1cb348b28), 01/07/2018. **7/7 arquivos compartilhados nessa árvore com o JAR coincidem**, incluindo os três `.dict`; evidência em `lt-irish-pom-history.json` e `lt-irish-002-tree.json`. Isso não cobre os arquivos extras do JAR ausentes da árvore. Não há tag 0.02 entre as tags retornadas; há v0.01. HEAD 0.03 não deve substituir 0.02: entre oito recursos compartilhados, `ga_IE.info` diverge, embora os três binários coincidam.

**Receita/lacuna:** README upstream distingue POS derivado de [Irish FST](https://github.com/jimregan/irishfst) e spelling de [Gaelspell](https://github.com/kscanne/gaelspell). Scripts `build_tagging_dict.sh`, `create_spelling_dict.sh`, `export-irishfst.sh` e `tsv2tsv.pl` foram lidos/baixados, nunca executados. Os três últimos coincidem com a árvore 0.02; o primeiro difere do HEAD 0.03 e sua versão 0.02 foi baixada separadamente em `lt-sources/jimregan/languagetool-ga-dicts-002/scripts/` e conferida pelo Git blob. Descrevem foma, `bin/all.fst` → `pairs.tsv` → TSV → POSDictionaryBuilder/SynthDictionaryBuilder; spelling usa unmunch/hunspell + `dict/ga_wordlist.xml`. Têm caminhos pessoais e LT 4.3-SNAPSHOT/Morfologik 2.1.2. Os arquivos de entrada e revisões Irish FST/Gaelspell efetivamente usados não são fixados. `pairs.tsv`, FST-fonte e `ga_wordlist.xml` não estão na árvore 0.02; `.aff/.dic` do JAR também não estão nela. Endpoint Maven sources 0.02 respondeu 404. Falta ligar a receita histórica completa e entradas preferidas aos bytes 0.02; não basta fornecer o repo que também carrega binários.

## Alemão — Hunspell 20161207 + frami20170109

**Incluído/determinável:** `de_AT`, `de_CH`, `de_DE` têm `.dic`, `.aff`, `.dic.header`, READMEs, COPYING GPLv2/v3 e script `create_dict.sh`, todos presentes no snapshot e iguais ao commit LT. Fontes Hunspell editáveis estão incluídas. Headers atribuem igerman98/frami, versão `20161207+frami20170109`, indicam modificações LT e git history. Origens listadas: [igerman98](http://www.j3e.de/ispell/igerman98/) e extensões LibreOffice frami. Revisão LT fixa o estado dos arquivos modificados; não é preciso depender de HEAD upstream para identificar esses arquivos.

**Receita/lacuna:** `de_DE.README` diz que `de_DE.dict` também inclui lista de Jan Schreiber/germandict filtrada por Hunspell (declarada domínio público). `create_dict.sh` usa LT 5.3-SNAPSHOT/Morfologik 2.1.7 e caminhos locais para `german.txt`, `hunspell_words.txt`, `de_wordlist.xml`; URLs são genéricas/mutáveis. Fonte Hunspell isolada já está incluída, porém não foi demonstrada a composição exata das entradas adicionais e frequências para reconstruir os `.dict` distribuídos. Header pede patches que regenerem a versão modificada; vincular alterações relevantes do histórico LT e preservar o material necessário, sem presumir suficiência jurídica do link ao git.

## Esperanto

**Incluído/determinável:** `eo/hunspell/eo.aff` e `eo.dic` são editáveis, presentes e idênticos ao commit LT; `README_eo.txt` descreve origem Esperantilo OXT, patch nas regras BREAK e GPLv2-or-later. O estado modificado está ancorado no commit LT; o patch textual está no README.

**Não demonstrado:** não identifiquei receita específica que vincule todos os parâmetros e eventual frequência ao `eo.dict` distribuído. Ferramenta genérica SpellDictionaryBuilder/exportação existe, mas não foi usada como prova de reconstrução nem de forma preferida. A ausência de receita específica não apaga as fontes Hunspell já incluídas.

## Galego — spelling e POS separados

**Spelling incluído/determinável:** `gl/hunspell/gl_ES.dic` e `.aff`, README versão 12.10, licença GPLv3 em `LICENCES-en.txt`, idênticos ao commit LT. Dados editáveis efetivamente incluídos. Receita/entradas exatas do binário spelling não demonstradas.

**POS não demonstrado:** `galician.dict`/`galician_synth.dict` são binários idênticos ao commit. README atribui Freeling/Apertium. `makedict-gl.sh` existe, mas começa declarando deprecated e executando `exit`; o restante aponta `gl.dicc`, ferramentas Morfologik 1.5.2, `synth.awk`/`morph_data.awk` em caminhos locais e URL Freeling SVN “latest”. O léxico completo `gl.dicc` e scripts externos não foram encontrados na árvore dos recursos. Não declarar esse script receita funcional atual. Precisam ser identificados fonte POS, revisões e transformação efetivamente empregada.

## Italiano — Hunspell e tagset separados

**Hunspell:** `it_IT.dict` é binário presente no commit e snapshot. `README_it_IT.txt` informa Italian Writing Aids 3.3.1 (24/03/2011), GPLv3, forks anteriores e pasta `legacy`. `.aff`/`.dic` italianos e pasta `legacy` não foram encontrados na árvore examinada dos recursos nem no diretório distribuído. Links OpenOffice/linguistico são origem candidata, não prova da entrada exata e patches do `.dict`. Fonte preferida/receita específica não demonstradas.

**Tagset:** `it/tagset.txt` é texto editável incluído, idêntico ao commit, identifica Morph-it 0.4.8 e contém concessão GPL. Sua própria forma textual está disponível. Não estender esse achado a `italian.dict`/`italian_synth.dict`; README POS fala em CC-BY-SA/LGPL e requer resolver escopo por artefato.

## Tagalo

**Hunspell:** `tl_PH.dict` binário e README myspell-tl 0.02 (GPLv2-or-later), idênticos ao commit. Não há `.aff/.dic` tagalos no diretório distribuído ou árvore de recursos examinada. README identifica wordlist gerada por An Crubadan e revisada por Sagum; origem sem revisão exata. `README_frequencies.txt` atribui frequências SpellOnIt CC-BY4.0 e URL de downloads, mas sem versão/hash. Fonte e receita exatas do spelling, incluindo frequência, não demonstradas.

**POS:** README atribui dicionário/tagset a Nathaniel Oco/Allan Borra e declara LGPL; não classificar automaticamente POS tagalo como GPL por causa do Hunspell.

## Árabe POS

**Incluído:** tags/adições e `wordlist-flat/about.txt`, além de `arabic.dict`/`arabic_synth.dict` binários iguais ao commit. Hunspell `ar.dic/.aff` está incluído e é outra fonte, com tri-licença; não é prova da fonte POS.

**Receita parcial:** about.txt identifica Arramooz, `make verbtags`, `make nountags`, merge e POSDictionaryBuilder com `nouns.dict.tags`. Não traz revisão Arramooz nem a wordlist completa gerada. O diretório wordlist-flat na árvore contém somente about.txt. README aponta vários projetos GPL; não atribuir automaticamente todas as licenças a todos os arquivos. Falta identificar revisão e conjunto de dados preferidos que geraram POS/synth e o merge exato. Referência histórica a um commit Arramooz em CHANGES não comprova que seja a entrada deste snapshot.

## Bretão POS

`breton.dict` binário e README idênticos ao commit; atribuição Apertium Breton GPL e autores 2008–2010. Não encontrei léxico POS completo editável nem receita específica correspondente na árvore dos recursos. O script `br/hunspell/create-fsa-spell-dictionary.sh` trata spelling **LGPL**, busca OXT 0.15 e usa LT 4.2-SNAPSHOT; não resolve fonte do POS GPL. README menciona spelling 0.13, outra divergência a não apagar. Falta fonte/revisão/receita do POS.

## Espanhol — confusion_set_candidates.txt

**Fonte incluída/determinável:** o próprio arquivo é texto editável, com cabeçalho After the Deadline, URL `data/rules/homophonedb.txt`, GPLv2 e formato documentado. Está incluído e igual ao commit LT. Não é um binário que exija supor decompilação. Preservar cabeçalho, atribuição e estado modificado LT. Não confundir arquivo de candidatos com prova de quais regras foram ativadas ou métricas de qualidade. Histórico upstream exato pode complementar proveniência, mas a forma textual entregue já é inspecionável e editável.

## Bloqueios concretos que permanecem

1. **Forma preferida não demonstrada para POS binário:** asturiano, irlandês, árabe, bretão e galego. Repos podem entregar os mesmos binários sem incluir entradas/receitas completas. Exportar automaticamente esses binários não prova que o resultado é a forma preferida usada pelo mantenedor.
2. **Hunspell italiano/tagalo:** faltam fontes editáveis e transformação/frequências precisas na evidência examinada. Outros Hunspell já incluem `.dic/.aff`, mas geração exata dos `.dict` pode depender de insumos ausentes.
3. **Inputs/revisões faltantes em receitas:** arquivos pessoais/additional wordlists, frequências, FST e scripts externos. Não preencher a lacuna com a versão mais nova disponível e chamá-la correspondente.
4. **Suficiência jurídica e mecanismo de redistribuição:** exigem decisão específica sobre pacote completo/reduzido, opções de licença e disponibilização das fontes; esta análise não substitui esse julgamento. Quando mantenedores não publicam as entradas usadas, é necessária evidência adicional deles ou uma decisão que preserve explicitamente a pendência. Não criar declaração própria de conformidade ou oferta de fontes que ainda não possuímos.

A inspeção não demonstrou que nenhuma solução autônoma adicional seja possível; demonstrou exatamente quais provas ainda não foram obtidas. As lacunas não impedem por si a instalação local já autorizada, mas impedem afirmar que as fontes correspondentes do pacote completo estão integralmente fechadas para redistribuição.
