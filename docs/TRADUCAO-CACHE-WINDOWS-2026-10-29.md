# Persistência da tradução no Windows — 29/10/2026

Aplicativo instalado 0.2.2, executável em `%LOCALAPPDATA%/Programs/NexoHub/nexohub-desktop.exe`. Perfil temporário exclusivo criado pelo teste e reutilizado em três processos distintos; o perfil pessoal não foi modificado. O teste usa texto autoral fictício e confere o número 125 e o marcador de negação na saída.

| Fase | Resultado | Requisições a Hugging Face/CDN |
| --- | --- | ---: |
| Primeira carga com rede | Tradução concluída | 18 |
| Após fechar e reabrir, com rede | Tradução concluída | 0 |
| Após fechar e reabrir novamente, offline | Tradução concluída | 0 |

As 18 requisições incluem recursos e redirecionamentos; não são 18 downloads do modelo inteiro. Entre fases o teste aguardou a saída do processo antes de iniciar outra instância com o mesmo diretório de dados. O primeiro fechamento ocorreu pelo atalho normal da janela; o segundo por sinal de encerramento sem força ao PID da instância de teste. Não houve simples recarga de tela nem transferência de estado em memória entre processos.

A condição offline foi aplicada via emulação de rede do contexto WebView2 antes de entrar na tela e executar a tradução. A rede do computador permaneceu ativa. O perfil já havia recebido o modelo e os recursos na primeira fase. Isso valida o uso local depois de reiniciar nesse perfil e versão; não garante cache após limpeza de dados, mudança de perfil, pressão de armazenamento ou atualização do modelo.

Resultado: não foi observado download desnecessário depois de fechar e reabrir. Nenhuma alteração no cache da aplicação foi necessária. O teste optativo está em `apps/client/e2e/windows-pages-e2e.spec.ts`, selecionado por “tradução persiste após fechar”; requer `NEXOHUB_DESKTOP_EXE` e `NEXOHUB_TRANSLATION_PERSISTENCE=1`. Quando o teste registra “FECHAR JANELA DE TESTE”, é necessário fechar aquela instância e aguardar a reabertura automática. As contagens das três fases foram emitidas no console e transcritas em [evidência JSON](evidencias/tr-c1/cache-windows-2026-10-29.json). O teste foi ajustado para também gravar o arquivo no diretório de saída em novas execuções, pois o reporter de lista não preservou o anexo do teste aprovado. O perfil temporário é removido ao término.
