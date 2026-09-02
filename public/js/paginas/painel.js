import { api, sessao } from '../api.js';
import { el, cartao, indicador, moeda, dataBr, tabela, vazio, etiqueta, competenciaBr } from '../ui.js';
import { barrasHorizontais, rosca, evolucao, sparkline, corDaSerie } from '../graficos.js';
import { linkWhatsapp } from '../whatsapp.js';
import { icone } from '../icones.js';
import { topo, irPara } from '../app.js';

/** Painel inicial, com os numeros que cada papel precisa ver primeiro. */
export default async function paginaPainel() {
  const dados = await api.obter('/painel');
  const raiz = el('div');
  const primeiroNome = sessao.usuario.nome.split(' ')[0];

  raiz.append(topo(
    `Bom treino, ${primeiroNome}`,
    `${dados.dia_semana}, ${dataBr(dados.hoje)}`,
    sessao.ehUm('dono', 'recepcao')
      ? [el('button', { classe: 'botao secundario', texto: 'Ver financeiro', aoClicar: () => irPara('financeiro') })]
      : [],
  ));

  raiz.append(el('p', { classe: 'explicacao' }, [
    icone('painel', 16),
    sessao.papel === 'aluno'
      ? 'Este é o resumo do seu treino: as aulas de hoje, a sua frequência e o que a academia precisa te avisar.'
      : 'Este é o retrato do dia da academia: quem treina hoje, o que entrou no caixa, quem está devendo e o que precisa da sua atenção agora.',
  ]));

  if (sessao.ehUm('dono', 'recepcao')) raiz.append(...painelGestao(dados));
  if (sessao.papel === 'mestre') raiz.append(...painelMestre(dados));
  if (sessao.papel === 'aluno') raiz.append(painelAluno(dados));

  if (sessao.ehUm('dono', 'recepcao') && (dados.aniversariantes || []).length) {
    raiz.append(cartao('Aniversariantes do mês', listaAniversariantes(dados.aniversariantes)));
  }

  raiz.append(el('div', { classe: 'grade col-2' }, [
    cartao('Aulas de hoje', listaAulasHoje(dados.aulas_hoje),
      el('button', { classe: 'botao pequeno secundario', texto: 'Grade completa', aoClicar: () => irPara('grade') })),
    cartao('Últimos avisos', listaAvisos(dados.avisos_recentes),
      el('button', { classe: 'botao pequeno secundario', texto: 'Ver todos', aoClicar: () => irPara('avisos') })),
  ]));

  return raiz;
}

/* ------------------------------------------------------- dono e recepção */

