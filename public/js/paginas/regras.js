import { api, sessao } from '../api.js';
import { el, cartao, tabela, celula, etiqueta, etiquetaCor, vazio, esqueleto } from '../ui.js';
import { icone } from '../icones.js';
import { topo } from '../app.js';

/**
 * Regulamento de competição de cada arte marcial: quanto vale cada golpe,
 * quanto dura a luta, o que é falta e quem é a federação que manda.
 */
export default async function paginaRegras() {
  const artes = await api.obter('/regras');
  let escolhida = artes[0] || null;

  const abas = el('nav', { classe: 'abas-modalidade', 'aria-label': 'Escolher arte marcial' });
  const area = el('div');

  function desenharAbas() {
    abas.replaceChildren(...artes.map((arte) => el('button', {
      classe: `aba-modalidade ${escolhida?.modalidade === arte.modalidade ? 'ativa' : ''}`,
      type: 'button',
      estilo: `--cor-aba:${arte.cor}`,
      'aria-pressed': escolhida?.modalidade === arte.modalidade ? 'true' : 'false',
      aoClicar: () => { escolhida = arte; desenharAbas(); carregar(); },
    }, [el('span', { classe: 'ponto-aba' }), arte.modalidade])));
  }

  async function carregar() {
    if (!escolhida) {
      area.replaceChildren(vazio('Ainda não há regulamento cadastrado para as suas modalidades.'));
      return;
    }
    area.replaceChildren(esqueleto(3, 120));
    const r = await api.obter(`/regras/${encodeURIComponent(escolhida.modalidade)}`);

    area.replaceChildren(
      el('div', { classe: 'cabecalho-regra', estilo: `--cor-arte:${r.cor}` }, [
        el('div', {}, [
          el('div', { classe: 'olho-regra', texto: r.federacao }),
          el('h2', { texto: r.modalidade }),
          el('p', { classe: 'resumo-regra', texto: r.resumo }),
        ]),
        r.site ? el('a', {
          classe: 'botao secundario pequeno', href: `https://${r.site}`, target: '_blank', rel: 'noopener',
        }, [icone('externo', 15), ` ${r.site}`]) : null,
      ]),

      el('div', { classe: 'grade col-2' }, [
        cartao('Quanto vale cada coisa', el('div', { classe: 'tabela-texto' }, [tabela(
          ['Ação', 'Vale', 'Como é marcada'],
          r.pontuacao.map(([acao, valor, comoE]) => [
            celula([el('strong', { texto: acao })]),
            celula([el('span', { classe: 'valor-ponto', texto: String(valor) })]),
            comoE || '-',
          ]),
        )])),

        el('div', {}, [
          cartao('Tempo de luta', el('div', { classe: 'tabela-texto' }, [tabela(
            ['Categoria', 'Duração'],
            r.tempo.map(([categoria, duracao]) => [categoria, duracao]),
          )])),
          cartao('Como se ganha', el('ul', { classe: 'lista-regra' },
            r.criterios.map((linha) => el('li', { texto: linha })))),
        ]),
      ]),

      el('div', { classe: 'grade col-2' }, [
        cartao('Faltas e punições', el('div', { classe: 'tabela-texto' }, [tabela(
          ['Situação', 'O que acontece'],
          r.faltas.map(([situacao, efeito]) => [celula([el('strong', { texto: situacao })]), efeito]),
        )])),
        r.categorias_peso.length
          ? cartao('Categorias de peso', el('div', { classe: 'acoes' },
            r.categorias_peso.map((p) => etiquetaCor(p, r.cor))))
          : null,
      ].filter(Boolean)),

      el('p', { classe: 'dica', estilo: 'margin-top:1rem' }, [
        icone('livro', 14),
        ` Resumo para consulta rápida. Regra de federação muda de temporada — antes de competir, `
        + `confira o regulamento oficial do evento e da ${r.federacao}.`,
      ]),
    );
  }

  desenharAbas();
  await carregar();

  return el('div', {}, [
    topo('Regras e pontuação',
      'O regulamento de competição de cada arte marcial, com pontuação, tempo de luta e faltas'),

    el('p', { classe: 'explicacao' }, [
      icone('livro', 16),
      sessao.papel === 'aluno'
        ? 'Antes de competir, saiba quanto vale cada golpe e o que tira ponto. Aqui estão as regras da arte que você treina.'
        : 'Consulta rápida para tirar dúvida de aluno e de pai de aluno antes do campeonato, com a federação de referência de cada arte.',
    ]),

    abas,
    area,
  ]);
}
