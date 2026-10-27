# Inventário de licenças do candidato LanguageTool 20261027

Continuação da avaliação: o usuário autorizou adoção/instalação local, conforme ADR-018.
O [inventário dos 155 JARs](languagetool-20261027-jars.json) registra hashes, identidades,
declarações de licença e evidências primárias. Foram resolvidas as 39 declarações antes
desconhecidas e as cinco versões antes ausentes; 50 JARs foram comparados por SHA-256
com MavenCentral. `annotations.jar` corresponde a `com.intellij:annotations:12.0`,
divergindo de `org.jetbrains:annotations:26.0.2` no POM raiz; o inventário preserva ambas
as comparações. O dicionário Belarus 1.0.2 declara CC-BY-SA-4.0, sem inferir LGPL.
A auditoria ampliada de 170 coordenadas manteve oito coordenadas afetadas e 19 avisos
únicos, sem novos IDs ou paginação restante. Os seis componentes `6.9-SNAPSHOT` exigem
avaliação do commit; consulta negativa dessa string não certifica ausência de problemas.

Identificar declarações não encerra as obrigações de fontes, recursos e redistribuição
descritas abaixo. O relatório é técnico e não declara cumprimento jurídico integral.

Revisão técnica em 27/10/2026, sem adoção, instalação no produto ou modificação do snapshot. Caminhos abaixo são relativos à raiz LanguageTool-6.9-SNAPSHOT; ! identifica entrada ZIP/JAR. Dados de usuário não foram utilizados.

## Resultado para decisão

ADR-012 autoriza componentes isolados LT LGPL-2.1-or-later e JRE GPL-2.0 com Classpath Exception, fixa snapshot anterior e exige decisão para atualização. ADR-008 exige decisão explícita para GPL/AGPL. O pacote completo tem dados GPL sem Classpath Exception. Executar somente pt-BR não remove arquivos distribuídos nem resolve automaticamente suas obrigações. Não se conclui que a licença MPL do NexoHub muda por mera agregação.

Não aprovar redistribuição completa apenas com COPYING e hash do ZIP. Registrar escopo, licenças alternativas escolhidas, avisos preservados e acesso a fontes correspondentes/scripts para binários/dicionários transformados. Há recursos com versão/licença imprecisa e ausência de prova das fontes exatas.

## Identidade e fontes

ZIP SHA-256 d5aa893ca8a86506af6ab0eac81473e86f1b563bfb1fab6fc1d9622552bb9814; commandline JAR SHA-256 6c77a1b21ef2102eb7a7c47b6fa0d70b106ea1d63aef478e9fdedc730b57db0c (evaluation.json).

libs/languagetool-core.jar!/git.properties declara commit 4cff70080064056e6ca239f8498368731eb90c6d, git.dirty=false, build 2026-10-27T18:47:43+0100, 6.9-SNAPSHOT e origem languagetool-org/languagetool. Commit público conferido em https://github.com/languagetool-org/languagetool/commit/4cff70080064056e6ca239f8498368731eb90c6d . Fonte candidata ancorada: https://github.com/languagetool-org/languagetool/tree/4cff70080064056e6ca239f8498368731eb90c6d . Metadado do produtor e existência do commit não demonstram build reproduzível.

META-INF/MANIFEST.MF externo informa Maven 3.6.3/JDK17.0.15. Não encontrei pacote *sources* no snapshot. O commit LT não identifica automaticamente os fontes exatos de todos os JARs externos. Coordenadas POM e SCM são pontos de partida, não prova de correspondência binária.

## Recursos GPL sem alternativa expressa clara no aviso examinado

| Recurso/caminho | Versão/origem declarada | Licença/evidência | Fornecido e lacuna |
|---|---|---|---|
| ar/arabic.dict e dados associados | Arramooz, Fareh, Ayaspell, mysam-tagmanager, Tashkeela2; links GitHub linuxscout em ar/README.txt | README: GPL sem versão para projetos; não atribuir todos os arquivos automaticamente | README/proveniência; falta mapear cada artefato à fonte/revisão/licença. Hunspell ar é tri-licenciado, ver seção seguinte |
| ast POS | Freeling; ast/README.txt | GPL sem versão; JAR asturian 0.1 declara GPLv3 | Dados transformados; confirmar fonte de entrada e receita |
| br POS | Apertium Breton, autores 2008–2010; br/README.txt | GPL sem versão | Créditos presentes; não confundir com spelling Breton LGPL. Fonte/revisão exata pendente |
| de/hunspell/de_AT, de_CH, de_DE .aff/.dic.header e dicionários correspondentes | igerman98 20161207 + frami20170109 (headers) | GPLv2 ou GPLv3; frami README e headers | COPYING_GPLv2/v3 completos, .aff e header; header diz modificado pelo LT e remete ao git. Falta demonstrar patch/entrada/receita que regenera dados |
| eo/hunspell/eo.aff e dicionário | Esperantilo OXT; arquivo base 2010, patch LT 2013; README_eo.txt | GPLv2-or-later no bloco da licença | Patch de aff descrito; fonte exata da wordlist/binário ainda precisa ser vinculada |
| es/confusion_set_candidates.txt | After the Deadline data/rules/homophonedb.txt; links no cabeçalho | GPLv2 explícita na linha4 | Texto editável entregue; preservar cabeçalho, fixar origem/revisão e licença aplicável |
| gl POS + gl/makedict-gl.sh | Freeling/Apertium; gl/README.txt | GPL sem versão | Script de geração e avisos presentes; falta revisão de dados de entrada e completude |
| gl/hunspell | versão12.10, Proxecto Trasno, README-gl-ES.txt | GPL; LICENCES-en.txt contém GPLv3 | Avisos e licença fornecidos; comprovar fontes exatos e geração do binário |
| it/hunspell | Italian Writing Aids3.3.1,24/03/2011, Andrea Pescetti; README_it_IT.txt | GPLv3, texto completo embutido no README | Créditos e histórico de forks presentes; README remete a pasta legacy, verificar completude e fonte correspondente |
| it/tagset.txt | Morph-it0.4.8,23/02/2009, Baroni/Zanchetta | contém concessão GPL; it/README declara CC-BY-SA2.0 e LGPL para POS | Divergência de escopo/licença por arquivo: não reduzir tudo à licença do README; resolver origem e opção de cada arquivo |
| tl/hunspell | myspell-tl0.02, Ramil Sagum/Kevin Scannell2004 | GPLv2-or-later, texto GPLv2 completo no README_tl_PH.txt | Origem An Crubadan informada; demonstrar versão/fontes/transformações |

