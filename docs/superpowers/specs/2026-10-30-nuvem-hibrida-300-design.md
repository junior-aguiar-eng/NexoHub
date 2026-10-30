# Nuvem opcional para 300 pessoas — proposta de arquitetura

Data: 30/10/2026. Base examinada: `44b4cd20056856236d14c913af8b5469b639be9d`, Windows 0.2.4.
Estado: design/plano aprovados pelo usuário em 30/10/2026 para iniciar implementação local. Provisionamento e publicação não executados nem autorizados nesta etapa.
Pedido: manter uso local gratuito e adicionar nuvem com cotas verificadas no servidor, orçamento mensal de US$ 100 e confirmação antes de enviar documentos.
Escolha expressa do usuário: Google e e-mail confirmado para acesso à nuvem.

## 1. Objetivo e fronteiras

- Até 300 participantes admitidos no piloto; visitantes continuam usando as ferramentas locais sem conta, cartão, franquia mensal artificial ou dependência do backend de cotas.
- Uma conta persistente é necessária somente para nuvem. Conta não prova pessoa física única: acesso remoto inicial por convite individual, sem inscrição pública automática.
- OCR, tradução de texto e Office→PDF são os candidatos iniciais. Cada motor só fica disponível após avaliação de qualidade, custo e licença. PDF→Office comercial, IA generativa, pagamentos e sincronização de documentos ficam fora deste plano.
- Nenhum fallback local→nuvem automático. Requisições explícitas a autenticação não autorizam upload de documentos.
- Nenhuma promessa genérica de qualidade superior ao iLovePDF; comparar resultados por ferramenta e corpus.

## 2. Arquitetura observada e alternativas

O cliente compartilhado React usa Tool Registry, SDK e Platform Ports. O servidor Axum já existe em `crates/nexohub-server`; suas sessões em memória (`sessions.rs`) concedem acesso temporário a projetos, não são contas nem um saldo mensal. `/invoke/{command}`, `/tools/ocr` e outros caminhos precisam ser auditados para não permitir contornar o novo controle. SQLite local e memória de uma instância não podem ser a fonte de cotas distribuídas.

Alternativas consideradas:

1. Cliente local + adapter opcional, servidor Axum reutilizado, Identity Platform/Firebase Authentication, Firestore Standard e armazenamento privado temporário: recomendada para piloto, pois não exige VM/SQL sempre ativos.
2. VM/Cloud SQL e autenticação própria: maior custo fixo e responsabilidade de operação; não recomendada para 300 participantes.
3. API comercial completa de PDF: pode reduzir trabalho de motores, mas impõe cobrança e tratamento externo adicionais; não contratada por este plano.

O usuário escolheu o modelo híbrido e os métodos de entrada, e depois aprovou o plano em 30/10/2026. A alternativa 1 e as decisões técnicas abaixo orientam a implementação; a ativação depende dos gates operacionais.

### Componentes propostos

- Cliente web e Windows: `CloudProcessingPort` e `CloudIdentityPort`, usados pelo executor compartilhado e telas; nenhuma chamada direta de componente a Firestore, Storage ou SDK do Google.
- Autenticação gerenciada: Google ou link por e-mail, sem banco de senhas do NexoHub. Identificador interno é o UID, nunca e-mail ou IP.
- API/worker: mesmo monólito Rust, com papéis de deploy distintos quando necessário, em projeto GCP dedicado ao consumo híbrido. Site atual permanece disponível se a nuvem for bloqueada. Não criar novo domínio funcional nem microserviços por ferramenta.
- Firestore Standard: apenas contas admitidas, convites, cotas, reservas, estados de jobs e auditoria sem conteúdo documental. Clientes sem permissão direta de escrita/leitura. Uso pelo backend via identidade de serviço e IAM restrito.
- Cloud Tasks: fila durável chamando endpoint interno autenticado; entrega pode repetir. Não confiar na unicidade da entrega.
- Cloud Storage Standard: bucket privado, objetos vinculados ao UID/job, limites de armazenamento e download. Sem histórico remoto permanente.
- Serviços gerenciados candidatos: Document AI Enterprise OCR e Cloud Translation NMT. Conversão Office em LibreOffice isolado, sem licença comercial presumida.
- Novo ADR-020, proposto durante implementação, reconciliará ADR-001/015/016, PRODUCT, ARCHITECTURE e PRIVACY. Não alterar o significado dos ADRs aceitos silenciosamente.

