# Investigação de tradução e OCR — 29/10/2026

Escopo: Windows instalado 0.2.2 e checkout principal na base `460cf4546ecdbe88308f16f8f6c9a346ea4b48ea`. Arquivos privados e derivados permanecem locais; os testes de tradução usam texto autoral fictício.

## Download do modelo

Em ensaio anterior de perfil WebView2 temporário, dois downloads do CDN falharam com `ERR_CONNECTION_RESET`. Nesta investigação, `curl` baixou os dois arquivos completos em sequência: encoder 287.856.370 bytes e decoder 344.128.178 bytes. Os SHA-256 corresponderam aos declarados em `translation-protocol.ts` (`13a94e…0386` e `007654…b45a`). Uma repetição do fluxo de tradução no aplicativo instalado, em perfil novo, terminou com sucesso. Portanto o erro foi intermitente no ambiente observado; não foi identificada sua causa exata e os downloads diretos não provam o que ocorreu dentro do WebView na tentativa anterior.

A frase autoral inglês → português preservou nome literal, números e marcador de negação na verificação automática. É apenas um caso, não uma avaliação semântica independente nem prova de preservação em outros textos. Em outra repetição, após recarregar a página, bloqueou-se o acesso aos domínios Hugging Face/CDN e uma nova frase foi traduzida com negação preservada; isso demonstra reutilização local de recursos nessa sessão, sem provar persistência após reiniciar o aplicativo ou disponibilidade offline em todos os perfis.

Uma repetição adicional em perfil novo avançou até 61,7 de 602,7 MiB lentamente, sem mensagem de erro naquele momento; foi interrompida após já haver uma execução completa validada. Não se atribui a lentidão a uma causa específica.

## Ensaio de preparação de OCR

Executaram-se 20 reconhecimentos isolados em Tesseract.js/Node, idioma português e segmentação automática: uma fotografia privada e as quatro imagens sintéticas versionadas de OCR-C1, multiplicadas por quatro preparos. Original em tons de cinza, CLAHE, máscara de nitidez e limiar adaptativo foram aplicados com OpenCV 5.0.0 disponível neste ambiente. Trata-se de experimento local; não foi adicionada dependência ao produto. Os dados privados não saíram da máquina.

| Amostra | Original | CLAHE | Nitidez | Limiar adaptativo |
| --- | ---: | ---: | ---: | ---: |
| Sintética: acentos e números, CER | 0% | 0% | 0,65% | 0% |
| Sintética: baixo contraste, CER | 0% | 0% | 0% | 0% |
| Sintética: inclinação, CER | 2,61% | 2,61% | 1,96% | 2,61% |
| Sintética: perspectiva, CER | 0,65% | 0,65% | 0,65% | 0,65% |
| Fotografia privada: referências exatas encontradas | 1/4 | 0/4 | 0/4 | 0/4 |

CER usa distância de edição após normalização de espaços e NFC sobre a transcrição sintética autoral, preservando acentos e pontuação. Resultados da fotografia usam quatro referências parciais, sem transcrição integral; quantidade de caracteres não demonstra qualidade. O perfil Node e as transformações diferem do caminho WebView/PDF do aplicativo, onde a mesma amostra anteriormente teve 0/4. Nenhum dos preparos experimentais melhorou as referências da fotografia; nitidez melhorou a amostra inclinada, mas introduziu erro em outra. Isso não sustenta integrar qualquer dos métodos nem identifica isoladamente a causa da falha em fotografia. Uma avaliação ampla precisa de mais fotografias autorizadas e transcrições integrais, além da execução no caminho efetivo do aplicativo.

## Revisão humana

