# Executar e publicar na Cloudflare

O frontend React e a API Hono são publicados no mesmo Worker. O banco é Cloudflare D1 (SQLite), acessado pelo binding `DB`. O navegador chama `/rpc` na mesma origem, sem URL de API externa ou configuração de CORS entre serviços. O estado da infraestrutura também fica na Cloudflare, gerenciado pelo Alchemy.

## Desenvolvimento local sem conta Cloudflare

Requisitos: Node.js 24 e PNPM na versão do `package.json`.

```sh
pnpm install --frozen-lockfile
cp apps/server/.dev.vars.example apps/server/.dev.vars
pnpm run build:cloudflare
pnpm run db:migrate:local
pnpm run dev:cloudflare
```

Abra http://localhost:3101. Wrangler emula Worker, assets e D1 na sua máquina. O identificador fictício no `wrangler.jsonc` é exclusivo desse fluxo local; o deploy remoto usa o Alchemy. Os dados locais ficam em `.wrangler`, ignorado pelo Git. Depois de alterar a interface, repita o build; mudanças na API são recarregadas pelo Wrangler.

O caminho Node.js/PostgreSQL continua disponível para desenvolvimento e compatibilidade. Suas instruções estão em [mvp.md](mvp.md).

## Primeiro deploy manual

Na raiz, instale as dependências. Em seguida:

```sh
cd packages/infra
pnpm exec alchemy profile edit --add Cloudflare
```

Conecte a conta pelo navegador. Cadastre `BETTER_AUTH_SECRET` em `packages/infra/.env`, arquivo ignorado pelo Git, com um valor aleatório de pelo menos 32 caracteres. Preserve esse valor nos próximos deploys do mesmo ambiente. Para gerar um valor localmente:

```sh
openssl rand -hex 32
```

Publique homologação:

```sh
pnpm run deploy --stage homologation
```

Esse script compila a interface para usar a mesma origem. O Alchemy cria o D1, aplica as migrações versionadas e publica o Worker com o binding do banco e o segredo de autenticação. A saída contém a URL pública do aplicativo e o nome do banco. Não é necessário cadastrar `VITE_SERVER_URL`.

Depois, verifique a página inicial, `/health` e um palpite seguido de recarregamento. Para produção, use `--stage production` com as configurações próprias desse ambiente. Cada stage tem seu próprio Worker e banco D1.

## Deploy pelo GitHub Actions

Crie os environments `homologation` e `production`. Em cada um, configure:

| Tipo            | Nome                    | Uso                                                   |
| --------------- | ----------------------- | ----------------------------------------------------- |
| Variable        | `CLOUDFLARE_ACCOUNT_ID` | Conta onde os recursos serão criados                  |
| Secret          | `CLOUDFLARE_API_TOKEN`  | Token para Workers, D1 e recursos do estado Alchemy   |
| Secret          | `BETTER_AUTH_SECRET`    | Segredo estável de autenticação do ambiente           |
| Secret opcional | `ALCHEMY_PASSWORD`      | Quando o estado existente usar criptografia com senha |

O valor do segredo de autenticação precisa corresponder ao usado no deploy manual do mesmo stage. Use tokens restritos à conta e às permissões exigidas pelo stack, conforme o [guia oficial do Alchemy](https://alchemy.run/environments/ci/). Não é necessário conceder criação de tokens ao token de deploy; a pipeline não cria credenciais.

Push em `master` publica homologação após os checks. Tags `vMAJOR.MINOR.PATCH` de commits pertencentes ao histórico de `master` publicam produção. O workflow `CD` também permite repetir o deploy da branch principal ou de uma tag válida. As credenciais são usadas apenas no job de deploy; os testes de PR usam dados locais descartáveis.

## Atualização automática de resultados

O Worker exporta `scheduled()` e o Alchemy configura o cron `*/5 * * * *`. A cada cinco minutos, o coletor importa e valida o Worlds antes de publicar uma versão diferente no D1. Dados iguais não são republicados; falhas da fonte ou do banco preservam a versão existente. O cache do adaptador também é de cinco minutos.

`GET /api/stream` abre uma conexão SSE pública. A conexão consulta a versão publicada no banco a cada 15 segundos, envia snapshots novos e heartbeats quando não há mudanças, e é renovada após cerca de 45 segundos. O navegador reconecta automaticamente, usando o último ID recebido para evitar reenvios. A consulta ao banco compartilhado permite funcionar entre instâncias do Worker sem um registro de clientes em memória. Essa primeira versão faz leituras por conexão; um distribuidor com Durable Objects pode ser avaliado se o número de conexões crescer.

No modo **Situação atual**, a interface aplica as novidades sem recarregar e preserva palpites compatíveis. **Do início** continua livre, com aplicação explícita das novas versões. Dados atrasados e mensagens inválidas são ignorados. Abas ocultas pausam a conexão e consultam a versão atual ao retornar. O menu `⋯` mantém uma atualização manual para recuperação.

O evento `coverage` informa que o Worlds usa coleta automática e que o VCT Americas ainda usa base manual. O stream não coleta resultados de Valorant nem presume que essas fontes já estejam integradas.

No Node.js, o servidor também coleta ao iniciar e a cada cinco minutos; esse agendamento é desativado com `NODE_ENV=test`. No Wrangler local, o cron precisa ser disparado pelo mecanismo de testes de scheduled events. O deploy só ativa o cron remoto quando essa revisão da infraestrutura for publicada.

## Banco, migração e recuperação

As migrações D1 ficam em `packages/db/src/d1/migrations`, separadas das migrações PostgreSQL. São aplicadas pelo recurso D1 do Alchemy antes da publicação do Worker. Migrações aplicadas não devem ser editadas; mudanças futuras precisam de arquivos adicionais compatíveis com a versão anterior da aplicação. Não execute os arquivos PostgreSQL no D1.

Essa configuração cria um banco D1 novo. Ela não copia usuários, sessões, snapshots ou cenários de um PostgreSQL existente. Se houver dados remotos a preservar, faça uma exportação e planeje a conversão de JSON e timestamps antes de mudar o tráfego. O PostgreSQL existente e seus dados não são removidos por esta alteração.

O salvamento no D1 usa `batch` para inserir snapshot e cenário atomicamente; uma falha de chave estrangeira desfaz o lote inteiro. Snapshots existentes preservam seu conteúdo ao serem publicados novamente. Palpites locais do navegador continuam usando o mesmo formato; sua preservação depende de manter a origem pública do site.

Para recuperar a aplicação, publique uma revisão anterior compatível com o schema D1 atual. Uma versão antiga que exige API externa/PostgreSQL não é um rollback direto desse stack. Preserve o banco e as migrações aplicadas. Não use `destroy` como rollback: ele pode remover recursos e dados.

## Validação

```sh
pnpm run build:cloudflare
pnpm run test:worker
pnpm run test:e2e:cloudflare
```

O teste de integração usa o runtime workerd e D1 efêmero, valida os assets, deep links, rotas RPC, autenticação, isolamento de proprietários, snapshots imutáveis e rollback do lote. A suíte de navegador reutiliza os testes do simulador contra a mesma origem do Worker.

## Custos

O stack usa Workers com assets e D1, que oferecem franquias gratuitas. A capacidade depende dos limites de execução e banco da conta. A infraestrutura não exige contratação de hospedagem Node.js ou PostgreSQL. Consulte os preços de [Workers](https://developers.cloudflare.com/workers/platform/pricing/) e [D1](https://developers.cloudflare.com/d1/platform/pricing/) antes de habilitar planos pagos.
