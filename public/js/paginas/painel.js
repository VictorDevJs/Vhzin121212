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
    {
      aluno: 'Este é o resumo do seu treino: as aulas de hoje, a sua frequência e o que a academia precisa te avisar.',
      mestre: 'Este é o retrato das suas turmas: quem treina hoje, quem parou de aparecer, quem já pode graduar '
        + 'e o que precisa da sua atenção agora.',
      recepcao: 'Este é o retrato do dia da academia: quem treina hoje, quem está devendo, quem sumiu do treino '
        + 'e o que precisa da sua atenção agora.',
    }[sessao.papel]
      || 'Este é o retrato do dia da academia: quem treina hoje, o que entrou no caixa, quem sumiu do treino '
        + 'e o que precisa da sua atenção agora.',
  ]));

  // A lista de trabalho vem antes dos números: é o que a pessoa faz hoje.
  if ((dados.pendencias || []).length) raiz.append(centralDePendencias(dados.pendencias));

  if (sessao.ehUm('dono', 'recepcao')) raiz.append(...painelGestao(dados));
  if (sessao.papel === 'mestre') raiz.append(...painelMestre(dados));
  if (sessao.papel === 'aluno') raiz.append(painelAluno(dados));

  if (!sessao.ehUm('aluno')) raiz.append(...blocosDeTrabalho(dados));

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

/* ------------------------------------------------- central de pendências */

const SINAL = { critico: 'critico', atencao: 'atencao', '': 'neutra' };

/**
 * O que precisa de decisão hoje, com o caminho para resolver.
 * Cada linha leva direto para a tela onde o problema se resolve.
 */
function centralDePendencias(lista) {
  const criticos = lista.filter((p) => p.gravidade === 'critico')
    .reduce((soma, p) => soma + p.quantidade, 0);

  return cartao(
    criticos ? `Precisa da sua atenção · ${criticos} urgente(s)` : 'Precisa da sua atenção',
    el('div', { classe: 'lista-pendencias' }, lista.map((item) => el('button', {
      classe: `linha-pendencia ${item.gravidade}`, type: 'button',
      aoClicar: () => irPara(item.tela),
    }, [
      el('span', { classe: 'contagem-pendencia', texto: String(item.quantidade) }),
      el('span', { classe: 'texto-pendencia' }, [
        el('strong', { texto: item.titulo }),
        el('span', { classe: 'dica', texto: item.detalhe }),
      ]),
      el('span', { classe: 'seta-pendencia' }, [icone('externo', 15)]),
    ]))),
  );
}

/* --------------------------------------------------- blocos de trabalho */

/** Os quadros que valem para a equipe toda, cada um no recorte da pessoa. */
function blocosDeTrabalho(dados) {
  const blocos = [];

  blocos.push(el('div', { classe: 'grade col-2' }, [
    cartao(`Sumiram do treino (${(dados.alunos_sumidos || []).length})`,
      listaSumidos(dados.alunos_sumidos || [], dados.dias_sumido || 14),
      el('button', { classe: 'botao pequeno secundario', texto: 'Ver contas',
        aoClicar: () => irPara(sessao.ehUm('dono', 'recepcao') ? 'contas' : 'alunos') })),

    cartao(`No tempo de graduar (${(dados.aptos_graduacao || []).length})`,
      listaAptos(dados.aptos_graduacao || []),
      el('button', { classe: 'botao pequeno secundario', texto: 'Graduações',
        aoClicar: () => irPara('graduacoes') })),
  ]));

  blocos.push(el('div', { classe: 'grade col-2' }, [
    cartao('Pulso da semana', pulsoDaSemana(dados.frequencia_semana || [])),
    cartao(`Próximos campeonatos (${(dados.proximas_competicoes || []).length})`,
      listaCompeticoes(dados.proximas_competicoes || []),
      el('button', { classe: 'botao pequeno secundario', texto: 'Competições',
        aoClicar: () => irPara('competicoes') })),
  ]));

  blocos.push(cartao('Ocupação das turmas', ocupacaoTurmas(dados.ocupacao_turmas || []),
    el('button', { classe: 'botao pequeno secundario', texto: 'Turmas',
      aoClicar: () => irPara('turmas') })));

  return blocos;
}

function listaSumidos(lista, dias) {
  if (!lista.length) return vazio(`Ninguém parado há mais de ${dias} dias. A turma está aparecendo.`);
  return el('div', { classe: 'tabela-texto' }, [tabela(
    ['Aluno', 'Sem treinar há', ''],
    lista.map((a) => [
      celulaComApoio(a.nome, a.modalidade || 'sem turma'),
      `${a.dias_sem_treinar} dias · ${dataBr(a.ultimo_treino)}`,
      chamarNoZap(a, `Oi, ${a.nome.split(' ')[0]}! Sentimos sua falta no treino. `
        + 'Está tudo bem? A gente te espera no tatame.'),
    ]),
  )]);
}

