# Q-C0 — proteger e desbloquear PDF

Fatia local sobre `75782aa`, após commit autorizado de conversão/extração raster. Acrescenta
evidência aos dois executores existentes, sem alterar aplicativo, interface, dependências
ou arquitetura. DOC-C2 permanece excluído.

## Corpus e expectativas

Grupo `pdf-access` no [índice](q-c0.json): origem/licença e SHA-256 dos geradores, leitor
de testes e testes referenciados. Dados sintéticos autorais MPL-2.0. As fixtures fixas de
desbloqueio estão no grupo `unlock`, com hashes e origem já registrados. Nenhuma ferramenta
Python foi instalada ou usada para regenerá-las nesta fatia. Hash de gerador não é hash
de cada PDF produzido ou de sua saída cifrada.

O gerador reaproveita o DOC-C4, com quatro páginas textuais, CropBox e rotações 0/90/180/270.
Inclui campo compartilhado entre as páginas 1/3, outro na página 2, rádio com opção B,
checkbox marcado, título/autor/data de criação fixos e `controle.txt`, com bytes UTF-8 conhecidos.
Senhas de usuário/titular são fictícias, com espaços e acentos, definidas na fixture.

| Caminho | Resultado exigido |
| --- | --- |
| Proteger AES-256/RC4 | Requer senha exata; usuário e titular leem o mesmo conteúdo; senha sem os espaços é recusada |
| Permissões | Flags de impressão, impressão de alta qualidade, cópia, modificação e montagem ausentes quando negadas; preenchimento de formulário mantido quando permitido |
| Desbloquear | Título/autor/data, texto, caixas/rotação, valores/widgets e bytes de anexos iguais ao documento cifrado lido com senha válida; sem Encrypt após a saída |
| Formulário | Campo compartilhado conserva dois widgets, rádio B e checkbox; campo continua editável e sobrevive a nova gravação |
| Restrições sem senha de abertura | Saída livre mantém o snapshot do conteúdo/anexo |
| ByteRange | Regravação recusada, com aviso e sem download |

As nove variantes fixas cobrem RC4 40/128, AES-128, AES-256 revisão 5/6, object streams,
atualização incremental, metadados em claro e PDF 2.0. Não significa suporte a todo handler
de segurança ou filtro possível. Os testes existentes mantêm guardas de entrada vazia,
senha incorreta, RC4 fora do conjunto de caracteres e preservação estrutural adicional.

## Método de conferência

PDF.js lê o documento antes/depois, inclusive enquanto cifrado com credencial válida.
O leitor de testes usa os `Map`s de campos/anexos da versão instalada e a API de conteúdo
de anexos sob demanda; não trata ausência de propriedades de um objeto comum como corpus vazio.
Objetos lógicos dos campos e widgets geométricos são mantidos no snapshot; a contagem dos
dois widgets compartilhados usa as entradas com retângulo. Valores e presença de anexos
recebem controles explícitos para impedir uma comparação vazia.

No corpus rico, texto, título/autor, caixas/rotações, nomes de campos e bytes do anexo são
confrontados também com referências explícitas. pdf-lib verifica a ausência de Encrypt,
os valores, os dois widgets e a editabilidade do formulário após desbloquear.
Um controle negativo altera campo e anexo sem mudar o texto das páginas; o snapshot deve
identificar ambas as diferenças. Os buffers de entrada são comparados antes/depois.

PDF.js é um leitor independente da biblioteca que cifra, mas também é a base do desbloqueador.
A comparação não constitui uma segunda implementação independente de decriptação; a leitura
com pdf-lib e as referências do corpus acrescentam controles estruturais e de conteúdo.

Os quatro E2E usam telas e downloads reais: proteger/desbloquear em AES-256 e RC4, senha
incorreta seguida de correta, restrições sem senha de abertura e recusa de ByteRange.
O spec integra o executor normal de `/hub/`.

## Limites

Perfil restrito; não é auditoria criptográfica independente nem prova de imposição de
permissões por todos os leitores. Permissões são flags do PDF e não um bloqueio inviolável.
Não certifica todo PDF, assinatura digital, pintura pixel a pixel, fonte arbitrária, lote grande,
pouca RAM ou aplicativo Windows instalado. Metadados Info comparados são título, autor e data
de criação; outros metadados/links/marcadores continuam sob os controles anteriores indicados,
sem certificação universal. Q-C0 global permanece parcial.

## Validação

- `pnpm check`: formatter/lint e typecheck aprovados.
- `pdf-access-quality`, `pdf-security` e `pdf-unlock`: 50 testes aprovados, incluindo 12 novos.
- Suíte completa do Tool Registry: 10 testes aprovados, incluindo índice ativo e hashes.
- Builds web da raiz e de `/hub/`: aprovados.
- E2E de acesso: quatro cenários aprovados na raiz e quatro em `/hub/`, com downloads reais.
- Revisão independente, somente leitura: sem achados materiais; hashes conferidos.

Não foram repetidas as suítes completas do cliente/E2E nesta fatia de evidências, sem mudança
de produção. Os resultados amplos da entrega anterior permanecem em [PDF-RASTER.md](PDF-RASTER.md),
sem serem apresentados como nova execução. Sem homologação Windows instalada.
Commit local autorizado posteriormente pelo usuário, sem push, deploy ou integração no
checkout principal.
