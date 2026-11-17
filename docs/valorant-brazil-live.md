# Coleta brasileira do VLR

O servidor coleta as páginas públicas de partidas dos eventos 3187 (seletivas 1 e
2) e 3183 (suíço/playoffs). Não usa uma API oficial nem a instância pública de
vlrggapi. As URLs são fixas; nenhum parâmetro de usuário escolhe o destino.
Redirects são recusados, cada resposta tem limite de 2 MB e timeout de 15 segundos.
Cheerio/slim interpreta HTML, sem executar scripts ou carregar recursos.

Node coleta no início e no timer existente; Worker coleta pelo cron existente de
cinco minutos. Entre 5/nov e 7/dez/2026 o cache compartilhado tem TTL de cinco
minutos; fora da janela, 24 horas. Não existe endpoint público de coleta. O
frontend lê a API de cache a cada minuto. Falhas não sobrescrevem o último dado
válido. A data mostrada é a última coleta válida, não a última tentativa.

O parser exige identidade da página, contador de partidas, quantidade exata de
cards, IDs únicos e campos válidos. Não aceita truncamento, desafios ou redução
de cobertura em relação à versão armazenada. Alterações legítimas que removam
partidas exigem revisar a fonte e o contrato; não limpar o cache automaticamente.
A escrita usa timestamp condicional para impedir publicação atrasada.

Snapshots ficam em vct_results, separados do Worlds, nos adapters PostgreSQL e
D1. A API pública vct.brazil só lê o cache. O stream /api/stream emite brazil com
o identificador dentro do payload, preservando o Last-Event-ID do Worlds. A
cobertura Americas das outras regiões continua manual.

A aba Partidas · VLR mostra os registros coletados separadamente. Não substitui
roster, seeds, resultados curados ou palpites: pareamentos simulados não podem ser
associados aos oficiais apenas por nomes. O placar parcial tem indicação própria.
Completed com 0–0 ou contra TBD sem placar completo é indisponível, sem inferir
W.O.; forfeit só aparece com anotação explícita e vencedor inequívoco. Placares
numéricos são identificados como informados pelo VLR, sem garantir mapas jogados.

As fixtures offline foram extraídas em 17/nov/2026 de:

- https://www.vlr.gg/event/matches/3187/vct-2027-america-kickoff-brazil-open-qualifier/?series_id=all
- https://www.vlr.gg/event/matches/3183/vct-2027-america-kickoff-brazil-qualifier-playoffs/?series_id=all

Elas preservam título, navegação/contador e todos os cards (429 e zero), removendo
scripts, anúncios e elementos externos e normalizando espaços. Os testes não
acessam o site. Zero no evento 3183 significa ausência de partidas publicadas,
não ausência de participantes nem resultado de simulação.

Antes de implantar, aplique as migrações PostgreSQL ou D1 pelos scripts existentes.
Os testes de Worker aplicam todas as migrações D1 em banco efêmero.
Não foram alteradas credenciais nem proteções do forge. Revisão de segurança
focada cobre destinos fixos, redirects, limites, HTML como dados e leitura pública
sem mutação. Isso não constitui auditoria completa com sandbox de execução.