function listaAptos(lista) {
  if (!lista.length) return vazio('Ninguém fechou o tempo mínimo de faixa ainda.');
  return el('div', { classe: 'tabela-texto' }, [tabela(
    ['Aluno', 'Faixa atual', 'Próxima faixa'],
    lista.map((a) => [
      celulaComApoio(a.nome, `${Math.floor(a.dias_na_faixa / 30)} meses na faixa (mín. ${a.meses_minimos})`),
      el('span', { classe: 'etiqueta neutra' }, [
        el('span', { classe: 'ponto', estilo: `background:${a.graduacao_cor || 'var(--marca-1)'}` }),
        `${a.graduacao}${a.grau ? ` ${a.grau}º` : ''}`,
      ]),
      a.proxima_faixa || 'topo da escala',
    ]),
  )]);
}

/** Sete barras, uma por dia: dá para ver o buraco da semana num relance. */
function pulsoDaSemana(dias) {
  if (!dias.length) return vazio('Sem check-in nos últimos sete dias.');
  const maior = Math.max(1, ...dias.map((d) => d.checkins));
  const total = dias.reduce((soma, d) => soma + d.checkins, 0);

  return el('div', {}, [
    el('div', { classe: 'pulso-semana' }, dias.map((d) => el('div', { classe: 'coluna-pulso' }, [
      el('span', { classe: 'valor-pulso', texto: String(d.checkins) }),
      el('span', {
        classe: 'barra-pulso',
        estilo: `height:${Math.max(4, (d.checkins / maior) * 100)}%`,
        title: `${d.checkins} check-in(s) de ${d.alunos} aluno(s) em ${dataBr(d.data)}`,
      }),
      el('span', { classe: 'dia-pulso', texto: d.dia }),
    ]))),
    el('p', { classe: 'dica', estilo: 'margin:.8rem 0 0' },
      [`${total} treino(s) confirmado(s) nos últimos sete dias.`]),
  ]);
}

function listaCompeticoes(lista) {
  if (!lista.length) return vazio('Nenhum campeonato marcado à frente.');
  return el('div', { classe: 'tabela-texto' }, [tabela(
    ['Campeonato', 'Quando', 'Inscrição'],
    lista.map((c) => [
      celulaComApoio(c.nome, `${c.modalidade || 'geral'} · ${c.inscritos} atleta(s) inscrito(s)`),
      `${dataBr(c.data_inicio)} · em ${c.dias_para_comecar} dia(s)`,
      prazoDeInscricao(c),
    ]),
  )]);
}

function prazoDeInscricao(c) {
  if (c.inscricao_ate === null) return 'sem prazo definido';
  if (c.dias_para_fechar < 0) return etiqueta('encerrada', 'neutra');
  if (c.dias_para_fechar === 0) return etiqueta('fecha hoje', 'erro');
  if (c.dias_para_fechar <= 7) return etiqueta(`${c.dias_para_fechar} dia(s)`, 'alerta');
  return `até ${dataBr(c.inscricao_ate)}`;
}

/** Quem está lotando e quem está vazio: a base para remanejar horário. */
function ocupacaoTurmas(lista) {
  if (!lista.length) return vazio('Nenhuma turma ativa.');
  return el('div', { classe: 'lista-ocupacao' }, lista.map((t) => el('div', { classe: 'linha-ocupacao' }, [
    el('div', { classe: 'dados-ocupacao' }, [
      el('strong', { texto: t.turma }),
      el('span', { classe: 'dica', texto: `${t.modalidade}${t.mestre ? ` · ${t.mestre}` : ''}` }),
    ]),
    el('div', { classe: 'trilha-ocupacao' }, [
      el('span', {
        classe: `preenchido-ocupacao ${t.ocupacao >= 90 ? 'cheio' : ''}`,
        estilo: `width:${Math.min(100, t.ocupacao)}%;--cor-turma:${t.modalidade_cor || 'var(--marca-1)'}`,
      }),
    ]),
    el('div', { classe: 'numero-ocupacao' }, [
      el('strong', { texto: `${t.matriculados}/${t.capacidade}` }),
      el('span', { classe: 'dica', texto: t.vagas ? `${t.vagas} vaga(s)` : 'lotada' }),
    ]),
  ])));
}

/** Nome em destaque com uma linha de apoio: economiza uma coluna da tabela. */
function celulaComApoio(titulo, apoio) {
  return el('div', {}, [
    el('strong', { texto: titulo }),
    el('div', { classe: 'dica', texto: apoio }),
  ]);
}

function chamarNoZap(pessoa, mensagem) {
  const link = linkWhatsapp(pessoa.telefone, mensagem);
  if (!link) return '—';
  return el('a', { classe: 'botao pequeno secundario', href: link, target: '_blank', rel: 'noopener' },
    [icone('zap', 14), ' Chamar']);
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
    dados.movimento ? cartaoDeMovimento(dados.movimento) : null,
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

  return blocos.filter(Boolean);
}

