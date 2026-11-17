# Qualificatório brasileiro · VCT Americas Kickoff 2027

A experiência em `/simulacoes/brasil` usa uma base curada consultada em 17/11/2026.
Acesso pelo catálogo Valorant na home e pelo calendário. Não depende de coleta ou
API externa em runtime. O simulador geral das Américas permanece disponível.

## Participantes e resultados

São seis classificados da primeira seletiva (incluindo repescagem), quatro da
segunda e seis convidados. As fontes ficam visíveis na tela: formato/datas da
Riot, resultados e participantes do VLR e cobertura da primeira seletiva THESPIKE.
A notícia sobre convidados NA não é fonte dos convites brasileiros.

A segunda seletiva classificou SÓ TEM VELHO, ARRANCA DREAMS, Master Bank e
0 intelecto. Os resultados mostrados são um recorte confirmado de séries decisivas,
não toda a chave aberta. W.O. é modelado separadamente e não recebe placar de mapas.
As séries reais não podem ser editadas. A fonte dos 16 participantes é
https://www.vlr.gg/event/3183/vct-2027-america-kickoff-brazil-qualifier-playoffs/swiss-stage.

A fase suíça (20–22/11) tem 16 equipes, classifica com duas vitórias e elimina com
duas derrotas. Oito avançam à dupla eliminação (26–29/11 e 3–6/12). O campeão vai
para o Kickoff e o vice disputa o Americas LCQ; o LCQ não é simulado nesta página.
Os pareamentos/seeds desta experiência são de cenário e não afirmam reproduzir o
sorteio oficial. A interface identifica essa distinção. Não há atualização ao vivo.

## Contrato e persistência

`BrazilDraft` contém apenas versão e palpites; o chamador não altera o roster
confirmado nem resultados reais. As operações públicas em `vct/brazil.ts` reusam
o motor regional existente. Placar inválido, partida inexistente ou ainda sem
equipes não produz uma alteração; resultados dependentes incompatíveis desaparecem.

Os palpites ficam em `vct-brazil-2027-draft-v1`, separado de Worlds e Américas.
Salvar ocorre nos eventos de alteração/desfazer/reiniciar, sem useEffect. Falhas de
storage mantêm a sessão utilizável e exibem um aviso. Desfazer guarda o histórico
da sessão atual; reabrir restaura os palpites, não o histórico de desfazer.

## Verificação

- `pnpm --filter @esports-simulator/api exec tsx --test test/brazil.test.ts` cobre
  os 16 participantes, W.O., resultados imutáveis, conclusão suíço/playoffs,
  roundtrip persistido, corrupção e invalidação de dependências.
- `pnpm exec playwright test tests/e2e/brazil.spec.ts` cobre os caminhos públicos,
  resultados travados, campeão, reload/desfazer e erros de storage. O mesmo arquivo
  integra a suíte Cloudflare com D1 efêmero, sem PostgreSQL.
- `pnpm run ci` e `pnpm --filter web run check-types` validam políticas e build.
