# Campeonatos internacionais de LoL

Pesquisa de 7 de novembro de 2026. A agenda em `/calendario` diferencia datas de jogo, janelas do evento e edições que aguardam confirmação. A janela da [EWC 2027](https://ewc-web.prod.esf-systems.com/en) é julho a agosto para o evento multijogo. Os dias do LoL ainda precisam de confirmação. A [ENC](https://www.esportsnationscup.com/en/press-releases/ef-postpones-enc-to-november-2027) passou para novembro de 2027.

## Formatos para validar com edições concluídas

| Torneio     | Referência de 2026                                                                                                                                                                                 | O que implementar                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| First Stand | Oito equipes em dois grupos de dupla eliminação, seguidos por semifinais e final. Séries MD5. [Regulamento e guia](https://lolesports.com/en-GB/news/fst-2026-primer)                              | Encadear vencedores e perdedores nos grupos e cruzar os classificados nas semifinais.                    |
| MSI         | Play-in e chave principal com repescagem. [Agenda e formato](https://lolesports.com/en-US/news/msi-and-worlds-updates)                                                                             | Permitir entradas diretas, encaminhar derrotados à chave inferior e avançar os classificados do play-in. |
| EWC         | Quatro grupos GSL com 16 equipes, oito classificados, mata-mata e disputa de terceiro lugar. MD1, MD3 e MD5. [Regulamento](https://resources.esportsworldcup.com/en/competitive-ops/rulebooks/lol) | Reaproveitar a progressão de grupos, parametrizar o tamanho das séries e validar o sorteio dos playoffs. |
| Worlds      | Play-in, suíço e mata-mata. [Guia de 2026](https://lolesports.com/en-GB/news/worlds-2026-primer)                                                                                                   | Manter o motor atual para 2026 e cadastrar as regras da próxima edição após a publicação oficial.        |

## Primeira implementação

Começar com uma reprodução do First Stand 2026 usando os resultados oficiais como referência. Esse formato exercita grupos e mata-mata, que também serão úteis para a EWC. Usar o regulamento publicado de cada edição de 2027 para validar equipes, sorteios e fases antes de ativar o simulador correspondente. A [Riot anunciou as regiões-sede de 2027](https://lolesports.com/en-US/news/lol-esports-in-2025).

1. Identificar cada edição por uma chave estável, como `worlds-2026` ou `first-stand-2027`. Vincular a ela o formato, a fonte de dados e a versão das regras. O modelo atual valida um único ID de torneio, 19 equipes e 46 séries, de modo que mudar o ID do importador sozinho não é suficiente.
2. Montar as chaves a partir das dependências entre séries, com vagas diretas e vagas preenchidas por vencedor ou perdedor. Reaproveitar a validação de placares, os cartões e a celebração do campeão. Manter o sorteio suíço como regra específica do Worlds.
3. Consultar snapshots publicados por edição e guardar rascunhos locais com chaves separadas. Preservar a leitura do rascunho `worlds-2026-draft-v1` e dos snapshots já gravados no D1.
4. Verificar se o feed do LoL Esports retorna todos os jogos do First Stand e do MSI. Para EWC, validar uma fonte do organizador e conferir os IDs de partidas, a cobertura dos resultados e a estabilidade das respostas. Usar uma importação validada de dados oficiais enquanto não houver uma fonte automatizável.
5. Validar cada formato reproduzindo resultados reais até a final. Cobrir avanço para a chave inferior, emparelhamentos após os grupos e preservação de palpites quando novos resultados chegarem.
