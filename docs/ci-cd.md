# CI/CD e entrega

## Validação de PRs

`.github/workflows/ci.yml` instala as dependências com lockfile congelado e executa Biome, testes de domínio/adaptador, tipos e build. PostgreSQL temporário valida a compatibilidade do caminho Node.js existente. O Worker é compilado com Wrangler em dry-run e testado com D1 efêmero no Miniflare, sem credenciais de nuvem.

Playwright verifica o simulador tanto no servidor Node.js quanto no Worker com assets na mesma origem. Relatórios, traces, capturas e builds ficam nos artefatos da execução por sete dias.

## Publicação

O workflow `CD` executa a CI antes do deploy. Push em `master` publica `homologation`; tag estrita `vMAJOR.MINOR.PATCH` de um commit pertencente ao histórico de `master` publica `production`. Deploys do mesmo ambiente são serializados. `workflow_dispatch` permite repetir uma publicação válida.

A publicação cria ou atualiza um Worker que serve interface e API, e um banco D1 por stage. As migrações D1 versionadas são aplicadas pelo Alchemy antes de publicar o Worker. A configuração não depende de uma API externa, PostgreSQL remoto ou variável `VITE_SERVER_URL`.

Veja [configuração dos environments, deploy manual, migrações e recuperação](cloudflare.md). Proteção da branch e revisão obrigatória podem ser configuradas nas opções do GitHub; o workflow não modifica essas políticas.

## Release

Depois de integrar as alterações em `master` e validar homologação, marque o commit aprovado com uma tag ainda não publicada:

```sh
git tag v0.1.0 <commit-aprovado>
git push origin v0.1.0
```

Mantenha tags existentes. Antes de republicar uma revisão anterior, confirme que o código é compatível com o schema D1 atual. Recuperar código não reverte migrações.

## Gates de arquitetura para agentes

Os mesmos comandos são usados localmente e na etapa **Biome and architecture policy
checks** da CI. `pnpm run ci` executa Biome, `lint:architecture` e `test:architecture`;
`pnpm run lint`/`pnpm run check` também executam o gate de arquitetura. O restante
da CI continua verificando banco isolado, domínio, tipos, builds, Worker e browser.

| Regra                                                | Mecanismo                                                       | Comando                      |
| ---------------------------------------------------- | --------------------------------------------------------------- | ---------------------------- |
| Não introduzir useEffect                             | AST TypeScript e baseline de chamadas legadas                   | `pnpm run lint:architecture` |
| Frontend não importa banco                           | Biome noRestrictedImports em apps/web/src                       | `pnpm run lint`              |
| O gate rejeita código inválido e aceita alternativas | Fixtures positivas/negativas, escopo lexical, aliases e ratchet | `pnpm run test:architecture` |

### useEffect e legado

O projeto já possuía cinco chamadas em dois arquivos: worlds-simulator.tsx (quatro)
e simulacoes.americas.tsx (uma). `scripts/architecture-baseline.json` registra esses
locais por arquivo, hash AST normalizado e multiplicidade, incluindo a aquisição
do hook. Não é uma exceção para o arquivo inteiro: nova chamada, import diferente,
cópia em outro arquivo ou mudança no corpo de uma chamada legada falha. Remover
um efeito passa; não redistribua a cota para efeitos novos. A baseline deve diminuir
conforme a migração acontecer e nunca ser regenerada para fazer um PR passar.
Alterações nela exigem revisão humana junto do diff que as justifica.

O check cobre imports nomeados e aliases, namespaces/default React, propriedade
useEffect estática ou literal entre colchetes, aliases locais por declaração,
destructuring de require/import e reexports nomeados/wildcard. Não se trata de
análise completa de fluxo de JavaScript: acessos computados arbitrários, reflexão,
mutação de aliases e repasse por parâmetros exigem revisão; não são alternativas
autorizadas. O checker distingue nomes locais de imports React e não confunde
comentários ou strings com uso do hook. Biome sozinho, nesta versão, não bloqueou
React.useEffect nos probes; por isso o complemento usa o parser já instalado, sem
adicionar ESLint ou dependências.

Prefira estado derivado no render, ações em handlers, loaders/TanStack Query já
adotados e APIs de domínio. Não troque por useLayoutEffect para contornar a regra.
Comentários explicativos continuam sujeitos a no-comments/revisão: não há quota
automática de comentários nem remoção de licenças e diretivas necessárias.

### Resultado local e integração

Não altere `master`, produção, secrets ou regras remotas para passar checks. Para
o merge ser bloqueado no GitHub, configure como obrigatório o status **Quality,
integration and browser tests** na proteção/ruleset da branch. O workflow já publica
esse status; a configuração remota de proteção é separada e não é modificada aqui.