## 3. Identidade e admissão

- Login opcional para uso local. Para nuvem: token válido, e-mail confirmado, conta não suspensa e vínculo ativo com um dos 300 lugares.
- Backend valida assinatura, emissor, audiência, validade e estado da conta; não aceita UID, saldo ou função de administrador informados pelo cliente.
- Administrador mantém convites por e-mail normalizado e admite no máximo 300 UIDs em transação. Convites não usados expiram em 7 dias. Nada de painel administrativo público na primeira entrega: comando administrativo autenticado e auditado.
- Vincular Google e link de e-mail ao mesmo UID somente com comprovação autenticada dos provedores; não fundir contas só pela coincidência de uma string de e-mail.
- Excluir/recriar conta não concede novo saldo no mesmo período: associação administrativa de participante preserva a competência consumida. Retenção e pseudonimização dessa associação precisam constar da política aprovada.
- Windows: login no navegador do sistema, retorno por fluxo de código único vinculado a desafio/estado e instância solicitante; código expira em 60 segundos e não transporta token em URL. Conclusão pelo Platform Port nativo, com armazenamento de sessão protegido pelo Windows. Não persistir refresh token em localStorage/SQLite em claro nem fazer login Google em WebView embutida.
- Web: SDK oficial no adapter, configuração de persistência mínima, proteção de origem e logout. Não registrar tokens nem endereços de e-mail em logs operacionais.
- Revogação de sessão/suspensão impede novas reservas. Reconexão e múltiplos dispositivos compartilham a mesma cota.

## 4. Cotas iniciais e limites

Propostas iniciais, ajustáveis para baixo por custo/qualidade, sem efeito retroativo sobre reservas aceitas:

| Recurso | Teto mensal por participante | Por tarefa | Tempo máximo do processamento |
| --- | --- | --- | --- |
| OCR em nuvem | 50 páginas | 1 PDF/imagem, 15 páginas, 20 MiB, 25 MP por imagem/página renderizada | 120 s |
| Tradução de texto NMT | 5.000 caracteres Unicode | 5.000 caracteres, 1 idioma de destino; texto simples, sem documento com layout | 60 s |
| Office→PDF | 10 arquivos | 1 DOCX/XLSX/PPTX, 10 MiB; máximo de 50 páginas de saída | 120 s |