## Recursos com GPL como alternativa ou menção histórica

| Caminho | Declaração e versão | Consequência para decisão |
|---|---|---|
| ar/hunspell/COPYING | GPL2.0/LGPL2.1/MPL1.1 com opção later no texto | Escolha alternativa deve ser documentada; não confundir com arabic.dict |
| ca/README.txt e catalan-pos-dict.jar | GPLv2/LGPLv2.1; JAR3.3, Softcatala/catalan-dict-tools | Pode haver caminho LGPL; confirmar concessão do recurso inteiro |
| da/README.txt,tagset.txt,hunspell/README_da_DK.txt | GPLv2/LGPL2.1/MPL1.1; Hunspell2.4,15/04/2018, Stavekontrolden | Preservar créditos/licenças e registrar opção |
| el/hunspell/README_el_GR.txt | versão0.9,14/03/2019 MPL1.1/GPL2.0/LGPL2.1; bloco0.003GPL é histórico | Não classificar versão atual como GPL-only com base no histórico |
| pl/hunspell/README_en.txt | GPL/LGPL/MPL/CC-SA; gerado12/08/2026 de sjp-ispell-pl-20260803, correções locais e frequências externas | Versões de licenças e licenças de frequências precisam ser precisadas; créditos/receita incompletos não se resolvem por escolher MPL |
| ro/hunspell | GPL2.0/LGPL2.1/MPL1.1; COPYING.GPL/LGPL/MPL e README EN/RO | Escolha alternativa documentável; versão não declarada |
| sk/hunspell/README_en.txt | escolha expressa GPLv2 ou LGPL2.1 ou MPL1.1; sk-spell | Fonte e versão exatas pendentes |
| sl/hunspell/README_sl_SI.txt | GPL e LGPL; produto1.0,2006, GNUsl | Texto não fixa versões nem relação AND/OR claramente: confirmar |
| sv POS e spelling | POS LGPL2.1+; spelling LGPLv3 | Não é GPL-only; verificar fonte e obrigações LGPL próprias |

Menções GNU GPL em en/specific_case.txt e nl/multiwords.txt são entradas de vocabulário, não concessões de licença. AGPL não foi identificada como licença concedida pelos metadados/avisos examinados; menções a Affero no corpo padrão GPLv3 não provam uso de AGPL. Isso é triagem, não certificação de ausência em arquivos sem metadados.

## JARs: inventário direto de metadados

Inspeção de todos os JARs do snapshot, inclusive metadados de dependências shaded. A tabela seguinte registra todo JAR com licença GPL/LGPL/CDDL explicitada em POM ou termos GPL em avisos. Licenças herdadas ausentes do POM permanecem limitação; não se usa README histórico como prova da versão atual. Sem fontes de classes (.java) demonstrados como distribuição fonte completa.

### languagetool-commandline.jar

- Coordenadas: groupId=org.languagetool; artifactId=languagetool-commandline; version=6.9-SNAPSHOT.
- SHA-256: `6c77a1b21ef2102eb7a7c47b6fa0d70b106ea1d63aef478e9fdedc730b57db0c`.
- POM `META-INF/maven/org.languagetool/languagetool-commandline/pom.xml`: GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: https://www.languagetool.org; SCM: não declarado.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### languagetool-server.jar

- Coordenadas: groupId=org.languagetool; artifactId=languagetool-server; version=6.9-SNAPSHOT.
- SHA-256: `9e068dc3a9eb3bfe3d125aa0ecb9b40de241e1f64ea944c3244df227a13a8462`.
- POM `META-INF/maven/org.languagetool/languagetool-server/pom.xml`: GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: https://www.languagetool.org; SCM: não declarado.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### languagetool.jar

- Coordenadas: groupId=org.languagetool; artifactId=languagetool-standalone; version=6.9-SNAPSHOT.
- SHA-256: `b5ddcab17840c945a23fced73fbce1b85216d5545653f4e6d3496deb82732b73`.
- POM `META-INF/maven/org.languagetool/languagetool-standalone/pom.xml`: GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: https://www.languagetool.org; SCM: não declarado.
- Textos/avisos incluídos: `META-INF/COPYING.txt`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/asturian-pos-dict.jar

- Coordenadas: version=0.1; groupId=org.languagetool; artifactId=asturian-pos-dict.
- SHA-256: `772fc113d9da478a242e4539f1c963561c45443dd63a9f1838b2564e0018be44`.
- POM `META-INF/maven/org.languagetool/asturian-pos-dict/pom.xml`: GNU GENERAL PUBLIC LICENSE Version 3 https://fsf.org/. Origem: https://languagetool.org; SCM: não declarado.
- Textos/avisos incluídos: `org/languagetool/resource/ast/hunspell/LICENSES-en.txt`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/catalan-pos-dict.jar

- Coordenadas: groupId=org.softcatala; artifactId=catalan-pos-dict; version=3.3.
- SHA-256: `e5f32aadd1852e8e442810611d89906c06369a94d2a62c1a142eb3e8f5bda2f1`.
- POM `META-INF/maven/org.softcatala/catalan-pos-dict/pom.xml`: GNU General Public License, Version 2, June 1991 https://www.gnu.org/licenses/gpl2.txt; GNU Lesser General Public License, Version 2.1, February 1999 https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: http://github.com/softcatala/catalan-dict-tools; SCM: não declarado.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/dutch-pos-dict.jar

