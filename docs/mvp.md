# MVP · Worlds 2026

O simulador importa o Mundial de LoL 2026 diretamente da API usada pelo site LoL Esports. Não exige token da Riot nem conta PandaScore. O escopo é essa edição: Play-In de quatro equipes e seis MD5, suíço de 16 equipes e 33 séries, e eliminatórias de oito equipes e sete MD5.

## Executar localmente

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
pnpm run db:start
pnpm run db:migrate
```

Em dois terminais:

```sh
pnpm run dev:server
pnpm run dev:web
```

Abra http://localhost:3001. `dev:server` e `dev:web` iniciam os aplicativos diretamente; o `dev` original do scaffold também envolve a infraestrutura Alchemy.

A API usa a porta 3000 por padrão; `PORT` permite escolher outra porta. Os testes de navegador usam API na porta 3100 e interface na 3101 para não disputar as portas do desenvolvimento.

`db:start` aguarda o PostgreSQL aceitar conexões TCP antes de terminar, inclusive na primeira inicialização do volume. Se o banco não ficar saudável em 90 segundos, o comando falha com erro em vez de iniciar a migração prematuramente.

A migração inicial inclui as tabelas de autenticação do scaffold e as novas tabelas do MVP. Use os comandos acima em um banco novo. Se o seu banco já recebeu `db:push`, revise e estabeleça a baseline de migrações antes de executar a migração inicial; ela não é uma migração de adoção para bancos preexistentes. Nenhum banco existente foi migrado durante esta implementação.

O segredo do exemplo é exclusivo para desenvolvimento local. Configure um segredo próprio e as URLs do ambiente antes de publicar.

## Usar

- A página inicial utiliza a última versão publicada, ou uma cópia real da API incluída em `packages/api/src/worlds/seed.json`, coletada em 26/10/2026. A data da importação aparece abaixo da chave.
- O layout **bracket.** usa a paleta verde original, com fundos claros e ações em verde-escuro. Marca e navegação ficam no topo da sidebar branca; o contador de partidas fica alinhado aos controles. **Fase de entrada** reúne Play-In e participantes; **Fase suíça** exibe rodadas e classificação; **Playoffs** mostra quartas, semifinais e grande final conectadas. A lateral permite buscar campeonatos, favoritar Worlds. Os outros campeonatos e Valorant estão indicados como indisponíveis nesta versão.
- Cada fase tem abas por rodada. Com espaço horizontal suficiente, **Chave completa** ou **Todas as rodadas** abre automaticamente e mostra as colunas juntas. Em telas menores, abre a primeira rodada pendente; a visão completa continua disponível com rolagem interna. Setas, Home e End navegam pelas abas, preservando os palpites ao trocar de visualização. Ao confirmar o último jogo de uma rodada, abre a próxima rodada disponível, inclusive a partir da visão completa. Concluir a Fase de Entrada ou o suíço abre a fase seguinte.
- No Play-In, a visão completa reúne as chaves superior e inferior; linhas tracejadas representam a descida de perdedores. O suíço mostra suas cinco rodadas em colunas, divididas pela campanha anterior à rodada: 0–0; 1–0 e 0–1; 2–0, 1–1 e 0–2; 2–1 e 1–2; 2–2. Cada grupo tem quatro quadrados (verde para vitória, vermelho para derrota e cinza para espaço restante), formato MD1/MD3. Cada resultado confirmado atualiza imediatamente a classificação e mostra a equipe no grupo da rodada seguinte com adversário a definir. Por exemplo, CFO vencendo uma série de campanha 1–2 entra no grupo 2–2 da rodada 5. Os confrontos da próxima rodada só são sorteados quando todos os resultados necessários estão definidos; alterar um palpite ou desfazê-lo recalcula também essas vagas. A classificação fica em um painel recolhível abaixo das rodadas.
- A interface ocupa toda a largura disponível. Acima de 1440 px, usa a escala normal de desktop; entre 761 e 1440 px, ativa a escala compacta para notebooks (texto de 12 px, título de 24 px e cards com linhas de 37 px). No celular, a lateral passa para baixo e as abas mostram uma rodada por vez por padrão. As capturas dos testes verificam 1920×1080, 1366×768, 1280×720 e celular.
- **Importar da Riot** busca os dados atuais. Se o banco estiver disponível, grava e publica uma versão imutável. A importação apresenta uma nova versão sem substituir as escolhas do cenário aberto; **Criar cenário atualizado** adota essa versão explicitamente.
- **Situação atual** fixa os resultados reais concluídos e permite completar o restante. **Do início** remove os resultados de partida e permite simular tudo. Ambas as opções ficam na mesma barra de Simular restantes. **Refazer sorteio** é um botão de destaque na barra principal e indica a rodada afetada. Importar da Riot fica no menu de três pontos.
- Clique na equipe que deve avançar, escolha o placar e pressione **Confirmar** ao lado dos placares no confronto. Complete a rodada para gerar a próxima. No suíço, três vitórias classificam e três derrotas eliminam. Séries de classificação/eliminação são MD3; as demais são MD1. Empates no retrospecto não exigem desempate: a progressão é definida por vitórias e derrotas, e os confrontos por sorteio.
- **Simular fases anteriores** preenche as vagas dos playoffs sem escolher seus resultados. **Simular restantes** completa os confrontos pendentes. **Desfazer**, abaixo da chave, recupera o estado anterior nesta sessão; **Reiniciar** abre um toast shadcn/Sonner com Reiniciar e Cancelar; só apaga os palpites após confirmação, preservando os resultados reais do modo atual. É possível desfazer a limpeza.
- Os sorteios oficiais são reutilizados quando compatíveis com os participantes e retrospectos. Quando necessário, um sorteio simulado usa uma semente salva no cenário, sem revanche no suíço. A primeira rodada respeita potes e regiões; nas quartas, os dois 3–0 enfrentam equipes 3–2. Datas são as dos slots oficiais, mesmo quando os adversários são simulados.
- Alterar um placar descarta os palpites de rodadas posteriores e preserva os outros confrontos da mesma rodada. É possível abrir vários confrontos e confirmá-los em qualquer ordem. **Refazer sorteio** gera outros adversários para a rodada pendente, mantendo resultados e sorteios das rodadas anteriores. Se já houver palpites nessa rodada, um toast permite confirmar a limpeza apenas dessa rodada e das seguintes, ou cancelar. Desfazer restaura a chave anterior. Rodadas com resultados reais e as chaves fixas do Play-In/semifinais/final não são alteradas. Os sorteios são salvos no navegador; se não for encontrada outra combinação válida, nada é apagado. O motor não simula draft de campeões ou estatísticas individuais.
- Os palpites são salvos automaticamente apenas no navegador, incluindo a versão dos dados e a semente do sorteio. Recarregar a página recupera a simulação; outro navegador tem seu próprio estado. A interface não tem nome de cenário, login, conta, lista pessoal, compartilhamento ou editor administrativo. As rotas antigas `/login` e `/dashboard` retornam ao simulador.

## Arquitetura

- `packages/api/src/worlds/riot.ts`: adaptador GraphQL `https://lolesports.com/api/gql`, operação `homeEvents`, liga `98767975604431411`, campeonato `115660540725177488`. Usa cabeçalhos públicos de identificação do cliente e filtro do ano de 2026. Não executa JavaScript remoto. Se o identificador da operação mudar, lê o manifesto público do site. Requisições simultâneas são deduplicadas, com cache de cinco minutos, timeout e espera de 30 segundos após falha. Importações incompletas ou de outra edição são recusadas.
- `model.ts` e `engine.ts`: contratos Zod e motor determinístico sem acesso à rede ou banco. A versão das regras é `worlds-2026-v1`. IDs externos são strings para preservar precisão. Dados reais e resultados simulados ocupam estruturas distintas.
- `worlds_snapshot`: dados normalizados em JSONB, identificados por SHA-256 do conteúdo, com data de importação e publicação. `worlds_scenario`: proprietário, nome, snapshot e escolhas com versão das regras/semente. O salvamento usa transação e valida os confrontos novamente no servidor. O conteúdo de snapshots e cenários salvos não é atualizado.
- `apps/web/src/components/worlds-simulator.tsx`: simulação, classificação por rodada, salvamento automático local e importação.

