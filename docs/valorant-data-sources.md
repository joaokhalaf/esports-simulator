# Fontes de dados · Valorant

Pesquisa realizada em **11/11/2026**, para automatizar as classificatórias VCT Americas Kickoff 2027. Esta pesquisa não ativa coletores nem altera os resultados do simulador.

## Plataformas por região

| Região           | Plataforma identificada                  | Referência                                                                                                                                                                                                                                                                                               |
| :--------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brasil           | Gamers Club                              | [Seletiva 1 · 3217](https://gamersclub.gg/valorant/tournaments/3217), [seletiva 2 · 3218](https://gamersclub.gg/valorant/tournaments/3218). A Riot indica a Gamers Club como plataforma de inscrição.                                                                                                    |
| América do Norte | Battlefy / Raidiant                      | [Seletiva 1](https://battlefy.com/raidiant/2027-vct-americas-kickoff-na-qualifier-1/6acfc16366e3a40024811c7f/info), [seletiva 2](https://battlefy.com/raidiant/2027-vct-americas-kickoff-na-qualifier-2/6adfb6d52cd672001a6ddd13/info). O link da Riot para a primeira seletiva redireciona ao Battlefy. |
| LATAM Norte      | Challonge, incorporado no portal oficial | [Portal Norte](https://vctkolatam2027.com/oq-latam-norte/) incorpora `https://challonge.com/es/guhmhw8w/module`.                                                                                                                                                                                         |
| LATAM Sul        | Challonge, incorporado no portal oficial | [Portal Sul](https://vctkolatam2027.com/oq-latam-sur/) incorpora `https://challonge.com/es/9s2k69nx/module`.                                                                                                                                                                                             |

Os IDs da segunda seletiva BR/NA foram identificados no catálogo público do Centro VLR; o vínculo da segunda seletiva deve ser conferido na própria plataforma antes de habilitar coleta. Os slugs Challonge acima foram extraídos dos iframes do portal oficial na data da pesquisa: não presumir que serão reutilizados em outra seletiva.

Anúncios oficiais: [Brasil](https://valorantesports.com/pt-BR/news/2027-vct-americas-kickoff-brazil-qualifiers), [NA](https://valorantesports.com/en-US/news/2027-vct-americas-kickoff-north-america-qualifiers), [LATAM](https://valorantesports.com/es-MX/valorantesports/news/2027-vct-americas-kickoff-latam-qualifiers).

## Acesso e limitações verificados

### Gamers Club e Battlefy

A página pública do Battlefy respondeu com HTML. Entretanto, a requisição direta de teste ao endpoint `https://api.battlefy.com/tournaments/6acfc16366e3a40024811c7f` retornou HTTP 403 neste ambiente. A página da Gamers Club também retornou HTTP 403 à requisição direta. Isso não demonstra indisponibilidade geral nem estabelece que seja necessária uma chave: o acesso de produção ainda precisa ser validado. Não foi implementada tentativa de contornar bloqueios.

### Challonge

As páginas regionais oficiais responderam com HTML e permitiram identificar os embeds. Os módulos Challonge retornaram HTTP 403 à requisição direta neste ambiente.

A [API v2.1 documentada](https://challonge.apidog.io/getting-started-1726706m0) exige credenciais. A documentação informa limite gratuito de 500 requisições por mês, com plano pago acima disso. Consultar a cada cinco minutos, continuamente por 30 dias, consome 8.640 requisições para um único recurso, antes de paginação ou consulta a participantes. Deve-se validar também o [escopo de acesso aos recursos](https://challonge.apidog.io/resource-scoping-1730219m0) para os torneios de terceiros desejados.

### Toornament

Não foi identificado como organizador dessas quatro seletivas das Américas. Não deve ser escolhido apenas porque aparece entre as origens usadas por outro agregador.

A [Viewer API](https://developer.toornament.com/v2/doc/viewer_overview) está em modo legado e anuncia a descontinuação do acesso a dados públicos. A [API atual](https://developer.toornament.com/v2/overview/get-started?_locale=en) exige credenciais e plano com acesso à API, restringindo a aplicação aos torneios do projeto autorizado. Criar uma conta própria não garante leitura dos torneios de outros organizadores.

### Riot

Os [endpoints documentados de Valorant](https://developer.riotgames.com/docs/valorant) incluem conteúdo, partidas por ID/PUUID, ranking e status. A listagem não oferece o catálogo de eventos e chaves VCT necessário ao nosso coletor. O adaptador de LoL não pode ser simplesmente reaproveitado trocando a modalidade.

## Agregadores testados

### Centro VLR

A API respondeu sem credenciais às consultas de catálogo e partidas. O frontend também utiliza SSE em `/api/stream`, mas isso não comprova como o servidor coleta cada fonte nem constitui um contrato de API para terceiros.

A contagem abaixo foi obtida com `GET /api/matches?stage_id=<id>&limit=1000`:

| Etapa no Centro VLR      | ID  | Partidas retornadas | `last_source` |
| :----------------------- | :-- | :------------------ | :------------ |
| Brasil · seletiva 1      | 1   | 205                 | `gamersclub`  |
| NA · seletiva 1          | 9   | 258                 | `battlefy`    |
| LATAM Norte · seletiva 1 | 18  | 0                   | —             |
| LATAM Sul · seletiva 1   | 17  | 0                   | —             |

O catálogo retornava NA como `upcoming`, embora a consulta de partidas trouxesse 257 partidas finalizadas. Portanto, o estado da etapa não deve determinar sozinho se a seletiva terminou. O número de vagas do Brasil também exige considerar a repescagem, em vez de copiar um `advance_count` genérico.

Referências públicas: [catálogo](https://centrovlr.com.br/api/events), [Brasil](https://centrovlr.com.br/api/matches?stage_id=1&limit=1000), [NA](https://centrovlr.com.br/api/matches?stage_id=9&limit=1000), [LATAM Norte](https://centrovlr.com.br/api/matches?stage_id=18&limit=1000), [LATAM Sul](https://centrovlr.com.br/api/matches?stage_id=17&limit=1000).

### VLR.gg

As quatro páginas abaixo responderam HTTP 200 à consulta direta e continham elementos públicos da chave, incluindo confrontos, nomes e placares. Os elementos incluem byes e vagas de classificação; a contagem de elementos não equivale a partidas disputadas.

| Região      | ID do evento | Página testada                                                                                                |
| :---------- | :----------- | :------------------------------------------------------------------------------------------------------------ |
| Brasil      | 3187         | [Seletiva 1](https://www.vlr.gg/event/3187/vct-2027-america-kickoff-brazil-open-qualifier/qualifier-1)        |
| NA          | 3186         | [Seletiva 1](https://www.vlr.gg/event/3186/vct-2027-america-kickoff-north-america-open-qualifier/qualifier-1) |
| LATAM Norte | 3189         | [Seletiva 1](https://www.vlr.gg/event/3189/vct-2027-america-kickoff-latam-north-open-qualifier/qualifier-1)   |
| LATAM Sul   | 3190         | [Seletiva 1](https://www.vlr.gg/event/3190/vct-2027-america-kickoff-latam-south-open-qualifier/qualifier-1)   |

Isso viabiliza estudar um coletor próprio de HTML público; não prova que toda a cobertura esteja completa ou atualizada. O parser deve reconhecer versões da chave e recusar uma resposta incompleta. O seletor da fase também precisa ser validado: a mesma URL pode exibir estrutura vazia ou uma fase diferente conforme o estado do evento.

O projeto [vlrggapi](https://github.com/axsddlr/vlrggapi) implementa uma API não oficial e pode servir de referência técnica. Seu README informa que a instância hospedada está indisponível por limite de hospedagem e orienta hospedar uma instância própria. Não adotar a URL pública desse serviço como dependência de produção.

## Caminho recomendado para a primeira integração

1. Implementar um coletor próprio das páginas públicas do VLR, condicionado à validação das chaves e com cópias de respostas para testes. É o candidato que respondeu com dados das quatro regiões nesta pesquisa.
2. Manter Gamers Club, Battlefy e Challonge como fontes de conferência e futuros adaptadores, conforme o acesso autorizado estiver validado.
3. Normalizar IDs externos, equipes, região, etapa, MD3/MD5, estado da série, placar, W.O. e origem. Nomes parecidos não bastam para identificar equipes; por exemplo, GANGUE e Team Solid exigem identificação explícita.
4. Separar placar parcial de série encerrada. W.O., bye e cancelamento não devem virar uma vitória por mapas inventada. Classificação extra por repescagem exige uma regra própria.
5. Salvar versões validadas no banco e transmitir um evento próprio de Valorant pelo `/api/stream`. Preservar a última versão válida em caso de falha, sem apagar resultados nem palpites compatíveis.
6. Reduzir consultas fora dos dias ativos e compartilhar a coleta entre visitantes. Fazer consultas apenas no servidor; os navegadores recebem as mudanças pelo nosso stream.

A API do Centro VLR pode ser uma fonte complementar, mas a cobertura vazia do LATAM e os metadados divergentes impedem tratá-la, sozinha, como solução completa para as quatro regiões.