- Coordenadas: version=0.1; groupId=org.languagetool; artifactId=dutch-pos-dict.
- SHA-256: `f91c712ee961889f2950a5c9c97f4f84791b2fec59706af1970dadee5baba677`.
- POM `META-INF/maven/org.languagetool/dutch-pos-dict/pom.xml`: GNU Lesser General Public License, Version 2.1, February 1999 https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: http://github.com/languagetool-org/dutch-dict-tools; SCM: não declarado.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/english-pos-dict.jar

- Coordenadas: groupId=org.languagetool; artifactId=english-pos-dict; version=0.6.
- SHA-256: `2a3e96b49854e5275f8eb7a1bb5b3b85b82f687fed272f3043882ccc0b1634b1`.
- POM `META-INF/maven/org.languagetool/english-pos-dict/pom.xml`: GNU Lesser General Public License, Version 2.1, February 1999 https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: https://languagetool.org; SCM: não declarado.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/jakarta.activation-api.jar

- Coordenadas: artifactId=jakarta.activation-api; groupId=jakarta.activation; version=2.1.3.
- SHA-256: `01b176d718a169263e78290691fc479977186bcc6b333487325084d6586f4627`.
- POM `META-INF/maven/jakarta.activation/jakarta.activation-api/pom.xml`: EDL 1.0 http://www.eclipse.org/org/documents/edl-v10.php. Origem: https://github.com/jakartaee/jaf-api; SCM: scm:git:ssh://git@github.com/jakartaee/jaf-api.git.
- Textos/avisos incluídos: `META-INF/LICENSE.md`, `META-INF/NOTICE.md`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/jakarta.xml.bind-api.jar

- Coordenadas: artifactId=jakarta.xml.bind-api; groupId=jakarta.xml.bind; version=2.3.3.
- SHA-256: `c04539f472e9a6dd0c7685ea82d677282269ab8e7baca2e14500e381e0c6cec5`.
- Textos/avisos incluídos: `META-INF/LICENSE.md`, `META-INF/NOTICE.md`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/javax.activation-api.jar

- Coordenadas: version=1.2.0; groupId=javax.activation; artifactId=javax.activation-api.
- SHA-256: `43fdef0b5b6ceb31b0424b208b930c74ab58fac2ceeb7b3f6fd3aeb8b5ca4393`.
- Textos/avisos incluídos: `META-INF/LICENSE.txt`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/javax.annotation-api.jar

- Coordenadas: version=1.3.2; groupId=javax.annotation; artifactId=javax.annotation-api.
- SHA-256: `e04ba5195bcd555dc95650f7cc614d151e4bcd52d29a10b8aa2197f3ab89ab9b`.
- POM `META-INF/maven/javax.annotation/javax.annotation-api/pom.xml`: CDDL + GPLv2 with classpath exception https://github.com/javaee/javax.annotation/blob/master/LICENSE. Origem: http://jcp.org/en/jsr/detail?id=250; SCM: scm:git:https://github.com/javaee/javax.annotation.git.
- Textos/avisos incluídos: `META-INF/LICENSE.txt`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/jaxb-api.jar

- Coordenadas: groupId=javax.xml.bind; artifactId=jaxb-api; version=2.3.1.
- SHA-256: `88b955a0df57880a26a74708bc34f74dcaf8ebf4e78843a28b50eae945732b06`.
- Textos/avisos incluídos: `META-INF/LICENSE.txt`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/jaxb-impl.jar

- Coordenadas: artifactId=txw2; groupId=org.glassfish.jaxb; version=2.3.3 / artifactId=jaxb-runtime; groupId=org.glassfish.jaxb; version=2.3.3 / artifactId=istack-commons-runtime; groupId=com.sun.istack; version=3.0.11 / artifactId=jaxb-impl; groupId=com.sun.xml.bind; version=2.3.3.
- SHA-256: `e5178d0c7948247f75a13c689bf36f4d5d4910a121f712aa3b20ae94377069d8`.
- Textos/avisos incluídos: `META-INF/LICENSE.md`, `META-INF/NOTICE.md`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/jaxb-runtime.jar

- Coordenadas: artifactId=jaxb-runtime; groupId=org.glassfish.jaxb; version=4.0.5.
- SHA-256: `485d8940e76373a7f300815ea5504bf5b726c234425ad30971019d133124cca4`.
- Textos/avisos incluídos: `META-INF/LICENSE.md`, `META-INF/NOTICE.md`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/languagetool-core-tests.jar

- Coordenadas: groupId=org.languagetool; artifactId=languagetool-core; version=6.9-SNAPSHOT.
- SHA-256: `390aedea7ddc2e038348a502e7d0acad5bf63401c6fccacc9ce162d59b8d6806`.
- POM `META-INF/maven/org.languagetool/languagetool-core/pom.xml`: GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: https://www.languagetool.org; SCM: não declarado.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/languagetool-core.jar

- Coordenadas: groupId=org.languagetool; artifactId=languagetool-core; version=6.9-SNAPSHOT.
- SHA-256: `893f2ced5ed1d8cade2f82ad5d9a4ffee9ab47b4bea738ea230f993b2ddab4f4`.
- POM `META-INF/maven/org.languagetool/languagetool-core/pom.xml`: GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: https://www.languagetool.org; SCM: não declarado.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/languagetool-ga-dicts.jar

- Coordenadas: version=0.02; groupId=io.github.jimregan; artifactId=languagetool-ga-dicts.
- SHA-256: `52a9ecb80eb72cbe1105ed68ce22d529eb6d5e830ff2d065cf99322bc5f795c0`.
- POM `META-INF/maven/io.github.jimregan/languagetool-ga-dicts/pom.xml`: GNU General Public License, Version 2.0 https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html. Origem: https://github.com/jimregan/languagetool-ga-dicts; SCM: scm:git:git@github.com:jimregan/languagetool-ga-dicts.git.
- Textos/avisos incluídos: `org/languagetool/resource/ga/hunspell/LICENSES-en.txt`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/languagetool-gui-commons.jar