A API do site não oferece aqui um contrato público de integração nem garantia de estabilidade para terceiros. Uma mudança de schema, cobertura ou manifesto pode exigir atualizar o adaptador. A tela conserva a versão anterior quando o import falha. O fallback permite simular e persistir os palpites no navegador mesmo sem PostgreSQL. A infraestrutura de autenticação e as rotas antigas de cenários permanecem no servidor para uso futuro, sem acesso na interface atual. Não há agendamento de sincronização ou suporte a Valorant neste MVP.

## Verificar

```sh
pnpm test
pnpm run check-types
pnpm run build
```

Os testes de domínio percorrem 200 cenários completos e verificam sorteios, MD1/MD3/MD5, avanço, classificação e invalidação. Os testes do adaptador usam respostas determinísticas e verificam recuperação do manifesto, cache e ausência de token.

Para integração e navegador, use exclusivamente um PostgreSQL temporário com banco `worlds_mvp` na porta 55432:

```sh
docker run --detach --rm --name worlds-mvp-test-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=worlds_mvp -p 127.0.0.1:55432:5432 postgres:17-alpine
DATABASE_URL=postgresql://postgres:password@localhost:55432/worlds_mvp pnpm --filter @esports-simulator/db run db:migrate
TEST_DATABASE_URL=postgresql://postgres:password@localhost:55432/worlds_mvp pnpm test
pnpm exec playwright install chromium
pnpm run test:e2e
docker stop worlds-mvp-test-db
```

Playwright inicia os dois servidores e utiliza o banco temporário. `TEST_DATABASE_URL` permite escolher outra porta local para esse mesmo banco. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permite usar um Chromium já instalado. Os testes cobrem restauração dos palpites, isolamento entre navegadores, ausência de chamadas de autenticação e salvamento remoto, redirecionamento das rotas antigas, reinício e layout responsivo. O teste de persistência verifica autorização administrativa e isolamento por proprietário; sem `TEST_DATABASE_URL`, ele é explicitamente ignorado.