/**
 * Cresceu ou caiu? Compara os últimos 30 dias com os 30 anteriores — mesma
 * quantidade de dias, para a conta não mentir no começo do mês.
 */
function cartaoDeMovimento(m) {
  const linha = (rotulo, dado, formatar = (v) => String(v)) => {
    const variacao = dado.variacao;
    const sobe = variacao !== null && variacao > 0;
    return el('div', { classe: 'linha-movimento' }, [
      el('span', { classe: 'rotulo-movimento', texto: rotulo }),
      el('strong', { classe: 'atual-movimento', texto: formatar(dado.atual) }),
      variacao === null
        ? el('span', { classe: 'dica', texto: 'sem base para comparar' })
        : el('span', { classe: `delta ${sobe ? 'sobe' : 'desce'}` }, [
          el('span', { texto: sobe ? '\u2191' : '\u2193' }),
          `${Math.abs(variacao)}%`,
        ]),
      el('span', { classe: 'dica', texto: `antes: ${formatar(dado.anterior)}` }),
    ]);
  };

  return cartao('Últimos 30 dias contra os 30 anteriores', el('div', { classe: 'quadro-movimento' }, [
    linha('Treinos confirmados', m.checkins),
    linha('Alunos que treinaram', m.alunos_treinando),
    linha('Matrículas novas', m.matriculas),
    m.receita ? linha('Receita', m.receita, moeda) : null,
    el('p', { classe: 'dica', estilo: 'margin:.6rem 0 0' },
      [`${dataBr(m.periodo.de)} a ${dataBr(m.periodo.ate)} · comparado com `
        + `${dataBr(m.periodo_anterior.de)} a ${dataBr(m.periodo_anterior.ate)}.`]),
  ]));
}

/* ------------------------------------------------------------- mestre */

function painelMestre(dados) {
  const turmas = dados.minhas_turmas || [];
  const treinaram = turmas.reduce((soma, t) => soma + (t.treinaram || 0), 0);
  const matriculados = turmas.reduce((soma, t) => soma + (t.matriculados || t.total_alunos || 0), 0);
  const presenca = matriculados ? Math.round((treinaram / matriculados) * 100) : null;

  return [
    el('div', { classe: 'grade-compacta', estilo: 'margin-bottom:1rem' }, [
      indicador({ rotulo: 'Minhas turmas', valor: String(turmas.length), tipo: 'destaque',
        detalhe: `${turmas.reduce((s, t) => s + (t.aulas_semana || 0), 0) || turmas.length} aula(s) por semana` }),
      indicador({ rotulo: 'Meus alunos', valor: String(dados.total_alunos), tipo: 'bom',
        detalhe: 'somando todas as turmas' }),
      indicador({ rotulo: 'Aulas hoje', valor: String(dados.aulas_hoje.length), detalhe: dados.dia_semana }),
      indicador({
        rotulo: 'Apareceram na semana', valor: presenca === null ? '—' : `${presenca}%`,
        detalhe: `${treinaram} de ${matriculados} aluno(s)`,
        tipo: presenca !== null && presenca >= 60 ? 'bom' : 'atencao',
      }),
      indicador({ rotulo: 'Prontos para graduar', valor: String((dados.aptos_graduacao || []).length),
        detalhe: 'fecharam o tempo de faixa', tipo: (dados.aptos_graduacao || []).length ? 'destaque' : '' }),
    ]),

    cartao('Minhas turmas', turmas.length
      ? el('div', { classe: 'tabela-texto' }, [tabela(
        ['Turma', 'Arte', 'Categoria', 'Alunos', 'Treinaram na semana'],
        turmas.map((t) => [
          el('strong', { texto: t.nome }),
          t.modalidade,
          t.categoria,
          String(t.matriculados ?? t.total_alunos ?? 0),
          celulaPresenca(t),
        ]),
      )])
      : vazio('Você ainda não é responsável por nenhuma turma.'),
    el('button', { classe: 'botao pequeno', texto: 'Fazer chamada', aoClicar: () => irPara('chamada') })),
  ];
}

/** Quantos dos matriculados apareceram na última semana, com o sinal na cor. */
function celulaPresenca(turma) {
  const matriculados = turma.matriculados ?? turma.total_alunos ?? 0;
  const treinaram = turma.treinaram ?? 0;
  if (!matriculados) return '—';
  const parte = Math.round((treinaram / matriculados) * 100);
  return el('span', {}, [
    etiqueta(`${treinaram}/${matriculados}`, parte >= 60 ? 'ok' : (parte >= 30 ? 'alerta' : 'erro')),
    el('span', { classe: 'dica', estilo: 'margin-left:.4rem', texto: `${parte}%` }),
  ]);
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