- Coordenadas: groupId=org.languagetool; artifactId=languagetool-gui-commons; version=6.9-SNAPSHOT.
- SHA-256: `9ea8dbbca292b9ef1e8f92087bf5235e2e14af57f5837403c87f91054e172a50`.
- POM `META-INF/maven/org.languagetool/languagetool-gui-commons/pom.xml`: GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: https://www.languagetool.org; SCM: não declarado.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/languagetool-tools.jar

- Coordenadas: groupId=org.languagetool; artifactId=languagetool-tools; version=6.9-SNAPSHOT.
- SHA-256: `0aeef2da7ee89f0208fed91e871535cf992df36b4f77774cc8216cb493cfe7dd`.
- POM `META-INF/maven/org.languagetool/languagetool-tools/pom.xml`: GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: https://www.languagetool.org; SCM: não declarado.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/mariadb-java-client.jar

- Coordenadas: artifactId=mariadb-java-client; groupId=org.mariadb.jdbc; version=3.4.1.
- SHA-256: `f60e4b282f1f4bdb74f0a26436ba7078a5e480b6f6702f6a7b45d9ba5e604a24`.
- POM `META-INF/maven/org.mariadb.jdbc/mariadb-java-client/pom.xml`: LGPL-2.1 . Origem: https://mariadb.com/kb/en/mariadb/about-mariadb-connector-j/; SCM: scm:git:git://github.com/mariadb-corporation/mariadb-connector-j.git.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/mybatis.jar

- Coordenadas: artifactId=mybatis; groupId=org.mybatis; version=3.5.16 / artifactId=ognl; groupId=ognl; version=3.4.2 / artifactId=javassist; groupId=org.javassist; version=3.30.2-GA.
- SHA-256: `1814d02fccd8dbeadf628cbac8962b1edaab9bfa67e8585c6a3663c48bd8953d`.
- POM `META-INF/maven/ognl/ognl/pom.xml`: The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt. Origem: https://github.com/orphan-oss/ognl/orphan/ognl/; SCM: scm:git:git@github.com:orphan-oss/ognl.git.
- POM `META-INF/maven/org.javassist/javassist/pom.xml`: MPL 1.1 https://www.mozilla.org/en-US/MPL/1.1/; LGPL 2.1 https://www.gnu.org/licenses/lgpl-2.1.html; Apache License 2.0 https://www.apache.org/licenses/LICENSE-2.0. Origem: https://www.javassist.org/; SCM: scm:git:git@github.com:jboss-javassist/javassist.git.
- Textos/avisos incluídos: `META-INF/LICENSE`, `META-INF/NOTICE`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/openregex.jar

- Coordenadas: version=1.1.1; groupId=edu.washington.cs.knowitall; artifactId=openregex.
- SHA-256: `33021c9cca70c6292d53ff7dac5d1832d422e986aba52ec998532a5f47f921f8`.
- POM `META-INF/maven/edu.washington.cs.knowitall/openregex/pom.xml`: LGPL (GNU Lesser General Public License) http://www.gnu.org/licenses/lgpl.html. Origem: http://knowitall.github.com/openregex/; SCM: scm:git://github.com/knowitall/openregex.git.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/portuguese-pos-dict.jar

- Coordenadas: groupId=org.languagetool; artifactId=portuguese-pos-dict; version=1.2.0.
- SHA-256: `fe8da88bb31b6372855741fbd81ee1c7477b4f8a0624d3dafd20ee23e184650e`.
- POM `META-INF/maven/org.languagetool/portuguese-pos-dict/pom.xml`: GNU Lesser General Public License, Version 2.1, February 1999 https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: http://github.com/languagetool-org/portuguese-dict-tools; SCM: não declarado.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/spanish-pos-dict.jar

- Coordenadas: groupId=org.softcatala; artifactId=spanish-pos-dict; version=2.5.
- SHA-256: `f5cf2f9939c0fd17dd0cad75a8fd05893c7a0c035bbf159b5dc8f81740271b9a`.
- POM `META-INF/maven/org.softcatala/spanish-pos-dict/pom.xml`: GNU Lesser General Public License, Version 2.1, February 1999 https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt. Origem: http://github.com/jaumeortola/spanish-dict-tools; SCM: não declarado.
- Textos/avisos incluídos: nenhum com nome convencional identificado.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

### libs/txw2.jar

- Coordenadas: artifactId=txw2; groupId=org.glassfish.jaxb; version=4.0.5.
- SHA-256: `917355bc451481f30d043b24d123110517966af34383901773882810dca480e5`.
- Textos/avisos incluídos: `META-INF/LICENSE.md`, `META-INF/NOTICE.md`.
- Lacuna: confirmar fonte correspondente e obrigações da opção escolhida; textos padrão/avisos de componentes não tornam automaticamente o JAR inteiro GPL.

## Cobertura de todos os JARs

155 JARs examinados; 25 selecionados acima por metadados/menções. A coluna de licenças é declaração POM, não parecer de compatibilidade. Arquivo sem POM de licença exige investigação adicional.