- Os tetos por ferramenta não são franquias cumulativas garantidas: todos também dependem do saldo financeiro conjunto do participante e do serviço, mostrado antes de cada envio. Documentos acima dos limites são recusados, nunca truncados silenciosamente.
- Saldo financeiro interno por participante: US$ 0,20/mês, sem compra ou cobrança ao participante. Representa o subsídio do NexoHub, não uma carteira financeira. A interface mostra unidades e saldo de uso, não exige entender dólares.
- 1 tarefa em processamento e 1 aguardando por participante; no máximo 2 em execução e 20 aguardando globalmente. Admissão/recontagem em armazenamento compartilhado, não apenas semáforo local.
- Limitar também prévias de orçamento: 5 inspeções/dia e 60/mês por participante; global 6.000/mês. Operações de inspeção e rejeição também consomem infraestrutura e têm verba reservada.
- Upload: até 120 s; orçamento/consentimento expira em 5 min; espera em fila até 5 min. Após envio, revalidar limites e preço antes da chamada paga.
- Saída até 30 MiB; no máximo 3 downloads completos por job. Downloads parciais e novas URLs não reiniciam o limite de bytes: até 90 MiB total por job, reservado no orçamento.
- No máximo 2 GiB de objetos temporários admitidos globalmente, somando reservas de bytes para entrada/saída; bloquear upload antes de conceder acesso se não houver espaço.
- PDF protegido, arquivo inválido, macros, objetos Office incorporados e referências externas: recusa explícita no piloto. Verificar tipo real, compactação, contagem, dimensões e limites dentro de execução isolada. Tamanho ZIP declarado não é tamanho descompactado.
- Competência mensal: primeiro dia às 00:00 em `America/Los_Angeles`, alinhada ao período de faturamento a confirmar no gate operacional. Guardar datas UTC, mostrar próxima renovação no horário do usuário. Reservas e jobs pertencem à competência de admissão; execução não começa em nova competência com reserva antiga sem reconfirmação.
- Virada: suspender novas operações pagas nos 15 minutos anteriores ao início da competência. Jobs ainda inconclusivos na virada também comprometem conservadoramente o saldo da nova competência até determinar quando/quanto foi faturado; não zerar nem liberar suas reservas na renovação. Esse carry-over não duplica a fatura, apenas reduz provisoriamente a capacidade disponível.

## 5. Controle dos US$ 100

### Escopo do valor

Orçamento para o consumo incremental do piloto híbrido, em USD a preço de lista antes de créditos, por projeto dedicado. Não é limite de toda a conta GCP nem inclui desenvolvimento, licenças comerciais, impostos ou câmbio. Se o usuário exigir US$ 100 para a conta inteira ou valor final com impostos, redimensionar antes de ativar.

Distribuição proposta:

| Destinação | Valor mensal |
| --- | ---: |
| Tarefas e inspeções admitidas, incluindo compute/tráfego atribuível | US$ 60 |
| Operação: autenticação, Firestore, fila, armazenamento residual, logs, imagens e builds | US$ 15 |
| Margem para diferenças de medição, chamadas em andamento e eventos não atribuíveis | US$ 25 |
| Total de referência | US$ 100 |

Os 300 saldos de US$ 0,20 somam US$ 60. Não repartir créditos gratuitos como se fossem capacidade contratada. Novos convites não aumentam o pool, e desligar participante não apaga gastos anteriores.

### Admissão financeira

1. Manter preços versionados por serviço, região e unidade, em inteiros `usdMicros` (US$ 1 = 1.000.000), sem ponto flutuante financeiro.
2. Reservar em transação o máximo conservador: API, compute até timeout, inicialização, inspeção, tráfego permitido, armazenamento e retentativas expressamente previstas. Resultado médio de 20 segundos não serve como teto de reserva.
3. Autorizar apenas se consumo confirmado + reservas + custo máximo novo couberem no saldo individual e no pool global. Verificar também unidades e vagas na mesma transação.
4. Orçamento negativo, preço ausente/desatualizado, Firestore indisponível ou estado inconclusivo: negar nova execução paga, preservando o modo local.
5. Reconciliar o realizado com medição e referências do provedor. Não devolver verba apenas porque o usuário cancelou ou recebeu timeout: uma chamada já enviada pode ser faturada.
6. Em resposta perdida após chamada externa, estado `needs_reconciliation`; conservar a reserva e não repetir a chamada automaticamente. Se não houver confirmação confiável, liquidar conservadoramente pelo máximo reservado, sem nova cobrança ao usuário.
7. Conferência diária com billing export/relatório. Divergência positiva reduz o saldo global, nunca o aumenta automaticamente. Revisar preços antes de ativar e semanalmente; catálogo com mais de 7 dias bloqueia novas tarefas.

### Teto do aplicativo versus fatura

