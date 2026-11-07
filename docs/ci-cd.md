# CI/CD e entrega

## Fluxo

- Cada PR executa `.github/workflows/ci.yml`: instalação com lockfile congelado, Biome sem escrita, migração em PostgreSQL 17 descartável, testes de domínio/adaptador/persistência, tipos, build e Playwright Chromium. Não usa credenciais de produção.
- O CD executa a mesma CI antes de publicar. Push em `master` publica o frontend no stage `homologation`; tag estrita `vMAJOR.MINOR.PATCH` publica `production`. O commit da tag precisa pertencer ao histórico de `master`. `workflow_dispatch` permite repetir a entrega da branch principal ou de uma tag válida.
- Deploys do mesmo ambiente são serializados. Falhas anteriores bloqueiam o deploy. Relatórios, traces, capturas de tela e builds ficam nos artefatos da execução por sete dias.
- PRs encadeados devem entrar pela ordem de dependência. Após integrar um PR, altere a base do próximo para `master` e confira o diff antes de integrar.

## Configuração do GitHub

Crie os environments `homologation` e `production` em Settings → Environments. Em cada um, configure:

| Tipo            | Nome                    | Conteúdo                                                                               |
| --------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| Variable        | `VITE_SERVER_URL`       | URL HTTPS pública da API Node.js daquele ambiente                                      |
| Variable        | `CLOUDFLARE_ACCOUNT_ID` | Identificador da conta Cloudflare                                                      |
| Secret          | `CLOUDFLARE_API_TOKEN`  | Token com permissões para os recursos Workers e o estado gerenciado pelo stack Alchemy |
| Secret opcional | `ALCHEMY_PASSWORD`      | Senha de criptografia, caso o estado existente a utilize; preserve a mesma senha       |

Use as permissões documentadas no [guia oficial de CI do Alchemy](https://alchemy.run/environments/ci/) para o stack Cloudflare. O Alchemy v2 resolve credenciais diretamente do ambiente em CI; não depende de um perfil pessoal no runner. A pipeline usa a versão Alchemy fixada no projeto e os stages explícitos, evitando stages pessoais.

Configure proteção de `master` para exigir o check de qualidade e revisão. Se quiser aprovação manual para produção, configure required reviewers no environment `production`. As regras da conta podem restringir esses recursos. A pipeline versionada não cria essas políticas nem credenciais automaticamente.

O primeiro deploy só funciona depois de cadastrar as variáveis/credenciais e disponibilizar a API. Nenhum segredo é necessário para executar a CI de PRs.

## Escopo da publicação

O stack existente em `packages/infra/alchemy.run.ts` publica somente o frontend Vite no Cloudflare. A API Hono é um processo Node.js externo e o PostgreSQL é externo. Configure a API com `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `PORT` e, quando necessário, `ADMIN_USER_IDS`. `CORS_ORIGIN` deve corresponder à URL do frontend do ambiente. A pipeline gera artefatos dos builds da API e web; ela não provisiona hospedagem da API.

Migrações remotas não são executadas pelo CD. A migração inicial pressupõe banco novo; um banco que já recebeu `db:push` precisa de baseline revisada. Para um banco novo autorizado, execute com a URL apropriada:

```sh
pnpm --filter @esports-simulator/db run db:migrate
```

Os testes locais e a CI aplicam essa migração apenas em `worlds_mvp`, isolado, e verificam também a reaplicação sem novas alterações.

## Release e recuperação

Depois de integrar os PRs e validar homologação, marque o commit de `master` aprovado:

```sh
git tag v0.1.0 <commit-aprovado>
git push origin v0.1.0
```

Para recuperar uma versão de frontend, execute novamente o CD de uma tag válida anterior pelo Actions. Preserve as tags já publicadas. Se a API ou o schema mudar, confirme a compatibilidade antes de recuperar uma versão. O rollback do frontend não remove tabelas nem reverte migrações.

## Comandos locais

```sh
pnpm install --frozen-lockfile
pnpm run ci
pnpm test
pnpm run check-types
pnpm run build
```

Para persistência e navegador, siga o PostgreSQL temporário em [mvp.md](mvp.md). `pnpm run check` verifica sem alterar arquivos; `pnpm run check:fix` aplica correções seguras. Os avisos atuais de especificidade CSS permanecem visíveis e não bloqueiam o check.