| JAR | Coordenadas/versões dos POMs | Licenças declaradas |
|---|---|---|
| languagetool-commandline.jar | groupId=org.languagetool; artifactId=languagetool-commandline; version=6.9-SNAPSHOT | GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| languagetool-server.jar | groupId=org.languagetool; artifactId=languagetool-server; version=6.9-SNAPSHOT | GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| languagetool.jar | groupId=org.languagetool; artifactId=languagetool-standalone; version=6.9-SNAPSHOT | GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| libs/aho-corasick-double-array-trie.jar | version=1.2.2; groupId=com.hankcs; artifactId=aho-corasick-double-array-trie | Apache License Version 2.0 https://www.apache.org/licenses/LICENSE-2.0.html |
| libs/angus-activation.jar | artifactId=angus-activation; groupId=org.eclipse.angus; version=2.0.2 | ausentes nos POMs embutidos examinados |
| libs/animal-sniffer-annotations.jar | artifactId=animal-sniffer-annotations; groupId=org.codehaus.mojo; version=1.27 | ausentes nos POMs embutidos examinados |
| libs/annotations.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/asturian-pos-dict.jar | version=0.1; groupId=org.languagetool; artifactId=asturian-pos-dict | GNU GENERAL PUBLIC LICENSE Version 3 https://fsf.org/ |
| libs/bcrypt.jar | version=0.10.2; groupId=at.favre.lib; artifactId=bcrypt | ausentes nos POMs embutidos examinados |
| libs/bytes.jar | version=1.5.0; groupId=at.favre.lib; artifactId=bytes | ausentes nos POMs embutidos examinados |
| libs/caffeine.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/catalan-pos-dict.jar | groupId=org.softcatala; artifactId=catalan-pos-dict; version=3.3 | GNU General Public License, Version 2, June 1991 https://www.gnu.org/licenses/gpl2.txt; GNU Lesser General Public License, Version 2.1, February 1999 https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| libs/checker-qual.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/commons-cli.jar | artifactId=commons-cli; groupId=commons-cli; version=1.9.0 | ausentes nos POMs embutidos examinados |
| libs/commons-codec.jar | artifactId=commons-codec; groupId=commons-codec; version=1.17.1 | ausentes nos POMs embutidos examinados |
| libs/commons-collections4.jar | version=4.4; groupId=org.apache.commons; artifactId=commons-collections4 | ausentes nos POMs embutidos examinados |
| libs/commons-digester.jar | version=2.1; groupId=commons-digester; artifactId=commons-digester | ausentes nos POMs embutidos examinados |
| libs/commons-io.jar | artifactId=commons-io; groupId=commons-io; version=2.17.0 | ausentes nos POMs embutidos examinados |
| libs/commons-lang3.jar | artifactId=commons-lang3; groupId=org.apache.commons; version=3.18.0 | ausentes nos POMs embutidos examinados |
| libs/commons-logging.jar | artifactId=commons-logging; groupId=commons-logging; version=1.3.4 | ausentes nos POMs embutidos examinados |
| libs/commons-pool2.jar | artifactId=commons-pool2; groupId=org.apache.commons; version=2.12.0 | ausentes nos POMs embutidos examinados |
| libs/commons-text.jar | artifactId=commons-text; groupId=org.apache.commons; version=1.12.0 | ausentes nos POMs embutidos examinados |
| libs/commons-validator.jar | artifactId=commons-validator; groupId=commons-validator; version=1.9.0 | ausentes nos POMs embutidos examinados |
| libs/dutch-pos-dict.jar | version=0.1; groupId=org.languagetool; artifactId=dutch-pos-dict | GNU Lesser General Public License, Version 2.1, February 1999 https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| libs/ecs-logging-core.jar | groupId=co.elastic.logging; artifactId=ecs-logging-core; version=1.3.2 | ausentes nos POMs embutidos examinados |
| libs/english-pos-dict.jar | groupId=org.languagetool; artifactId=english-pos-dict; version=0.6 | GNU Lesser General Public License, Version 2.1, February 1999 https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| libs/error_prone_annotations.jar | artifactId=error_prone_annotations; groupId=com.google.errorprone; version=2.41.0 | Apache 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/failureaccess.jar | artifactId=failureaccess; groupId=com.google.guava; version=1.0.3 | ausentes nos POMs embutidos examinados |
| libs/fastutil-core.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/french-pos-dict.jar | groupId=org.languagetool; artifactId=french-pos-dict; version=0.7 | Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) https://creativecommons.org/licenses/by-sa/4.0/ |
| libs/german-pos-dict.jar | version=1.2.4; groupId=de.danielnaber; artifactId=german-pos-dict | Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) https://creativecommons.org/licenses/by-sa/4.0/ |
| libs/grpc-api.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/grpc-context.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/grpc-core.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/grpc-netty-shaded.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/grpc-protobuf-lite.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/grpc-protobuf.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/grpc-stub.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/grpc-util.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/gson.jar | artifactId=gson; groupId=com.google.code.gson; version=2.13.2 | Apache-2.0 https://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/guava.jar | groupId=com.google.guava; artifactId=guava; version=33.5.0-jre | ausentes nos POMs embutidos examinados |
| libs/hamcrest-core.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/hanlp.jar | version=portable-1.8.2; groupId=com.hankcs; artifactId=hanlp | Apache License Version 2.0 https://www.apache.org/licenses/LICENSE-2.0.html |
| libs/HdrHistogram.jar | artifactId=HdrHistogram; groupId=org.hdrhistogram; version=2.2.2 | Public Domain, per Creative Commons CC0 http://creativecommons.org/publicdomain/zero/1.0/; BSD-2-Clause https://opensource.org/licenses/BSD-2-Clause |
| libs/hppc.jar | version=0.8.2; groupId=com.carrotsearch; artifactId=hppc | ausentes nos POMs embutidos examinados |
| libs/hunspell.jar | version=2.1.2; groupId=com.gitlab.dumonts; artifactId=hunspell | Apache License 2.0 https://gitlab.com/dumonts/hunspell-java/blob/master/LICENSE |
| libs/icu4j.jar | artifactId=icu4j; groupId=com.ibm.icu; version=77.1 / artifactId=core; groupId=com.ibm.icu; version=77.1 / artifactId=collate; groupId=com.ibm.icu; version=77.1 / artifactId=currdata; groupId=com.ibm.icu; version=77.1 / artifactId=langdata; groupId=com.ibm.icu; version=77.1 / artifactId=regiondata; groupId=com.ibm.icu; version=77.1 / artifactId=translit; groupId=com.ibm.icu; version=77.1 | Unicode-3.0 https://raw.githubusercontent.com/unicode-org/icu/maint/maint-77/LICENSE |
| libs/indriya.jar | version=1.3; groupId=tech.units; artifactId=indriya | BSD LICENSE |
| libs/istack-commons-runtime.jar | artifactId=istack-commons-runtime; groupId=com.sun.istack; version=4.1.2 | ausentes nos POMs embutidos examinados |
| libs/j2objc-annotations.jar | artifactId=j2objc-annotations; groupId=com.google.j2objc; version=3.1 | Apache License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/jackson-annotations.jar | artifactId=jackson-annotations; groupId=com.fasterxml.jackson.core; version=2.18.11 | The Apache Software License, Version 2.0 https://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/jackson-core.jar | artifactId=jackson-core; groupId=com.fasterxml.jackson.core; version=2.18.11 | The Apache Software License, Version 2.0 https://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/jackson-databind.jar | artifactId=jackson-databind; groupId=com.fasterxml.jackson.core; version=2.18.11 | The Apache Software License, Version 2.0 https://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/jakarta.activation-api.jar | artifactId=jakarta.activation-api; groupId=jakarta.activation; version=2.1.3 | EDL 1.0 http://www.eclipse.org/org/documents/edl-v10.php |
| libs/jakarta.activation.jar | groupId=com.sun.activation; artifactId=jakarta.activation; version=1.2.2 | ausentes nos POMs embutidos examinados |
| libs/jakarta.xml.bind-api.jar | artifactId=jakarta.xml.bind-api; groupId=jakarta.xml.bind; version=2.3.3 | ausentes nos POMs embutidos examinados |
| libs/java-diff-utils.jar | version=4.12; groupId=io.github.java-diff-utils; artifactId=java-diff-utils | ausentes nos POMs embutidos examinados |
| libs/javax.activation-api.jar | version=1.2.0; groupId=javax.activation; artifactId=javax.activation-api | ausentes nos POMs embutidos examinados |
| libs/javax.annotation-api.jar | version=1.3.2; groupId=javax.annotation; artifactId=javax.annotation-api | CDDL + GPLv2 with classpath exception https://github.com/javaee/javax.annotation/blob/master/LICENSE |
| libs/jaxb-api.jar | groupId=javax.xml.bind; artifactId=jaxb-api; version=2.3.1 | ausentes nos POMs embutidos examinados |
| libs/jaxb-core.jar | version=3.0.5; groupId=com.sun.istack; artifactId=istack-commons-runtime / groupId=org.glassfish.jaxb; artifactId=jaxb-core; version=2.3.0.1 / groupId=org.glassfish.jaxb; artifactId=txw2; version=2.3.0.1 / groupId=com.sun.xml.bind; artifactId=jaxb-core; version=2.3.0.1 | ausentes nos POMs embutidos examinados |
| libs/jaxb-impl.jar | artifactId=txw2; groupId=org.glassfish.jaxb; version=2.3.3 / artifactId=jaxb-runtime; groupId=org.glassfish.jaxb; version=2.3.3 / artifactId=istack-commons-runtime; groupId=com.sun.istack; version=3.0.11 / artifactId=jaxb-impl; groupId=com.sun.xml.bind; version=2.3.3 | ausentes nos POMs embutidos examinados |
| libs/jaxb-runtime.jar | artifactId=jaxb-runtime; groupId=org.glassfish.jaxb; version=4.0.5 | ausentes nos POMs embutidos examinados |
| libs/jcip-annotations.jar | version=1.0-1; groupId=com.github.stephenc.jcip; artifactId=jcip-annotations | Apache License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/jcl-over-slf4j.jar | artifactId=jcl-over-slf4j; groupId=org.slf4j; version=2.0.7 | Apache License, Version 2.0 https://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/jcommander.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/jna-platform.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/jna.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/json.jar | version=20240303; groupId=org.json; artifactId=json | Public Domain https://github.com/stleary/JSON-java/blob/master/LICENSE |
| libs/jsonic.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/jspecify.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/jsr305.jar | version=3.0.2; groupId=com.google.code.findbugs; artifactId=jsr305 | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/junit.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/jwordsplitter.jar | artifactId=jwordsplitter; groupId=de.danielnaber; version=4.7 | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/language-detector.jar | version=0.6; groupId=com.optimaize.languagedetector; artifactId=language-detector | Apache 2 http://www.apache.org/licenses/LICENSE-2.0 |
| libs/languagetool-core-tests.jar | groupId=org.languagetool; artifactId=languagetool-core; version=6.9-SNAPSHOT | GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| libs/languagetool-core.jar | groupId=org.languagetool; artifactId=languagetool-core; version=6.9-SNAPSHOT | GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| libs/languagetool-ga-dicts.jar | version=0.02; groupId=io.github.jimregan; artifactId=languagetool-ga-dicts | GNU General Public License, Version 2.0 https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html |
| libs/languagetool-gui-commons.jar | groupId=org.languagetool; artifactId=languagetool-gui-commons; version=6.9-SNAPSHOT | GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| libs/languagetool-tools.jar | groupId=org.languagetool; artifactId=languagetool-tools; version=6.9-SNAPSHOT | GNU Lesser General Public License http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| libs/lettuce-core.jar | artifactId=lettuce-core; groupId=io.lettuce; version=7.7.0.RELEASE | MIT https://github.com/redis/lettuce/blob/main/LICENSE |
| libs/linguistics.grammardb.spell.languagetool.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/listenablefuture.jar | version=9999.0-empty-to-avoid-conflict-with-guava; groupId=com.google.guava; artifactId=listenablefuture | ausentes nos POMs embutidos examinados |
| libs/logback-classic.jar | artifactId=logback-classic; groupId=ch.qos.logback; version=1.5.21 | ausentes nos POMs embutidos examinados |
| libs/logback-core.jar | artifactId=logback-core; groupId=ch.qos.logback; version=1.5.21 | ausentes nos POMs embutidos examinados |
| libs/logback-ecs-encoder.jar | groupId=co.elastic.logging; artifactId=logback-ecs-encoder; version=1.3.2 | ausentes nos POMs embutidos examinados |
| libs/lucene-backward-codecs.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/lucene-core.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/lucene-gosen-ipadic.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/mariadb-java-client.jar | artifactId=mariadb-java-client; groupId=org.mariadb.jdbc; version=3.4.1 | LGPL-2.1  |
| libs/micrometer-commons.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/micrometer-core.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/micrometer-observation.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/micrometer-registry-prometheus.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/morfologik-crh-lt.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/morfologik-fsa-builders.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/morfologik-fsa.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/morfologik-speller.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/morfologik-stemming.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/morfologik-tools.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/morfologik-ukrainian-lt.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/morphology-el.jar | version=1.0.0; groupId=org.ioperm; artifactId=morphology-el | Apache License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt; Creative Commons Attribution-ShareAlike 4.0 International License http://creativecommons.org/licenses/by-sa/4.0/ |
| libs/mybatis.jar | artifactId=mybatis; groupId=org.mybatis; version=3.5.16 / artifactId=ognl; groupId=ognl; version=3.4.2 / artifactId=javassist; groupId=org.javassist; version=3.30.2-GA | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt / MPL 1.1 https://www.mozilla.org/en-US/MPL/1.1/; LGPL 2.1 https://www.gnu.org/licenses/lgpl-2.1.html; Apache License 2.0 https://www.apache.org/licenses/LICENSE-2.0 |
| libs/netty-buffer.jar | artifactId=netty-buffer; groupId=io.netty; version=4.2.13.Final | ausentes nos POMs embutidos examinados |
| libs/netty-codec-base.jar | artifactId=netty-codec-base; groupId=io.netty; version=4.2.13.Final | ausentes nos POMs embutidos examinados |
| libs/netty-codec-dns.jar | artifactId=netty-codec-dns; groupId=io.netty; version=4.2.13.Final | ausentes nos POMs embutidos examinados |
| libs/netty-common.jar | artifactId=netty-common; groupId=io.netty; version=4.2.13.Final / version=4.0.6; groupId=org.jctools; artifactId=jctools-core | Apache License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/netty-handler.jar | artifactId=netty-handler; groupId=io.netty; version=4.2.13.Final | ausentes nos POMs embutidos examinados |
| libs/netty-resolver-dns.jar | artifactId=netty-resolver-dns; groupId=io.netty; version=4.2.13.Final | ausentes nos POMs embutidos examinados |
| libs/netty-resolver.jar | artifactId=netty-resolver; groupId=io.netty; version=4.2.13.Final | ausentes nos POMs embutidos examinados |
| libs/netty-transport-native-unix-common.jar | artifactId=netty-transport-native-unix-common; groupId=io.netty; version=4.2.13.Final | ausentes nos POMs embutidos examinados |
| libs/netty-transport.jar | artifactId=netty-transport; groupId=io.netty; version=4.2.13.Final | ausentes nos POMs embutidos examinados |
| libs/nimbus-jose-jwt.jar | groupId=com.nimbusds; artifactId=nimbus-jose-jwt; version=9.37.4 / artifactId=gson; groupId=com.google.code.gson; version=2.13.1 | The Apache Software License, Version 2.0 https://www.apache.org/licenses/LICENSE-2.0.txt / Apache-2.0 https://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/opennlp-chunk-models.jar | version=1.5; groupId=edu.washington.cs.knowitall; artifactId=opennlp-chunk-models | ausentes nos POMs embutidos examinados |
| libs/opennlp-postag-models.jar | version=1.5; groupId=edu.washington.cs.knowitall; artifactId=opennlp-postag-models | ausentes nos POMs embutidos examinados |
| libs/opennlp-tokenize-models.jar | version=1.5; groupId=edu.washington.cs.knowitall; artifactId=opennlp-tokenize-models | ausentes nos POMs embutidos examinados |
| libs/opennlp-tools.jar | version=1.9.5; groupId=org.apache.opennlp; artifactId=opennlp-tools | ausentes nos POMs embutidos examinados |
| libs/openregex.jar | version=1.1.1; groupId=edu.washington.cs.knowitall; artifactId=openregex | LGPL (GNU Lesser General Public License) http://www.gnu.org/licenses/lgpl.html |
| libs/opentelemetry-api.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/opentelemetry-common.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/opentelemetry-context.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/opentelemetry-semconv.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/perfmark-api.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/portuguese-pos-dict.jar | groupId=org.languagetool; artifactId=portuguese-pos-dict; version=1.2.0 | GNU Lesser General Public License, Version 2.1, February 1999 https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| libs/prometheus-metrics-config.jar | artifactId=prometheus-metrics-config; groupId=io.prometheus; version=1.7.0 | ausentes nos POMs embutidos examinados |
| libs/prometheus-metrics-core.jar | artifactId=prometheus-metrics-core; groupId=io.prometheus; version=1.7.0 | ausentes nos POMs embutidos examinados |
| libs/prometheus-metrics-exposition-formats.jar | artifactId=prometheus-metrics-exposition-formats; groupId=io.prometheus; version=1.7.0 | ausentes nos POMs embutidos examinados |
| libs/prometheus-metrics-exposition-textformats.jar | artifactId=prometheus-metrics-exposition-textformats; groupId=io.prometheus; version=1.7.0 | ausentes nos POMs embutidos examinados |
| libs/prometheus-metrics-model.jar | artifactId=prometheus-metrics-model; groupId=io.prometheus; version=1.7.0 | ausentes nos POMs embutidos examinados |
| libs/prometheus-metrics-tracer-common.jar | artifactId=prometheus-metrics-tracer-common; groupId=io.prometheus; version=1.7.0 | ausentes nos POMs embutidos examinados |
| libs/proto-google-common-protos.jar | artifactId=proto-google-common-protos; groupId=com.google.api.grpc; version=2.64.1 | Apache-2.0 https://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/protobuf-java.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/reactive-streams.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/reactor-core.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/redis-authx-core.jar | artifactId=redis-authx-core; groupId=redis.clients.authentication; version=0.1.1-beta2 | MIT https://github.com/redis/redis-authx-core/blob/master/LICENSE |
| libs/resilience4j-circuitbreaker.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/resilience4j-core.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/resilience4j-micrometer.jar | não declaradas | ausentes nos POMs embutidos examinados |
| libs/segment.jar | artifactId=segment; groupId=net.loomchild; version=2.0.4 | MIT License http://www.opensource.org/licenses/mit-license.php |
| libs/simpleclient.jar | groupId=io.prometheus; artifactId=simpleclient; version=0.16.0 | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/simpleclient_common.jar | groupId=io.prometheus; artifactId=simpleclient_common; version=0.16.0 | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/simpleclient_guava.jar | groupId=io.prometheus; artifactId=simpleclient_guava; version=0.16.0 | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/simpleclient_hotspot.jar | groupId=io.prometheus; artifactId=simpleclient_hotspot; version=0.16.0 | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/simpleclient_httpserver.jar | groupId=io.prometheus; artifactId=simpleclient_httpserver; version=0.16.0 | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/simpleclient_tracer_common.jar | groupId=io.prometheus; artifactId=simpleclient_tracer_common; version=0.16.0 | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/simpleclient_tracer_otel.jar | groupId=io.prometheus; artifactId=simpleclient_tracer_otel; version=0.16.0 | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/simpleclient_tracer_otel_agent.jar | groupId=io.prometheus; artifactId=simpleclient_tracer_otel_agent; version=0.16.0 | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/slf4j-api.jar | artifactId=slf4j-api; groupId=org.slf4j; version=2.0.16 | ausentes nos POMs embutidos examinados |
| libs/spanish-pos-dict.jar | groupId=org.softcatala; artifactId=spanish-pos-dict; version=2.5 | GNU Lesser General Public License, Version 2.1, February 1999 https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt |
| libs/txw2.jar | artifactId=txw2; groupId=org.glassfish.jaxb; version=4.0.5 | ausentes nos POMs embutidos examinados |
| libs/unit-api.jar | version=1.0; groupId=javax.measure; artifactId=unit-api | BSD LICENSE.txt |
| libs/uom-lib-common.jar | version=1.1; groupId=tech.uom.lib; artifactId=uom-lib-common | ausentes nos POMs embutidos examinados |
| libs/vavr-match.jar | version=0.10.2; groupId=io.vavr; artifactId=vavr-match | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/vavr.jar | version=0.10.2; groupId=io.vavr; artifactId=vavr | The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt |
| libs/waffle-jna.jar | artifactId=waffle-jna; groupId=com.github.waffle; version=3.3.0 | ausentes nos POMs embutidos examinados |