O aplicativo consegue impor um limite rígido de admissão de novas tarefas conhecidas. Não é honesto prometer uma fatura GCP universalmente limitada a US$ 100: há custos persistentes, atraso de medição, tráfego rejeitado e requisições em andamento. A documentação atual já oferece spend caps para Cloud Run, porém por serviço/projeto; Document AI, Translation, Storage e Firestore não constam da lista consultada.

- Alertas do projeto em US$ 50/70/85/95. Controle do aplicativo usa reservas em tempo real, não espera alertas do Billing.
- Bloquear tarefas quando o pool de US$ 60 estiver comprometido ou quando consumo operacional estimado ultrapassar US$ 15, o que ocorrer primeiro. Impedir também novo upload/preflight que possa gerar custo sem reserva.
- Spend cap adicional Cloud Run de US$ 20 no projeto dedicado, se elegível na conta; é proteção complementar, sem teto agregado garantido. Pausar fila e execução ao receber bloqueio, mantendo site e motores locais fora desse projeto.
- Worker com zero instâncias mínimas, máximo 2, concorrência de processamento 1 por instância; limites por transação continuam necessários. Não criar GPU, Cloud SQL ou VPC connector sempre ativo para o piloto.
- Interruptor administrativo para novas admissões, uploads, downloads e chamadas pagas; permitir apenas status, reconciliação e limpeza controlados. Custos remanescentes continuam registrados.
- Gate de ativação: aceitar explicitamente a diferença entre limite de admissão e fatura. Se US$ 100 for um teto contratual absoluto sem tolerância, manter nuvem desativada até existir solução de cobrança que assegure isso; margem não é garantia.

## 6. Fluxo e integridade distribuída

Fluxo: seleção local → escolha de modo → login se nuvem → orçamento preliminar sem conteúdo → reserva de inspeção/upload → confirmação explícita → upload → inspeção no servidor → orçamento definitivo → confirmação se houver mudança → reserva de execução → fila → processamento → resultado → liquidação → limpeza.

- A prévia inicial pode usar metadados locais, marcados como estimativa. O servidor determina tamanho, páginas e caracteres reais; não confia na contagem do cliente. Nenhuma chamada ao motor pago ocorre antes do orçamento definitivo autorizado.
- Documento imutável identificado por checksum e geração do objeto. Orçamento vinculado a UID, ferramenta, opções, idioma, hash/generation, competência, preços e consentimento. Alterar qualquer item invalida orçamento anterior.
- Transação com ID idempotente por solicitação/UID; repetição retorna o mesmo job. Reutilizar ID com outro arquivo/opções retorna conflito.
- Reserva e registro de despacho pendente gravados juntos; reconciliador reenvia somente despacho que ainda não começou. Nunca disparar Cloud Tasks dentro de callback transacional que possa repetir.
- Worker reivindica job com lease/fencing antes de executar. Entrega duplicada não gera segunda chamada paga. Vencimento de lease não autoriza repetir tarefa com chamada externa possivelmente em curso.
- `needs_reconciliation` conserva a vaga global/individual enquanto houver possibilidade de execução externa ativa. Após 10 minutos sem prova de término, colocar o motor em quarentena e impedir novas chamadas desse motor; não liberar a vaga pelo relógio. Reconciliador ou administrador só libera com evidência de término/cancelamento do provedor, ou término observado do subprocesso. A indisponibilidade temporária é preferível a exceder gasto/concorrência.
- Estados: `quoted`, `awaiting_upload`, `awaiting_confirmation`, `reserved`, `queued`, `running`, `succeeded`, `failed`, `cancel_requested`, `needs_reconciliation`, `settled`, `expired`. Terminal/settled não é reaberto por mensagem atrasada.
- Expirar reserva só é seguro antes de qualquer chamada externa e sem worker ativo. Quando houver dúvida, manter débito máximo até reconciliação.
- Um resultado somente pode ser lido por seu participante; URL curta privada, acesso contabilizado no servidor, sem e-mail/caminho privado no nome do objeto. Nenhum cache de documentos compartilhado entre participantes.
- Caminho dos dados: upload binário autenticado pela API (`PUT /api/v1/cloud/quotes/{id}/input`), limitado durante a leitura, com reserva anterior e tamanho máximo antes de gravar; downloads também passam pelo servidor, com reserva atômica de número/bytes, autenticação e limites de conexões/Range. Não entregar URL assinada reutilizável de Storage que contorne os contadores. Conexão interrompida mantém bytes reservados até reconciliação; toda transferência entra no custo de compute/tráfego.
- Não deixar endpoints antigos de OCR, tradução ou `/invoke` executarem o mesmo trabalho sem identidade/reserva. Credenciais de sessão documental não substituem identidade de nuvem.

