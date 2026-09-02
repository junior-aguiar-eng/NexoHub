# Contribuindo

Abra uma discussão ou issue antes de mudanças arquiteturais ou novas engines. Alterações devem ser
pequenas, testadas e compatíveis com os ADRs vigentes.

Use Conventional Commits. Execute os gates documentados no `README.md` e inclua apenas fixtures
sintéticas ou com licença comprovada. Novas dependências exigem justificativa e registro em
`THIRD_PARTY_LICENSES.md`.

Propostas funcionais devem responder às dez perguntas de `docs/EVOLUTION.md`. Tools e engines
precisam declarar Artifact de entrada e saída, integração ao Document Graph, necessidade de rede,
limites, cancelamento, licença e superfície Quick/Studio. Não inclua binários de terceiros: atualize
o manifesto versionado e o processo verificável de obtenção.

Pull requests devem manter os três lockfiles, passar CI e não declarar plataforma ou capacidade
sem evidência. Mudanças arquiteturais exigem ADR; release, tag e publicação dependem de aprovação
separada.