A [ficha de revisão bilíngue](REVISAO-BILINGUE-2026-10-29.md) reúne lado a lado 24 frases curtas do ensaio M2M100 anterior e seis textos longos segmentados, com campos para avaliação. As 30 comparações foram conferidas com os arquivos JSON de evidência. O usuário marcou os 30 casos como aprovados, sem observações adicionais, em 29/10/2026. A verificação literal identificou nomes alterados em cinco casos (5, 7, 13, 26 e 28); as marcações do revisor e a verificação literal registram critérios distintos. A aprovação é restrita aos textos mostrados e não demonstra preservação literal geral de nomes ou fidelidade de outros documentos. O arquivo revisado, no momento da conferência, tinha SHA-256 `be1900a70be649bf3ac3eeaa5d74f208efa743952195ea41e39ad70dfdebfde4`.


## Continuação: lista explícita, rede e geometria

O usuário escolheu uma lista explícita de nomes. Foi implementado o campo “Nomes a preservar” no fluxo browser, com propagação UI → executor → worker → segmentação. Correspondências completas Unicode são copiadas literalmente; nomes maiores têm prioridade e não se substituem partes de outras palavras. Não há detecção automática. O campo usa o catálogo pt-BR. Os testes verificam acentos, sobreposição, passagem pela interface e ausência dos nomes nas entradas enviadas ao modelo. É uma alteração local de código, ainda não distribuída no executável instalado.

O ensaio com NetLog no WebView reproduziu `ERR_CONNECTION_RESET` para os dois pesos no CDN. O log registrou erro de socket Windows 10054 e fechamento de sessão HTTP/2 com erro -101 durante leitura do corpo. Também houve erros TLS e de descoberta automática de proxy em outras fontes do log, sem vínculo causal demonstrado com o CDN. Uma comparação com HTTP/2 e QUIC desativados apenas no processo de teste terminou com tradução e reutilização local após recarregar; o log dessa comparação não continha eventos HTTP/2 ou resets. A execução padrão tinha 90.432 eventos HTTP/2 e 15 ocorrências de -101 em diferentes camadas, que não correspondem necessariamente a 15 falhas independentes. O resultado aponta HTTP/2/caminho de transporte como hipótese a reproduzir, não comprova falha no protocolo ou no servidor. Não foram alterados proxy, TLS ou argumentos do aplicativo distribuído. Os logs completos contêm URLs temporárias e permanecem locais em `target/qa`.

Para o OCR, foram recortadas manualmente as duas regiões de texto e aplicadas rotações aproximadas (-15 e -2 graus), seguidas de ampliação cúbica 3×. A segmentação automática recuperou 0/4 referências; bloco único, 1/4; texto esparso, 0/4. Os recortes são diagnósticos locais, não regras incorporadas ao produto. A fotografia também mostra curvatura, texto cortado no enquadramento e parte da página obstruída. Não foi demonstrado que uma simples correção de inclinação resolva a amostra. Em controle sintético, reduzir a imagem para 25% das dimensões produziu CER 0,65%; reampliá-la retornou CER 0%. Portanto esse controle não reproduziu a gravidade da fotografia e não isola resolução como causa suficiente. A recuperação do texto ausente no enquadramento não pode ser validada por tratamento de imagem.


O worker real do código alterado foi executado em Chromium com o M2M100 para português → espanhol, em duas passagens: primeira carga e worker novo com Hugging Face bloqueado. Ambas preservaram `Maria Silva`, `125` e `14/03/2026`; não houve erros e o ensaio conferiu recursos em cache. A [saída registrada](evidencias/tr-c1/nomes-preservados-2026-10-29.json) apresenta “Maria Silva No autorizó…”, ilustrando a capitalização causada por inferir o trecho ao redor separadamente. A revisão humana anterior não é aprovação dessa saída nova. Não se aplicou correção arbitrária de capitalização, porque ela poderia alterar siglas ou palavras de outros idiomas.

Validação da alteração: 46 testes de tradução/interface/protocolo e 43 testes de executor/carregador aprovados; formatter, lint e typecheck aprovados, com os dois avisos preexistentes de placeholders em fixture; build web aprovado, com avisos de tamanho de chunks. O executável instalado foi usado nos diagnósticos de rede; ele ainda não contém o campo de nomes. Não houve commit, push, release ou instalação de nova versão.
