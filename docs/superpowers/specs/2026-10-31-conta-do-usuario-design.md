# Conta do usuário — proposta de desenho

**Estado:** proposta para revisão do usuário em 31/10/2026; nada implementado. Base: `02c5322` (Windows 0.2.4, web publicada na revisão `nexohub-hub-00022-8bs`).
**Origem:** pedido de uma conta "como a do iLovePDF, adaptada ao site", depois de entrar com Google e ver somente e-mail e **Sair**.
**Referência:** organização espacial das capturas fornecidas (menu do avatar e página de perfil com menu lateral). Não copiar marca, ícones nem prometer funcionalidades do concorrente.
**Método:** sem protótipo separado. A fase 1 foi implementada direto no cliente, com componentes e tokens reais; as capturas de tela vêm da própria página.
**Estado da implementação:** fase 1 implementada no cliente (local, não publicada). Fases 2 e 3 não iniciadas.

## 1. Fronteiras herdadas (não reabertas aqui)

- **ADR-020 e `PRODUCT.md`:** conta opcional; uso local gratuito e sem login; acesso à nuvem só por convite, até 300 participantes; sem pagamentos, sem sincronização de documentos.
- **`PRODUCT.md`, "Conta de usuário":** a conta identifica a pessoa por e-mail, oferece **Sair**, não depende de saldo ou motores, e **não expõe arquitetura nem estado de implantação**. **Informações de consumo pertencem à operação documental, não à apresentação da conta.**
- **`PRODUCT.md`, escopo:** cobrança, contas obrigatórias e telemetria invasiva estão fora; módulo pago é só "direção em avaliação", sem autorização.
- **`AGENTS.md`:** a UI não acessa Firestore, SDK nem sistema nativo; tudo passa por Port. Textos novos entram no catálogo `pt-BR`, não nos componentes.

## 2. O que adotar do iLovePDF

| Do iLovePDF | Decisão | Motivo |
|---|---|---|
| Avatar no cabeçalho abrindo menu (identidade, "Configurações de conta", "Sair") | **Adotar** | Já existe o botão de conta; vira menu com 2 itens |
| Página de conta com menu lateral (Perfil, Segurança) | **Adotar**, em 3 seções | Perfil, Segurança, Privacidade e dados |
| "Links para redes sociais" (Google/Facebook conectados) | **Adaptar:** "Formas de entrar", somente leitura | Só Google e e-mail existem; ADR-020 |
| Equipes, Assinaturas, Fluxos, Planos & Pacotes, "Atualize para Premium", Faturamento | **Excluir** | Fora de escopo; o botão Premium contraria "100% gratuito" |
| Saldo/uso dentro da conta | **Excluir da conta**; fica na operação | `PRODUCT.md` (§1); plano do Codex, tarefa 7 |
| Nome, foto, país, fuso | **Não coletar** (decisão aberta D1) | Minimização; Windows não tem SDK de perfil |
| Preferências (idioma de OCR, compressão) | **Fora da conta**; configuração local, sem login | Preferência local não deve exigir conta |

## 3. Arquitetura da informação

1. **Botão de conta (cabeçalho)**, já existente. Sem sessão: painel de entrada atual. Com sessão: menu com identidade, **Minha conta** e **Sair**.
2. **Rota `/conta`** (novo ramo em `main.tsx`, ao lado de `/cloud/login`, via `withAppBase`), página própria como a de login.
3. **Fase 1: página única** com cartões empilhados (Dados da conta, Formas de entrar, Sessão, Privacidade). Menu lateral e abas só entram quando as fases 2 e 3 trouxerem conteúdo que justifique dividir em seções.

Sem sessão, `/conta` mostra o mesmo painel de **Entrar na sua conta**, nunca uma tela de erro.

## 4. Conteúdo por seção