## 7. Privacidade, retenção e motores

- Tela de confirmação informa provedor e local de processamento, inclusive saída do Brasil. Document AI `us` é a opção proposta; ativação depende da aprovação dessa localização. Não afirmar residência no Brasil por usar Cloud Run em São Paulo.
- Entrada apagada no encerramento do job; resultado expira em 1 hora. Remoção ativa e reconciliador a cada 15 min; regra de lifecycle de 1 dia apenas como proteção adicional, sem prometer exclusão física instantânea. Desabilitar versionamento e soft delete de conteúdo temporário, após verificar impacto/custo.
- Esses prazos se referem ao armazenamento controlado pelo NexoHub. No piloto, Document AI usa processamento online/síncrono e Translation usa texto NMT: as documentações descrevem processamento do conteúdo em memória, com possíveis metadados operacionais. Não ativar batch ou glossários persistentes sem revisar retenção/custos/consentimento. Document AI batch tem retenção de contingência de até um dia, distinta da política do bucket NexoHub. O consentimento deve explicar ambas as camadas; não prometer apagar os registros internos do provedor.
- Auditoria por 90 dias somente com UID pseudonimizado, unidades, versão de preço, estado e débito. Sem nomes de arquivo, conteúdo, tokens ou texto de tradução. Exclusão de conta não concede nova franquia no mês; política de retenção mínima será aprovada e divulgada.
- Aplicar limites de armazenamento, processamento e downloads também a erros, cancelamentos e uploads abandonados. Tratar resíduos órfãos.
- Google OCR: comparar corpus sintético e fotografias autorizadas; não enviar a fotografia privada existente sem autorização específica para transmissão.
- Cloud Translation NMT: somente texto, contagem Unicode compatível com o provedor; termos/nomes preservados devem ter testes e revisão humana, sem presumir garantia pelo provedor.
- Saídas do adapter: OCR normaliza texto, páginas, confiança e caixas para o contrato atual e reutiliza a montagem local de PDF pesquisável quando solicitada, sem alterar o original. Não publicar JSON bruto do Document AI como se fosse PDF. Tradução retorna `text/plain`; Office retorna novo artifact `application/pdf`. Resultados usam o mesmo salvamento/validação das ferramentas atuais, sem nova árvore remota de projetos.
- LibreOffice: versão fixa, fontes licenciadas, macros/referências externas desativadas, processo com limites de tempo/memória/saída e isolamento de credenciais/rede demonstrado. Se isso não for demonstrado no Cloud Run escolhido, conversão permanece desativada e o plano é revisto antes de contratar outra infraestrutura.

## 8. Interface proposta

No executor e na tela dedicada, não em uma ferramenta duplicada:

- `Neste dispositivo — gratuito`: padrão, não pede login, não envia arquivo.
- `Na nuvem — usa sua franquia gratuita`: somente quando motor homologado estiver disponível; login se necessário.
- Antes de transmitir: nome da operação, provedor/região, arquivo e unidades estimadas, saldo disponível e máximo reservado, próxima renovação e prazo do resultado.
- Exemplo: `OCR na nuvem: até 12 páginas. Disponíveis: 38 páginas. Após o processamento: até 26 páginas. O arquivo será enviado ao Google para processamento nos Estados Unidos. O uso está sujeito ao saldo conjunto disponível.`
- Mostrar separadamente `Disponível`, `Reservado` e `Utilizado`. Saldo financeiro interno não é pagamento. Aviso visível quando a reserva financeira limitar a franquia nominal.
- Botão `Enviar e processar na nuvem`; antes dele, consentimento para aquela geração do arquivo. Sem ação implícita ao abrir a tela ou ao esgotar capacidade local.
- Ao acabar cota ou orçamento global, explicar motivo e manter opção local. Não substituir silenciosamente o motor escolhido. Tradução/OCR indisponíveis não devem produzir saída vazia como sucesso.
- pt-BR pelo catálogo de i18n; acessibilidade por teclado e leitura de saldo, larguras de 390/768/1440 px, web e Windows.

## 9. Critérios de aceite e liberação

- Local funciona sem rede e sem conta em ambos os clientes; não passa pela disponibilidade do serviço de nuvem.
- 300 participantes, duas instâncias de servidor, requisições concorrentes e virada mensal sem saldo negativo, duplicação de chamada paga ou cota por dispositivo.
- Toda rota paga exige identidade/admissão válida e reserva; cobrança desconhecida não é reembolsada automaticamente.
- Simular pool quase esgotado, mensagens duplicadas, reinício, falha de Firestore, cancelamento durante API paga, preço antigo, troca de arquivo após orçamento e exclusão/recriação de conta.
- Demonstrar visualmente confirmação, saldo e retenção. Conferir exportado contra referência, não apenas resposta HTTP 200.
- Liberação gradual: emuladores e provedores falsos → piloto sintético pago com suborçamento US$ 5 dentro do pool → 10 → 50 → 300 participantes. Esses números são etapas, não novas franquias financeiras.
- Ativação só após revisão de qualidade/custos/IAM/retorno Windows e aceitação da localização e do limite de fatura. Provisionamento, dados externos, deploy e release exigem autorização específica.

## 10. Fontes verificadas em 30/10/2026

- [Identity Platform — preços e franquia de provedores Tier 1](https://cloud.google.com/identity-platform/pricing): Google/e-mail para 300 MAU cabem na primeira faixa, sem incluir SMS/serviços auxiliares.
- [Firebase — verificação de tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens).
- [Firestore — transações](https://firebase.google.com/docs/firestore/manage-data/transactions).
- [Cloud Tasks — limitações e entregas repetidas](https://docs.cloud.google.com/tasks/docs/common-pitfalls).
- [Cloud Billing — spend caps e limitações](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps): inclui Cloud Run; não oferece teto universal multissserviço nem cancela custos já em andamento.
- [Document AI — regiões](https://docs.cloud.google.com/document-ai/docs/regions) e [limites](https://docs.cloud.google.com/document-ai/limits).
- [Document AI — segurança e retenção](https://docs.cloud.google.com/document-ai/docs/security), [Translation — uso e retenção dos dados](https://docs.cloud.google.com/translate/data-usage).
- [Document AI — preços](https://cloud.google.com/products/document-ai/pricing), [Translation — preços](https://cloud.google.com/products/translate/pricing), [Cloud Run — preços](https://cloud.google.com/run/pricing).

## 11. Aprovação e gates de ativação

O plano com piloto fechado por convite, identidade de nuvem, Firestore/Storage/Tasks, projeto dedicado, saldo conjunto US$ 0,20 por participante, distribuição 60/15/25, processamento OCR nos EUA e retenção descrita foi aprovado para iniciar implementação local em 30/10/2026. Google e e-mail confirmado foram escolhidos expressamente. Nenhuma aprovação é tratada como prova de execução; provisionamento remoto, testes pagos, envio de documentos e publicação permanecem separados.