function painelGestao(dados) {
  const financeiro = dados.financeiro || {};
  const ehDono = sessao.papel === 'dono';
  const serieMatriculas = (dados.serie_matriculas || []).map((m) => m.total);
  const serieCaixa = dados.serie_caixa || [];

  const indicadores = [
    indicador({
      rotulo: 'Alunos ativos', valor: String(dados.alunos.ativos ?? 0), tipo: 'bom',
      detalhe: `${dados.alunos.kids ?? 0} kids · ${dados.alunos.adultos ?? 0} adultos`,
      extra: serieMatriculas.length > 1 ? sparkline({ valores: serieMatriculas, cor: 'var(--serie-3)' }) : null,
    }),
    indicador({
      rotulo: 'Pendentes', valor: String(dados.alunos.pendentes ?? 0),
      detalhe: dados.alunos.pendentes ? 'Confirme a matrícula' : 'Nada na fila',
      tipo: dados.alunos.pendentes ? 'atenção' : '',
    }),
    indicador({ rotulo: 'Turmas ativas', valor: String(dados.turmas_ativas), detalhe: `${dados.aulas_hoje.length} aula(s) hoje`, tipo: 'destaque' }),
    indicador({ rotulo: 'A receber', valor: moeda(financeiro.a_receber ?? 0), detalhe: 'Mensalidades em aberto', tipo: 'atenção' }),
  ];

  if (ehDono) {
    const saldo = financeiro.saldo ?? 0;
    indicadores.push(
      indicador({
        rotulo: 'Receitas do mês', valor: moeda(financeiro.receitas ?? 0), tipo: 'bom',
        extra: serieCaixa.length > 1 ? sparkline({ valores: serieCaixa.map((m) => m.receitas), cor: 'var(--serie-1)' }) : null,
      }),
      indicador({
        rotulo: 'Despesas do mês', valor: moeda(financeiro.despesas ?? 0), tipo: 'critico',
        extra: serieCaixa.length > 1 ? sparkline({ valores: serieCaixa.map((m) => m.despesas), cor: 'var(--serie-2)' }) : null,
      }),
      indicador({
        rotulo: 'Saldo do mês', valor: moeda(saldo), tipo: saldo >= 0 ? 'bom' : 'critico',
        delta: { valor: saldo >= 0 ? 'no azul' : 'no vermelho', sobe: saldo >= 0 },
      }),
    );
  }

  if (dados.avaliacoes_pendentes) {
    indicadores.push(indicador({
      rotulo: 'Avaliações na fila', valor: String(dados.avaliacoes_pendentes),
      detalhe: 'Aprove para publicar no site', tipo: 'atenção',
    }));
  }

  indicadores.push(indicador({
    rotulo: 'Inadimplência', valor: moeda(financeiro.inadimplencia?.total ?? 0),
    detalhe: `${financeiro.inadimplencia?.quantidade ?? 0} mensalidade(s) em atraso`,
    tipo: (financeiro.inadimplencia?.quantidade ?? 0) > 0 ? 'critico' : '',
  }));

  const porModalidade = (dados.por_modalidade || []).filter((m) => m.alunos > 0);
  const composicao = [
    { rotulo: 'Adultos', valor: dados.alunos.adultos ?? 0, cor: corDaSerie(0) },
    { rotulo: 'Kids', valor: dados.alunos.kids ?? 0, cor: corDaSerie(2) },
  ];

  const blocos = [
    el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, indicadores),
    el('div', { classe: 'grade col-2' }, [
      cartao('Alunos por modalidade', porModalidade.length
        ? barrasHorizontais({
          dados: porModalidade.map((item) => ({ rotulo: item.modalidade, valor: item.alunos, cor: item.cor, legenda: 'alunos' })),
          formatar: (v) => `${v}`,
        })
        : vazio('Vincule alunos as turmas para ver a distribuicao.')),
      cartao('Composição da base', (dados.alunos.ativos ?? 0)
        ? rosca({ dados: composicao, titulo: 'alunos ativos', formatar: (v) => `${v}` })
        : vazio('Nenhum aluno ativo ainda.')),
    ]),
  ];

  if (ehDono && serieCaixa.length) {
    blocos.push(cartao('Entradas e saídas dos últimos meses', evolucao({
      pontos: serieCaixa.map((mes) => ({ x: competenciaBr(mes.competencia), valores: [mes.receitas, mes.despesas] })),
      series: [{ nome: 'Entradas', cor: 'var(--serie-1)' }, { nome: 'Saídas', cor: 'var(--serie-2)' }],
    })));
  }

  return blocos;
}

/* ------------------------------------------------------------- mestre */

function painelMestre(dados) {
  return [
    el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
      indicador({ rotulo: 'Minhas turmas', valor: String(dados.minhas_turmas.length), tipo: 'destaque' }),
      indicador({ rotulo: 'Meus alunos', valor: String(dados.total_alunos), tipo: 'bom' }),
      indicador({ rotulo: 'Aulas hoje', valor: String(dados.aulas_hoje.length), detalhe: dados.dia_semana }),
    ]),
    cartao('Minhas turmas', dados.minhas_turmas.length
      ? tabela(['Turma', 'Modalidade', 'Categoria', 'Alunos'],
        dados.minhas_turmas.map((t) => [t.nome, t.modalidade, t.categoria, String(t.total_alunos)]))
      : vazio('Você ainda não e responsável por nenhuma turma.'),
    el('button', { classe: 'botao pequeno', texto: 'Fazer chamada', aoClicar: () => irPara('chamada') })),
  ];
}

