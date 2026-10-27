# Pedido técnico de fontes — minuta não enviada

Destino proposto: issue pública em `languagetool-org/languagetool`.
Nenhuma issue foi criada e nenhum mantenedor recebeu mensagem.
Publicação exige autorização explícita do usuário. Não inclui fotos, documentos privados
ou caminhos locais.

## Título proposto

Identificar entradas e receitas dos dicionários do snapshot 20261027

## Corpo proposto

Estamos verificando os insumos e receitas de geração de dicionários no snapshot oficial
`LanguageTool-20261027-snapshot.zip`, versão `6.9-SNAPSHOT-20261027`, SHA-256
`d5aa893ca8a86506af6ab0eac81473e86f1b563bfb1fab6fc1d9622552bb9814`.
Os metadados identificam o commit `4cff70080064056e6ca239f8498368731eb90c6d`.

Precisamos localizar fontes editáveis, revisões e comandos usados nestes recursos:

- POS asturiano (`asturian-pos-dict:0.1`), irlandês (`languagetool-ga-dicts:0.02`),
  árabe, bretão e galego: léxicos/FST de entrada, revisões upstream, patches e receitas
  que geraram os `.dict`/`_synth.dict` distribuídos. Encontramos binários idênticos e
  receitas parciais, mas não todos os insumos e versões correspondentes.
- Hunspell italiano: recuperamos `.aff/.dic` e avisos de Italian Writing Aids 3.3.1
  em LibreOffice/dictionaries `a4473e06b56bfe35187e302754f6baaa8d75e54f`; seu README
  coincide com o distribuído. Quais entradas, alterações, frequências e comandos
  produziram `it_IT.dict`?
- Hunspell tagalo: a conversão `fe8a600cfeaf4be745186758a3beb60f94ad4130` introduziu
  o binário ainda distribuído, SHA-256
  `209f819adf1e1d5605108197310aadd4bdde08c156c2b820d14debd4ae38ce4e`.
  Recuperamos `.aff/.dic` no commit pai. São 14.298 palavras na fonte, enquanto a
  exportação FSA tem 13.357 entradas: 951 ausências e dez adições, sem normalizar
  caixa ou hífens. Qual receita e qual arquivo de frequências SpellOnIt foram usados?
- Receitas de spelling alemão/esperanto/galego: confirmar insumos adicionais,
  frequências e versões das ferramentas, quando não estiverem junto de `.dic/.aff`.

Podem indicar URLs e revisões imutáveis dos insumos completos e as receitas empregadas,
ou esclarecer quais dados gerados representam a forma mantida/editada pelo projeto?
Isso é uma consulta técnica de proveniência; não estamos afirmando uma violação de licença.
