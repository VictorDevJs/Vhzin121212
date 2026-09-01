import { api, sessao } from '../api.js';
import { el, cartao, indicador, moeda, dataBr, tabela, vazio, etiqueta } from '../ui.js';
import { topo, irPara } from '../app.js';

/** Painel inicial. Cada papel enxerga os numeros que interessam a ele. */
export default async function paginaPainel() {
  const dados = await api.obter('/painel');
  const raiz = el('div');

  raiz.append(topo(
    `Bom treino, ${sessao.usuario.nome.split(' ')[0]}!`,
    `${dados.dia_semana}, ${dataBr(dados.hoje)}`,
  ));

  if (sessao.ehUm('dono', 'recepcao')) raiz.append(painelGestao(dados));
  if (sessao.papel === 'mestre') raiz.append(painelMestre(dados));
  if (sessao.papel === 'aluno') raiz.append(painelAluno(dados));

  raiz.append(el('div', { classe: 'grade col-2' }, [
    cartao('Aulas de hoje', listaAulasHoje(dados.aulas_hoje)),
    cartao('Ultimos avisos', listaAvisos(dados.avisos_recentes),
      el('button', { classe: 'botao pequeno secundario', texto: 'Ver todos', aoClicar: () => irPara('avisos') })),
  ]));

  return raiz;
}

function painelGestao(dados) {
  const financeiro = dados.financeiro || {};
  const indicadores = [
    indicador({ rotulo: 'Alunos ativos', valor: dados.alunos.ativos ?? 0, detalhe: `${dados.alunos.kids ?? 0} kids · ${dados.alunos.adultos ?? 0} adultos`, tipo: 'ok' }),
    indicador({ rotulo: 'Cadastros pendentes', valor: dados.alunos.pendentes ?? 0, detalhe: 'Aguardando matricula', tipo: dados.alunos.pendentes ? 'alerta' : '' }),
    indicador({ rotulo: 'Turmas ativas', valor: dados.turmas_ativas, detalhe: `${dados.aulas_hoje.length} aula(s) hoje`, tipo: 'info' }),
    indicador({ rotulo: 'A receber no mes', valor: moeda(financeiro.a_receber ?? 0), detalhe: 'Mensalidades em aberto', tipo: 'alerta' }),
  ];

  if (sessao.papel === 'dono') {
    indicadores.push(
      indicador({ rotulo: 'Receitas do mes', valor: moeda(financeiro.receitas ?? 0), tipo: 'ok' }),
      indicador({ rotulo: 'Despesas do mes', valor: moeda(financeiro.despesas ?? 0), tipo: 'erro' }),
      indicador({
        rotulo: 'Saldo do mes',
        valor: moeda(financeiro.saldo ?? 0),
        detalhe: (financeiro.saldo ?? 0) >= 0 ? 'No azul' : 'No vermelho',
        tipo: (financeiro.saldo ?? 0) >= 0 ? 'ok' : 'erro',
      }),
    );
  }
  indicadores.push(indicador({
    rotulo: 'Inadimplencia',
    valor: moeda(financeiro.inadimplencia?.total ?? 0),
    detalhe: `${financeiro.inadimplencia?.quantidade ?? 0} mensalidade(s) atrasada(s)`,
    tipo: (financeiro.inadimplencia?.quantidade ?? 0) > 0 ? 'erro' : '',
  }));

  const porModalidade = dados.por_modalidade.filter((m) => m.alunos > 0);
  const maior = Math.max(1, ...porModalidade.map((m) => m.alunos));

  return el('div', {}, [
    el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, indicadores),
    cartao('Alunos por modalidade', porModalidade.length
      ? el('div', {}, porModalidade.map((item) => el('div', { estilo: 'margin-bottom:.7rem' }, [
        el('div', { estilo: 'display:flex;justify-content:space-between;font-size:.88rem' }, [
          el('span', { texto: item.modalidade }),
          el('strong', { texto: String(item.alunos) }),
        ]),
        el('div', { classe: 'barra-fundo' }, [
          el('span', { estilo: `width:${(item.alunos / maior) * 100}%;background:${item.cor || '#e03131'}` }),
        ]),
      ])))
      : vazio('Vincule alunos as turmas para ver a distribuicao.')),
  ]);
}

function painelMestre(dados) {
  return el('div', {}, [
    el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
      indicador({ rotulo: 'Minhas turmas', valor: dados.minhas_turmas.length, tipo: 'info' }),
      indicador({ rotulo: 'Meus alunos', valor: dados.total_alunos, tipo: 'ok' }),
      indicador({ rotulo: 'Aulas hoje', valor: dados.aulas_hoje.length, detalhe: dados.dia_semana }),
    ]),
    cartao('Minhas turmas', dados.minhas_turmas.length
      ? tabela(['Turma', 'Modalidade', 'Categoria', 'Alunos'],
        dados.minhas_turmas.map((t) => [t.nome, t.modalidade, t.categoria, String(t.total_alunos)]))
      : vazio('Voce ainda nao e responsavel por nenhuma turma.'),
    el('button', { classe: 'botao pequeno secundario', texto: 'Fazer chamada', aoClicar: () => irPara('chamada') })),
  ]);
}

function painelAluno(dados) {
  const aluno = dados.aluno || {};
  return el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
    indicador({ rotulo: 'Situacao', valor: aluno.status ?? '-', tipo: aluno.status === 'ativo' ? 'ok' : 'alerta' }),
    indicador({ rotulo: 'Categoria', valor: aluno.categoria ?? '-', tipo: 'info' }),
    indicador({ rotulo: 'Aulas hoje na academia', valor: dados.aulas_hoje.length, detalhe: dados.dia_semana }),
  ]);
}

function listaAulasHoje(aulas) {
  if (!aulas.length) return vazio('Nenhuma aula marcada para hoje.');
  return el('div', {}, aulas.map((aula) => el('div', {
    classe: 'aula',
    estilo: `border-left-color:${aula.modalidade_cor || '#e03131'}`,
  }, [
    el('div', { classe: 'hora', texto: `${aula.hora_inicio} - ${aula.hora_fim}` }),
    el('div', { classe: 'turma', texto: `${aula.modalidade} · ${aula.turma}` }),
    el('div', { classe: 'info', texto: [aula.mestre || 'sem mestre definido', aula.local, `${aula.total_alunos} aluno(s)`].filter(Boolean).join(' · ') }),
    sessao.ehUm('dono', 'mestre', 'recepcao')
      ? el('div', { classe: 'info', texto: `Presentes hoje: ${aula.presentes}` })
      : null,
  ])));
}

function listaAvisos(avisos) {
  if (!avisos.length) return vazio('Nenhum aviso publicado.');
  return el('div', {}, avisos.map((item) => el('div', { estilo: 'padding:.5rem 0;border-bottom:1px solid var(--borda)' }, [
    el('div', { classe: 'acoes', estilo: 'margin-bottom:.25rem' }, [
      item.fixado ? etiqueta('fixado', 'alerta') : null,
      etiqueta(item.tipo, 'info'),
      item.data_evento ? etiqueta(dataBr(item.data_evento), 'neutra') : null,
    ]),
    el('strong', { texto: item.titulo }),
  ])));
}
