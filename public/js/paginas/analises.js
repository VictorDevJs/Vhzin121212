import { api } from '../api.js';
import {
  el, cartao, tabela, celula, indicador, etiqueta, etiquetaCor, vazio,
} from '../ui.js';
import { barrasHorizontais, rosca } from '../graficos.js';
import { icone } from '../icones.js';
import { topo } from '../app.js';

/**
 * Análises da academia: qual arte marcial está crescendo, quem está sumindo
 * do tatame e como as faixas estão distribuídas. É a leitura de gestão que
 * o dono usa para decidir horário, turma e investimento.
 */
export default async function paginaAnalises() {
  const dados = await api.obter('/painel/analises');
  const { modalidades, retencao, graduacoes } = dados;

  const totalAlunos = modalidades.reduce((soma, m) => soma + m.alunos, 0);
  const emAlta = [...modalidades]
    .filter((m) => m.variacao_presenca !== null)
    .sort((a, b) => b.variacao_presenca - a.variacao_presenca)[0];

  /** Distribuição de faixas agrupada por arte marcial. */
  function faixasPorModalidade() {
    const grupos = new Map();
    for (const linha of graduacoes) {
      if (!grupos.has(linha.modalidade)) grupos.set(linha.modalidade, []);
      grupos.get(linha.modalidade).push(linha);
    }
    if (!grupos.size) return vazio('Nenhuma graduação registrada ainda.');

    return el('div', { classe: 'grade col-2' }, [...grupos].map(([modalidade, linhas]) => cartao(
      modalidade,
      barrasHorizontais({
        dados: linhas.map((l) => ({ rotulo: l.graduacao, valor: l.alunos, cor: l.cor })),
        formatar: (v) => `${v} aluno${v === 1 ? '' : 's'}`,
      }),
    )));
  }

  function variacao(modalidade) {
    if (modalidade.variacao_presenca === null) return el('span', { classe: 'dica', texto: 'sem base' });
    const sobe = modalidade.variacao_presenca >= 0;
    return el('span', { classe: `delta ${sobe ? 'sobe' : 'desce'}` }, [
      el('span', { texto: sobe ? '↑' : '↓' }),
      `${Math.abs(modalidade.variacao_presenca)}%`,
    ]);
  }

  return el('div', {}, [
    topo('Análises', 'Como cada arte marcial está performando: alunos, presença, ocupação e resultado esportivo'),

    el('p', { classe: 'explicacao' }, [
      icone('grafico', 16),
      'Os números comparam os últimos 30 dias com os 30 anteriores. Presença em queda numa modalidade costuma '
      + 'aparecer aqui antes de virar cancelamento de matrícula.',
    ]),

    el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
      indicador({ rotulo: 'Alunos ativos', valor: String(retencao.ativos),
        detalhe: `${retencao.novos_mes} novo(s) nos últimos 30 dias`, tipo: 'destaque' }),
      indicador({ rotulo: 'Treinando de verdade', valor: String(retencao.treinando),
        detalhe: 'Fizeram check-in nos últimos 14 dias' }),
      indicador({ rotulo: 'Sumiram do tatame', valor: String(retencao.sumidos),
        detalhe: 'Ativos sem treinar há 3 semanas',
        tipo: retencao.sumidos > 0 ? 'atencao' : 'bom' }),
      indicador({ rotulo: 'Modalidade em alta', valor: emAlta ? emAlta.nome : '-',
        detalhe: emAlta ? `Presença ${emAlta.variacao_presenca >= 0 ? '+' : ''}${emAlta.variacao_presenca}% no mês` : 'Sem base de comparação' }),
    ]),

    el('div', { classe: 'grade col-2' }, [
      cartao('Alunos por arte marcial', barrasHorizontais({
        dados: modalidades.map((m) => ({ rotulo: m.nome, valor: m.alunos, cor: m.cor })),
        formatar: (v) => `${v} aluno${v === 1 ? '' : 's'}`,
      })),
      cartao('Presença dos últimos 30 dias', barrasHorizontais({
        dados: modalidades.map((m) => ({ rotulo: m.nome, valor: m.checkins_mes, cor: m.cor })),
        formatar: (v) => `${v} check-in${v === 1 ? '' : 's'}`,
      })),
    ]),

    cartao('Quadro completo por modalidade', tabela(
      ['Modalidade', 'Alunos', 'Turmas', 'Aulas/semana', 'Ocupação', 'Presença 30d', 'Variação',
        'Média por aula', 'Graduações no ano', 'Competição'],
      modalidades.map((m) => [
        celula([etiquetaCor(m.nome, m.cor)]),
        String(m.alunos),
        String(m.turmas),
        String(m.aulas_semana),
        celula([etiqueta(`${m.ocupacao}%`, m.ocupacao > 80 ? 'atencao' : m.ocupacao > 40 ? 'ok' : 'neutra')]),
        String(m.checkins_mes),
        celula([variacao(m)]),
        String(m.media_por_aula),
        String(m.graduacoes_ano),
        `${m.inscricoes} inscrição(ões) · ${m.podios} pódio(s)`,
      ]),
      'Cadastre modalidades para ver a análise.',
    )),

    el('div', { classe: 'grade col-2' }, [
      cartao('Situação dos alunos', rosca({
        dados: [
          { rotulo: 'Ativos', valor: retencao.ativos },
          { rotulo: 'Pendentes', valor: retencao.pendentes },
          { rotulo: 'Trancados', valor: retencao.trancados },
          { rotulo: 'Inativos', valor: retencao.inativos },
        ],
        titulo: 'alunos',
        formatar: (v) => `${v}`,
      })),
      cartao('Onde estão as matrículas', el('div', {}, [
        el('p', { classe: 'dica', texto:
          `${totalAlunos} vínculo(s) de aluno com modalidade. Quem treina duas artes aparece nas duas.` }),
        barrasHorizontais({
          dados: modalidades.map((m) => ({ rotulo: m.nome, valor: m.ocupacao, cor: m.cor })),
          formatar: (v) => `${v}% das vagas`,
        }),
      ])),
    ]),

    cartao('Distribuição de faixas e graduações', faixasPorModalidade()),
  ]);
}
