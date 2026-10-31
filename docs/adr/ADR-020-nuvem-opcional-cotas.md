# ADR-020 — Nuvem opcional, identidade e cotas

- **Estado:** aceito para implementação pelo usuário em 30/10/2026; ativação remota ainda condicionada aos gates do plano.
- **Base:** `44b4cd2`, Windows 0.2.4. Não modifica a release instalada nem aprova provisionamento ou publicação.

## Contexto

O uso local é gratuito e não exige conta. As sessões do servidor HTTP atual são efêmeras e vinculadas a projetos; não identificam participantes entre dispositivos e não podem controlar saldo mensal distribuído. O usuário aprovou uma modalidade híbrida para até 300 participantes e escolheu Google/e-mail confirmado para entrar na nuvem.

## Decisão

1. Preservar local-first (ADR-001): modo local padrão, sem login obrigatório e sem fallback automático que transmita arquivos. O usuário escolhe e confirma a nuvem por operação.
2. Reutilizar Tool Registry, executor compartilhado e Platform Ports. Não criar uma segunda lista de ferramentas ou permitir acesso de componentes a filesystem, identidade nativa, Firestore ou APIs pagas diretamente.
3. Propor identidade gerenciada, convites, Firestore transacional, fila durável e armazenamento temporário privado, em projeto de consumo separado. Implementar seguindo o [design aprovado](../superpowers/specs/2026-10-30-nuvem-hibrida-300-design.md) e o [plano](../superpowers/plans/2026-10-30-nuvem-hibrida-300.md).
4. Aplicar 300 participantes, cotas por ferramenta e saldo conjunto US$ 0,20 por participante/mês. Orçamento incremental em USD antes de créditos/impostos: US$ 60 para tarefas/inspeções, US$ 15 para operação e US$ 25 de margem. Valores inteiros em milionésimos de dólar.
5. Conferir identidade, unidades, custo máximo, concorrência e reserva no servidor antes de chamar motor pago. Estado incerto mantém reserva; falha de verificação recusa a execução paga. Exibir consumo previsto e saldo antes do envio.
6. Não prometer teto contratual universal de fatura GCP: o controle rígido é de admissão do aplicativo; custos residuais e cobertura limitada do provedor exigem margem e os gates financeiros previstos no design.
7. OCR em nuvem, tradução NMT e Office→PDF só ficam disponíveis após homologação de cada motor, licenças, identidade Windows/web e controles distribuídos. O ADR-016 permanece responsável pela qualidade do motor Office; este ADR aprova avaliar seu caminho optativo remoto, não declara conversões fiéis implementadas.

## Relação com ADR-015

Mantêm-se proteção contra caminhos arbitrários, minimização de dados, execução bloqueante fora do reator e limites do servidor. O caminho híbrido acrescentará identidade persistente e reservas; tokens de sessão documental nunca os substituem. Toda rota legada que possa contornar custos precisará passar pelo gate comum antes de ativar provedores. A introdução deste ADR não altera rotas de produção nesta etapa.

## Consequências e estado implementado

### Continuação: identidade real

O usuário autorizou configurar o projeto dedicado, homologar a mesma conta Google/link de
e-mail no Windows e na web e publicar somente após validação. Também autorizou em separado
vincular faturamento existente para identidade/infraestrutura, necessário ao TTL do Firestore.
`NEXOHUB_IDENTITY_ENABLED` controla apenas identidade no servidor; o cliente e o core nativo
usam a configuração pública compartilhada. O perfil de homologação usa revisão sem tráfego
de produção e origem fixa na compilação nativa. `cloudEnabled=false` permanece obrigatório
para motores documentais. Ver [registro de identidade real](../evidencias/hybrid/IDENTIDADE-REAL-2026-10-30.md).

O parágrafo abaixo descreve a etapa local anterior, não a configuração remota atual.

Em 30/10/2026: política e contratos, verificador Firebase RS256/revogação, adapter browser e ledger Firestore com CAS atômico implementados. Testes usam tokens sintéticos e emulador local, sem login Google real. `cloudEnabled=false` permanece obrigatório; login Windows por navegador/PKCE, proteção DPAPI, comando IAM e UI/rotas de conta foram preparados/testados, mantendo os gates fechados. Login/IAM reais, orçamentos/upload, workers e homologação continuam pendentes. A [evidência de identidade e reservas](../evidencias/hybrid/AUTH-RESERVAS-2026-10-30.md) distingue implementação de ativação.

Pendências anteriores permanecem: OCR da fotografia investigada, causa dos resets do tradutor, assinatura Authenticode e fidelidade de conversões complexas. Não impedem contratos/política, mas também não serão consideradas resolvidas por adicionar nuvem.
