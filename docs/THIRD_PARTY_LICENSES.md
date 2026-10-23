# Dependências de terceiros da interface

Dependências introduzidas na Fase 1 e licenças declaradas pelos respectivos pacotes instalados:

| Pacote | Licença | Finalidade |
| --- | --- | --- |
| `@base-ui/react` | MIT | Primitivos acessíveis |
| `class-variance-authority` | Apache-2.0 | Variantes tipadas de componentes |
| `clsx` | MIT | Composição condicional de classes |
| `fflate` 0.8.3 | MIT | Extração local e limitada do XML de DOCX, sem upload |
| `tailwind-merge` | MIT | Consolidação de classes utilitárias |
| `tailwindcss` e `@tailwindcss/vite` | MIT | Tokens e pipeline de estilos |
| `lucide-react` | ISC | Ícones de interface |
| `motion` | MIT | Movimento com redução de animação |
| Plus Jakarta Sans | OFL-1.1 | Tipografia local de interface |
| Playfair Display | OFL-1.1 | Tipografia local editorial |

As fontes são distribuídas no bundle por pacotes Fontsource; nenhuma fonte ou biblioteca é carregada
por CDN em tempo de execução.

A leitura de DOCX usa a implementação ZIP em JavaScript do `fflate`, sem dependências transitivas,
e o parser XML nativo do navegador. A versão é fixada no lockfile; a extração limita a entrada a
64 MiB e o XML principal a 16 MiB, inclusive quando o tamanho declarado no ZIP está incorreto.