### Perfil (fase 1, só dados que já existem)
- **E-mail** e selo **Confirmado** (`CloudParticipant.email`, `emailVerified`).
- **Identificador do participante**, com **Copiar** (`participantId`), útil para suporte e convite. Opcional (D5).
- **Formas de entrar:** só texto informando que Google e link por e-mail levam à mesma conta. **Não mostra quais métodos estão conectados:** o servidor não devolve essa informação (`/me` traz só `participantId`, `email`, `admitted`, `emailVerified`). Exibir o estado por método exigiria endpoint novo.
- Aviso permanente: usar o NexoHub continua gratuito e sem conta; entrar não envia arquivos.
- **Privacidade (texto, sem retenção prometida):** e-mail, identificador e contadores de uso do piloto. O prazo de 90 dias de auditoria é item do plano, ainda não implementado, e por isso não aparece na interface.

### Segurança (fase 2)
- **Sair deste dispositivo:** já existe (`signOut`).
- **Sair de todos os dispositivos:** novo; usa a revogação `validSince`/`revokedBefore`, que o servidor já aplica na verificação do token.

### Privacidade e dados (fase 3)
- **O que guardamos:** e-mail, identificador, contadores mensais de uso, auditoria sem conteúdo por 90 dias (ADR-020 e plano). Frase fixa: arquivos não são enviados nem guardados ao usar a conta.
- **Baixar meus dados** e **Excluir minha conta**. Ver §7 e decisão D2.

## 5. Estados (a conta nunca depende de saldo ou de motores)

| Estado | Origem | Comportamento |
|---|---|---|
| Carregando | `status()` e `me()` em andamento | Texto de status, sem salto de layout |
| Sem sessão | sem token | Painel de entrada |
| **Sem convite** | `me()` → 403 `PARTICIPANT_NOT_ADMITTED` | **Implementado:** nome do estado + "o uso local continua disponível". Só **Sair** |
| E-mail não confirmado | 403 `EMAIL_UNVERIFIED` | Pede a confirmação pelo link recebido |
| Sessão expirada/revogada | 401 `AUTH_REQUIRED` | Volta ao painel de entrada, sem mensagem técnica |
| Serviço indisponível | 503 `CLOUD_DISABLED` ou rede | "Não foi possível acessar sua conta. Tente em instantes." Uso local intacto |
| Conta suspensa | `Disabled` mapeado como `PARTICIPANT_NOT_ADMITTED` | Mesmo tratamento de "Sem convite" |

## 6. Dados, Port e API

- **Existente e suficiente para a fase 1:** `GET /cloud/me` → `participantId`, `email`, `admitted`, `emailVerified`; `signOut()` local.
- **Port:** estender `CloudAccountPort` (`apps/client/src/platform/cloud-account.ts`), que já serve web e Windows. Nenhum componente chama SDK, Firestore ou `fetch` diretamente.
  - Fase 2: `signOutEverywhere()` ↔ `POST /cloud/sessions/revoke`.
  - Fase 3: `exportData()` ↔ `GET /cloud/me/export`; `deleteAccount()` ↔ `DELETE /cloud/me`.
- **Novos endpoints exigem:** autenticação do mesmo verificador, resposta com `Cache-Control: no-store`, erro com código estruturado, auditoria sem conteúdo, e teste de que o participante A não alcança dados do B. Reentrada recente (`auth_time` até 5 min) para excluir e revogar tudo.
- **Windows:** a página roda no mesmo cliente, no webview, sem ramificação por sistema. A sessão continua protegida por DPAPI.

## 7. Privacidade e LGPD — pontos para decisão (não é parecer jurídico)

- **Acesso e portabilidade** (art. 18, II e V) justificam **Baixar meus dados**.
- **Eliminação** (art. 18, VI) justifica **Excluir minha conta**, ressalvadas as hipóteses de conservação do art. 16.
- **Tensão com o plano do Codex:** a tarefa 2 exige que "conta excluída e recriada" **não ganhe nova franquia**. Isso obriga a reter um marcador mínimo depois da exclusão. Essa retenção precisa de finalidade e base legal definidas (por exemplo, legítimo interesse na prevenção de abuso, art. 7º, IX, com avaliação de proporcionalidade) e de texto claro ao titular. **Decisão e revisão jurídica do mantenedor** (D2).
- O TTL do Firestore é assíncrono (PRIVACY.md): o texto da exclusão não pode prometer remoção instantânea.

