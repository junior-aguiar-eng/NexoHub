# Runtime de release

Este diretório é preenchido apenas durante o empacotamento. Binários de terceiros
não são versionados. O workflow executa `scripts/install-languagetool.ps1`, que
valida tamanho, SHA-256, componentes extraídos e avisos de licença antes do bundle.
Os arquivos compactados baixados existem somente no diretório temporário de instalação e não são
incluídos no bundle depois que o runtime extraído é verificado.
