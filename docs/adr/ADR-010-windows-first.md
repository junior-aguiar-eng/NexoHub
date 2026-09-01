# ADR-010: Windows-first e congelamento de plataformas

- **Status:** aceito
- **Contexto:** o produto precisa avançar com uma matriz de validação sustentável. O desktop
  Windows usa a cadeia estável Tauri/Wry/WebView2, enquanto Linux e mobile exigem toolchains,
  runtimes e gates próprios ainda não assumidos pelo projeto.
- **Decisão:** adotar Windows como único alvo desktop produtivo atual e manter o client web como
  superfície suportada. Congelar por prazo indeterminado Linux, Android, iOS e qualquer outro
  sistema nativo, sem prazo, marco, obrigação de implementação ou participação no roadmap. Tauri,
  entrypoints, assets e dependências condicionais permanecem apenas como possibilidade técnica,
  sem representar intenção, promessa ou planejamento de suporte.
- **Consequências:** CI e release nativos executam em Windows; o client web mantém gates de
  navegador; o React continua compartilhado entre as duas superfícies. A UI consulta capacidades,
  não o sistema operacional. Plataformas congeladas não condicionam o desenvolvimento Windows.
  Sua eventual avaliação somente ocorrerá se e quando o mantenedor adotar decisão futura,
  discricionária e expressa; somente então poderão ser definidos ADR, CI e critérios de aceite.
- **Dependência Linux:** a cadeia condicional Tauri/Wry para Linux permanece em GTK3/WebKitGTK e
  resolve `glib 0.18.5`. Ela não é compilada nem executada no alvo Windows. A eventual eliminação
  dessa versão depende da migração oficial coordenada para GTK4 caso o suporte Linux venha a ser
  expressamente avaliado; não serão usados fork não auditado, vendorizção ou remoção artificial da
  cadeia para ocultar o alerta.