## 8. Interface, acessibilidade e i18n

- Tokens do Design System, sem hexadecimais novos nos componentes. Acento do modo ativo (`data-zone`); estados semânticos (confirmado, aviso, perigo) como tokens.
- Foco visível de 3px; contraste 4,5:1; seleção ativa não só por cor; Escape fecha o menu e devolve o foco ao botão; teclado completo no menu lateral e nas abas.
- Movimento reduzido respeitado. Sem animação contínua.
- Botão de conta: segue o ajuste de `c8cf269` (rótulo oculto até 1499px, `aria-label` mantido). Nenhuma regressão nas larguras 1100 e 1400 do e2e de cabeçalho.
- **i18n:** namespace novo `account.page.*`; **não reutilizar** as ~29 chaves órfãs (`account.menu.*`, `account.panel.*`, `account.metrics.*`, `account.profile.*`, `account.delete.*`): nenhum componente as usa e descrevem um painel diferente. Remoção em PR separado.
  - Chaves da fase 1: `account.page.title` "Minha conta", `account.page.section.profile` "Perfil", `.security` "Segurança", `.privacy` "Privacidade e dados", `account.page.email` "E-mail", `account.page.emailConfirmed` "Confirmado", `account.page.participantId` "Identificador do participante", `account.page.copy` "Copiar", `account.page.methods.title` "Formas de entrar", `account.page.methods.lead` "Google e link por e-mail levam à mesma conta, na web e no Windows.", `account.page.localNote` "Usar o NexoHub continua gratuito e sem conta. Entrar não envia seus arquivos.", `account.page.notAdmitted` "Sua conta ainda não foi liberada para os recursos em nuvem. O uso local continua disponível, sem conta."

## 9. Correções que o desenho pressupõe (achados de leitura do código; nada alterado)

1. `account.welcome` diz "Entre ou **crie** sua conta", mas o acesso é por convite (`admission.rs`). Trocar por texto que não sugira cadastro aberto. A confirmar com o usuário (D3).
2. **Confirmado e corrigido na fase 1:** o port colapsava todo 403 em `AUTH_UNAVAILABLE`, então a interface não distinguia "sem convite" de "serviço fora do ar". Agora só o código estruturado conhecido do 403 (`PARTICIPANT_NOT_ADMITTED`, `EMAIL_UNVERIFIED`) chega à interface; mensagem e corpo do servidor nunca são repassados. O comportamento com sessão do SDK aberta após o 403 não foi verificado em execução.
3. O mesmo componente exibe saldo quando `processingEnabled`, contra o `PRODUCT.md`. Mover para a mesa da operação (tarefa 7 do plano) ao ligar os motores; enquanto `cloudEnabled=false` não aparece.
4. Chaves de i18n órfãs, acima.

## 10. Fases e ordem de execução

Cada fase tem seu próprio plano e termina verde antes da seguinte.

1. **Fase 1 — Menu e página de conta. IMPLEMENTADA localmente.** Sem backend novo: `/conta`, link **Abrir minha conta** no menu, estados da §5 e correção do item 2 da §9. O item 1 (texto "crie sua conta") aguarda a decisão D3.
1b. **Fase 1b — Nome e foto do Google.** Ver §13. Só cliente e núcleo nativo; nenhum endpoint novo.
2. **Fase 2 — Segurança.** Endpoint de revogação total e teste de isolamento.
3. **Fase 3 — Privacidade e dados.** Exportação e exclusão, **depois** da decisão D2.

Relação com o plano do Codex (`2026-10-30-nuvem-hibrida-300.md`): esta conta **não substitui** as tarefas 4 a 9 e não as bloqueia. A fase 1 não toca em cotas, upload nem motores.

## 11. Testes

