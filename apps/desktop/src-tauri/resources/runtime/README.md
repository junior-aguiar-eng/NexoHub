# Runtime de release

Binários de terceiros não são versionados. O instalador NexoHub não incorpora
LanguageTool nem Java. Selecione a tarefa opcional **Instalar revisor local** para
baixar 312 MB dos sites oficiais e verificar os tamanhos, SHA-256, JARs e avisos
fixados no manifesto. Depois desse preparo, a revisão permanece local.

Sem selecionar a tarefa, o aplicativo é instalado com o revisor nativo indisponível.
É possível executar o instalador novamente para prepará-lo. Uma instalação íntegra
é preservada; uma instalação conflitante é recusada, sem substituição silenciosa.
O diagnóstico fica em `runtime/setup/languagetool-install.log`. Uma falha nessa
tarefa produz código de saída 20, mesmo que a instalação básica tenha terminado.

O build Windows inclui o bootstrapper assinado da Microsoft para instalar WebView2
somente quando estiver ausente. A lista explícita do pacote impede incorporar
runtimes locais de desenvolvimento por engano (ADR-019).