## Avisos locais de recursos examinados

Esta lista torna verificável a cobertura dos avisos, sem reproduzir textos integrais. Recursos binários podem não conter licenças pesquisáveis.
- `org/languagetool/resource/ar/hunspell/COPYING`
- `org/languagetool/resource/ar/README.txt`
- `org/languagetool/resource/ast/README.txt`
- `org/languagetool/resource/br/README.txt`
- `org/languagetool/resource/ca/README.txt`
- `org/languagetool/resource/da/hunspell/README_da_DK.txt`
- `org/languagetool/resource/da/README.txt`
- `org/languagetool/resource/de/hunspell/COPYING_GPLv2.txt`
- `org/languagetool/resource/de/hunspell/COPYING_GPLv3.txt`
- `org/languagetool/resource/de/hunspell/de_AT_frami_README.txt`
- `org/languagetool/resource/de/hunspell/de_CH_frami_README.txt`
- `org/languagetool/resource/de/hunspell/de_DE_frami_README.txt`
- `org/languagetool/resource/el/hunspell/README_el_GR.txt`
- `org/languagetool/resource/el/README.txt`
- `org/languagetool/resource/eo/hunspell/README_eo.txt`
- `org/languagetool/resource/gl/hunspell/README-gl-ES.txt`
- `org/languagetool/resource/gl/README.txt`
- `org/languagetool/resource/it/hunspell/README_it_IT.txt`
- `org/languagetool/resource/it/README.txt`
- `org/languagetool/resource/km/hunspell/LICENSES-en.txt`
- `org/languagetool/resource/pl/hunspell/README_en.txt`
- `org/languagetool/resource/ro/hunspell/COPYING.GPL`
- `org/languagetool/resource/ro/hunspell/COPYING.LGPL`
- `org/languagetool/resource/ro/hunspell/README_EN.txt`
- `org/languagetool/resource/ro/hunspell/README_RO.txt`
- `org/languagetool/resource/ro/README.txt`
- `org/languagetool/resource/ru/hunspell/README.txt`
- `org/languagetool/resource/ru/README.txt`
- `org/languagetool/resource/sk/hunspell/README_en.txt`
- `org/languagetool/resource/sk/hunspell/README_sk.txt`
- `org/languagetool/resource/sk/README.txt`
- `org/languagetool/resource/sl/hunspell/README_sl_SI.txt`
- `org/languagetool/resource/sv/hunspell/LICENSE_en_US.txt`
- `org/languagetool/resource/sv/hunspell/LICENSE_sv_SE.txt`
- `org/languagetool/resource/sv/README.txt`
- `org/languagetool/resource/ta/README.txt`
- `org/languagetool/resource/tl/hunspell/README_tl_PH.txt`
- `org/languagetool/resource/tl/README.txt`
- `org/languagetool/resource/uk/README.txt`