- Vitest: cada estado da §5 no menu e em `/conta`; chaves de i18n sem texto fixo; `CloudAccountPort` falso para os cenários de erro.
- E2E de navegador: `/conta` em 390, 768 e 1440px, sem rolagem horizontal; teclado completo; sessão ausente e sem convite; regressão do cabeçalho em 1100 e 1400px.
- Rust (fases 2 e 3): isolamento entre participantes, reentrada recente, cabeçalhos de cache, auditoria sem conteúdo, exclusão sem nova franquia.
- Sem login real em teste; tokens sintéticos como já feito.
- **Fase 1, executado:** Vitest (page, control, port) e e2e de `/conta` em 390, 768 e 1440px com a resposta do serviço simulada no navegador, para não depender da produção.

## 12. Decisões abertas

- **D1 — Nome e foto do Google.** **Decidido em 31/10/2026: sim, sem retenção no servidor** (§13).
- **D2 — Exclusão e franquia.** Reter marcador mínimo e declarar base legal, ou aceitar que recriar a conta reinicia a franquia? Define a fase 3.
- **D3 — Texto de entrada.** **Decidido em 31/10/2026:** texto neutro, sem "crie" (§13).
- **D4 — Saldo na conta.** Recomendação: **estrito** (só na operação), como o `PRODUCT.md`.
- **D5 — Identificador do participante visível.** Recomendação: sim, com Copiar, por facilitar suporte.
- **D6 — Rota.** `/conta` com sub-caminhos, ou parâmetro de seção.

Aprovado este desenho, o próximo passo é o plano de implementação da fase 1, em `docs/superpowers/plans/`, antes de qualquer código.

## 13. Decisões de 31/10/2026 e fase 1b

**Acesso por convite mantido.** O Firebase cria a identidade de qualquer conta Google, mas o participante do NexoHub só existe se o e-mail tiver convite (`admission.rs`: convite indexado por hash do e-mail, validade de 7 dias, teto de 300). A conta, portanto, **não** é criada automaticamente. Motivo da manutenção: a conta não prova pessoa única e há orçamento fixo para os motores pagos.

**Texto de entrada (D3).** `account.welcome` passa a "Entre com sua conta Google ou com um link enviado ao seu e-mail." O link por e-mail continua existindo, então um texto só sobre Google seria impreciso, e a palavra "crie" sugeria cadastro aberto.

**Nome e foto do Google (D1), com retenção zero no servidor.**
- Nenhum endpoint novo e nenhum dado novo no servidor. O servidor nunca recebe nem guarda nome ou foto.
- **Web:** o adaptador do navegador lê `displayName` e `photoURL` do usuário do SDK, em memória.
- **Windows (opção B):** o núcleo nativo lê as claims `name` e `picture` do token que já está no cofre protegido (DPAPI). Se `picture` for `https`, sem credenciais nem porta, e o host for `lhN.googleusercontent.com`, baixa a imagem (limite de 256 KiB, tipos JPEG, PNG e WebP, sem redirecionamento, tempo limite de 10 s) e entrega ao cliente como `data:`. A política de conteúdo do aplicativo não é afrouxada. Falha em qualquer etapa cai na inicial do nome ou do e-mail.
- O cliente só renderiza `https:` ou `data:image/(jpeg|png|webp);base64`, com `referrerpolicy="no-referrer"`.
- Aparece no painel e na página de conta. No botão do cabeçalho só depois da primeira abertura do painel, porque o cliente não consulta a conta ao abrir o aplicativo (regra de modo local sem rede).
- Texto de privacidade: nome e foto aparecem só neste aparelho e não são guardados pelo NexoHub. Baixar a foto contata o Google, que já é o provedor de identidade.

**Retenção após exclusão (D2), proposta aguardando revisão jurídica.** Como a franquia é mensal, o marcador que impede a recriação de conta com franquia nova só precisa existir **até a virada do mês** (mais reservas inconclusivas). Depois disso, apagar tudo. Base legal e prazo exato são decisão do mantenedor; isto não é parecer jurídico.
