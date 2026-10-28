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