## Pendências antes da redistribuição

1. Registrar nova decisão ADR012/008 para bytes identificados e pacote completo ou reduzido, sem converter prova operacional em aprovação jurídica.
2. Obter/arquivar fontes LT no commit identificado e fontes/receitas exatas dos dicionários GPL e bibliotecas necessárias. URL genérica de projeto, COPYing e checksum não comprovam cumprimento de disponibilização de fontes.
3. Resolver alternativas por arquivo, termos sem versão e modificações LT; preservar créditos, patches e avisos. Estabelecer mecanismo concreto de entrega/acesso a fontes conforme licença escolhida e forma de distribuição, com revisão jurídica quando necessária.
4. Se reduzir idiomas/JARs, produzir novo artifact/hash, inventário e testes; não apagar componentes do candidato por suposição de desuso.

Sem alterações de produto. Não foi provada completude jurídica; nenhum arquivo do usuário foi incluído.

## Avisos GPL em recursos internos de JARs

- `libs/asturian-pos-dict.jar!/org/languagetool/resource/ast/hunspell/LICENSES-en.txt`: Distributed under GPL license v3
- `libs/languagetool-ga-dicts.jar!/org/languagetool/resource/ga/hunspell/LICENSES-en.txt`: http://www.gnu.org/licenses/old-licenses/gpl-2.0.txt
