# Runtime de release

Este diretório é preenchido apenas durante o empacotamento. Binários de terceiros
não são versionados. O workflow executa `scripts/install-languagetool.ps1`, que
valida tamanho, SHA-256, componentes extraídos e avisos de licença antes do bundle.
Os arquivos compactados baixados existem somente no diretório temporário de instalação e não são
incluídos no instalador depois que o runtime extraído é verificado. O build Windows também inclui
o bootstrapper assinado da Microsoft para instalar WebView2 somente quando estiver ausente.
