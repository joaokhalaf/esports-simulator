# bracket.

**Seu caminho até o campeão do Worlds 2026.**

Simule o Mundial de League of Legends: escolha os vencedores, defina os placares e acompanhe como cada resultado muda os próximos confrontos, do Play-In à grande final.

## O que você pode fazer

- **Começar da situação atual ou do zero.** Continue a partir dos resultados reais ou faça seus palpites desde a primeira partida.
- **Simular todas as fases.** Acompanhe Play-In, fase suíça, classificação e playoffs em uma chave interativa.
- **Explorar outros caminhos.** Refaça sorteios das rodadas disponíveis ou simule automaticamente as partidas restantes.
- **Rever suas escolhas.** Altere placares, desfaça ações e reinicie a simulação com confirmação.
- **Voltar depois.** Seus palpites ficam salvos automaticamente no navegador.
- **Usar no computador ou celular.** Navegue por rodadas ou veja a chave completa em telas maiores.

## Como funciona

1. Escolha **Situação atual** ou **Do início**.
2. Selecione uma equipe no confronto, escolha o placar e clique em **Confirmar**.
3. Complete a rodada para definir os próximos confrontos e siga até o campeão.

Na fase suíça, três vitórias classificam e três derrotas eliminam. A classificação acompanha cada resultado confirmado. Ao alterar um palpite, os palpites posteriores que dependem dele são descartados e os confrontos são atualizados.

Você também pode usar **Simular restantes** para completar a chave ou **Refazer sorteio** para explorar outra combinação válida de adversários.

## Dados e palpites

A opção **Importar da Riot** busca uma atualização dos dados do LoL Esports. Você escolhe quando adotar a nova versão em um cenário atualizado, preservando os palpites do cenário aberto.

A simulação pode usar a versão de dados incluída no projeto quando a importação estiver indisponível. A data dos dados aparece na interface.

O uso dispensa cadastro. Os palpites ficam neste navegador e não são sincronizados entre dispositivos; limpar os dados do site pode apagá-los.

## Sobre o projeto

O escopo atual é o **Worlds 2026 de League of Legends**. Outros campeonatos e jogos ainda não estão disponíveis. Os resultados simulados representam suas escolhas e não alteram os resultados oficiais.

A aplicação usa React e TypeScript na interface, com API em Node.js e PostgreSQL para persistência dos dados do campeonato.

## Para desenvolver

Veja o [guia de execução local, regras e testes](docs/mvp.md) e a [documentação de CI/CD](docs/ci-cd.md).