/* -------------------------------------------------------------- aluno */

function painelAluno(dados) {
  const aluno = dados.aluno || {};
  return el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
    indicador({ rotulo: 'Situação', valor: aluno.status ?? '-', tipo: aluno.status === 'ativo' ? 'bom' : 'atencao' }),
    indicador({ rotulo: 'Categoria', valor: aluno.categoria ?? '-', tipo: 'destaque' }),
    indicador({ rotulo: 'Aulas hoje', valor: String(dados.aulas_hoje.length), detalhe: dados.dia_semana }),
  ]);
}

/* ------------------------------------------------------------- listas */

function listaAulasHoje(aulas) {
  if (!aulas.length) return vazio('Nenhuma aula marcada para hoje.');
  return el('div', {}, aulas.map((aula) => el('div', {
    classe: 'aula', estilo: `border-left-color:${aula.modalidade_cor || 'var(--marca-1)'}`,
  }, [
    el('div', { estilo: 'display:flex;justify-content:space-between;gap:.5rem;align-items:center' }, [
      el('span', { classe: 'hora', texto: `${aula.hora_inicio} - ${aula.hora_fim}` }),
      sessao.ehUm('dono', 'mestre', 'recepcao')
        ? etiqueta(`${aula.presentes}/${aula.total_alunos} presentes`, aula.presentes ? 'bom' : 'neutra')
        : null,
    ]),
    el('div', { texto: `${aula.modalidade} · ${aula.turma}` }),
    el('div', { classe: 'info', texto: [aula.mestre || 'sem mestre definido', aula.local].filter(Boolean).join(' · ') }),
  ])));
}

/** Lembrete de relacionamento: quem faz aniversário este mês. */
function listaAniversariantes(lista) {
  const hoje = new Date().getDate();
  return el('div', { classe: 'acoes' }, lista.map((pessoa) => {
    const link = linkWhatsapp(pessoa.telefone,
      `Parabens, ${pessoa.nome.split(' ')[0]}! A equipe da Atak deseja um otimo aniversario. Bons treinos!`);
    const conteudo = [
      el('strong', { texto: pessoa.nome }),
      el('span', { classe: 'dica', texto: `dia ${String(pessoa.dia).padStart(2, '0')}` }),
      pessoa.dia === hoje ? etiqueta('hoje', 'bom') : null,
    ];
    const estilo = 'display:flex;gap:.5rem;align-items:center;background:var(--superficie-2);'
      + 'border:1px solid var(--borda);border-radius:var(--raio-pilula);padding:.35rem .8rem;font-size:.85rem';
    return link
      ? el('a', { href: link, target: '_blank', rel: 'noopener', estilo, classe: 'aniversariante' }, conteudo)
      : el('span', { estilo }, conteudo);
  }));
}

const ROTULO_AVISO = {
  geral: 'Aviso', campeonato: 'Campeonato', evento: 'Evento',
  cancelamento: 'Sem aula', manutencao: 'Manutenção', graduacao: 'Exame de faixa',
};

function listaAvisos(avisos) {
  if (!avisos.length) return vazio('Nenhum aviso publicado.');
  return el('div', {}, avisos.map((item) => el('div', {
    estilo: 'padding:.6rem 0;border-bottom:1px solid var(--borda)',
  }, [
    el('div', { classe: 'acoes', estilo: 'margin-bottom:.25rem' }, [
      item.fixado ? etiqueta('fixado', 'atencao') : null,
      etiqueta(ROTULO_AVISO[item.tipo] || item.tipo, 'marca'),
      item.data_evento ? etiqueta(dataBr(item.data_evento), 'neutra') : null,
    ]),
    el('strong', { texto: item.titulo }),
  ])));
}
