# Desenvolvimento e verificação

Use os scripts existentes e consulte docs/ci-cd.md. `pnpm run ci` é o gate local
usado na CI: Biome, políticas AST e testes dessas políticas. Tipos, builds, testes
de domínio e integração/browser continuam sendo etapas adicionais do workflow.

Não adicione useEffect, inclusive via alias/namespace/reexport, nem troque por
useLayoutEffect para contornar a regra. Prefira render derivado, handlers, loaders
e operações públicas de domínio. O legado em scripts/architecture-baseline.json
não pode crescer ou ser regenerado para conseguir verde; alterações requerem
revisão humana. Migração de legado deve ser explícita e preservar comportamento.

Frontend não importa @esports-simulator/db ou seus subpaths: use o cliente API
ou contratos/operações públicos do domínio. Não suprima lint para contornar esse
limite. Evite comentários explicativos; codifique restrições em APIs, tipos e testes.

| Restrição                 | Enforcement                    | Prova                      |
| ------------------------- | ------------------------------ | -------------------------- |
| Novos useEffect proibidos | scripts/check-architecture.mjs | pnpm run test:architecture |
| Banco fora do frontend    | Biome noRestrictedImports      | pnpm run test:architecture |

E2E usa dados locais isolados; não use produção como fixture. Não declare uma
integração/browser validada quando só rodaram checks estáticos ou testes de domínio.
