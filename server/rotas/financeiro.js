import { Router } from 'express';
import { todos, um, executar, transacao } from '../db.js';
import { exigirPapel, GESTAO } from '../auth.js';
import {
  rota, ErroApi, exigirCampos, texto, numero, inteiro, data, hoje, competenciaAtual,
} from '../util.js';

const roteador = Router();

export const CATEGORIAS_RECEITA = ['mensalidade', 'matricula', 'exame de faixa', 'produtos', 'evento', 'aula avulsa', 'outros'];
export const CATEGORIAS_DESPESA = ['aluguel', 'salarios', 'agua/luz/internet', 'equipamentos', 'manutencao', 'marketing', 'impostos', 'outros'];

/** Somente o dono enxerga despesas e o resultado consolidado. */
function somenteDono(req) {
  if (req.usuario.papel !== 'dono') {
    throw new ErroApi('Apenas o dono da academia tem acesso a esta informação.', 403);
  }
}

// ----------------- Lancamentos (todo dinheiro que entra e sai) -----------------

roteador.get('/lancamentos', exigirPapel(...GESTAO), rota((req, res) => {
  const filtros = [];
  const params = {};
  const de = data(req.query.de, `${competenciaAtual()}-01`);
  const ate = data(req.query.ate, hoje());
  filtros.push('l.data BETWEEN :de AND :ate');
  params.de = de;
  params.ate = ate;

  if (texto(req.query.tipo)) { filtros.push('l.tipo = :tipo'); params.tipo = texto(req.query.tipo); }
  if (texto(req.query.categoria)) { filtros.push('l.categoria = :categoria'); params.categoria = texto(req.query.categoria); }
  // A recepcao acompanha apenas as entradas.
  if (req.usuario.papel !== 'dono') filtros.push(`l.tipo = 'receita'`);

  const lista = todos(`
    SELECT l.*, a.nome AS aluno, u.nome AS registrado_por_nome
    FROM lancamentos l
    LEFT JOIN alunos a ON a.id = l.aluno_id
    LEFT JOIN usuarios u ON u.id = l.registrado_por
    WHERE ${filtros.join(' AND ')}
    ORDER BY l.data DESC, l.id DESC
  `, params);

  const totais = lista.reduce((acc, l) => {
    if (l.tipo === 'receita') acc.receitas += l.valor; else acc.despesas += l.valor;
    return acc;
  }, { receitas: 0, despesas: 0 });

  res.json({ periodo: { de, ate }, totais: { ...totais, saldo: totais.receitas - totais.despesas }, lancamentos: lista });
}));

roteador.post('/lancamentos', exigirPapel(...GESTAO), rota((req, res) => {
  exigirCampos(req.body, ['tipo', 'categoria', 'descricao', 'valor']);
  const tipo = texto(req.body.tipo);
  if (!['receita', 'despesa'].includes(tipo)) throw new ErroApi('Tipo deve ser receita ou despesa.');
  if (tipo === 'despesa') somenteDono(req);

  const valor = numero(req.body.valor, -1);
  if (valor < 0) throw new ErroApi('Informe um valor válido.');

  const criado = executar(`
    INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, forma_pagamento, aluno_id, registrado_por)
    VALUES (:tipo, :categoria, :descricao, :valor, :data, :forma_pagamento, :aluno_id, :registrado_por)
  `, {
    tipo,
    categoria: texto(req.body.categoria),
    descricao: texto(req.body.descricao),
    valor,
    data: data(req.body.data, hoje()),
    forma_pagamento: texto(req.body.forma_pagamento),
    aluno_id: inteiro(req.body.aluno_id),
    registrado_por: req.usuario.id,
  });
  res.status(201).json(um('SELECT * FROM lancamentos WHERE id = :id', { id: Number(criado.lastInsertRowid) }));
}));

roteador.delete('/lancamentos/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const lancamento = um('SELECT * FROM lancamentos WHERE id = :id', { id });
  if (!lancamento) throw new ErroApi('Lançamento não encontrado.', 404);
  transacao(() => {
    // Estornar o pagamento devolve a mensalidade para o estado pendente.
    if (lancamento.mensalidade_id) {
      executar(`UPDATE mensalidades SET status = 'pendente', pago_em = NULL, forma_pagamento = NULL
                WHERE id = :id`, { id: lancamento.mensalidade_id });
    }
    executar('DELETE FROM lancamentos WHERE id = :id', { id });
  });
  res.json({ mensagem: 'Lançamento removido.' });
}));

// ----------------- Mensalidades -----------------

const SELECT_MENSALIDADE = `
  SELECT me.*, a.nome AS aluno, a.categoria, a.telefone,
         CASE WHEN me.status = 'pendente' AND me.vencimento < date('now','localtime') THEN 1 ELSE 0 END AS atrasada
  FROM mensalidades me JOIN alunos a ON a.id = me.aluno_id
`;

roteador.get('/mensalidades', exigirPapel(...GESTAO), rota((req, res) => {
  const filtros = [];
  const params = {};
  if (texto(req.query.competencia)) { filtros.push('me.competencia = :competencia'); params.competencia = texto(req.query.competencia); }
  if (texto(req.query.status)) { filtros.push('me.status = :status'); params.status = texto(req.query.status); }
  if (inteiro(req.query.aluno_id)) { filtros.push('me.aluno_id = :aluno_id'); params.aluno_id = inteiro(req.query.aluno_id); }
  if (texto(req.query.atrasadas) === '1') filtros.push(`me.status = 'pendente' AND me.vencimento < date('now','localtime')`);

  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const lista = todos(`${SELECT_MENSALIDADE} ${onde} ORDER BY me.vencimento DESC, a.nome`, params);
  const totais = lista.reduce((acc, m) => {
    if (m.status === 'pago') acc.recebido += m.valor;
    else if (m.status === 'pendente') acc.a_receber += m.valor;
    if (m.atrasada) acc.atrasado += m.valor;
    return acc;
  }, { recebido: 0, a_receber: 0, atrasado: 0 });
  res.json({ totais, mensalidades: lista });
}));

/** Gera as mensalidades do mes para todas as matriculas ativas. */
roteador.post('/mensalidades/gerar', exigirPapel(...GESTAO), rota((req, res) => {
  const competencia = texto(req.body?.competencia, competenciaAtual());
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new ErroApi('Competência inválida. Use AAAA-MM.');

  const matriculas = todos(`SELECT * FROM matriculas WHERE status = 'ativa'`);
  let criadas = 0;
  transacao(() => {
    for (const matricula of matriculas) {
      const existe = um('SELECT id FROM mensalidades WHERE aluno_id = :a AND competencia = :c',
        { a: matricula.aluno_id, c: competencia });
      if (existe) continue;
      executar(`
        INSERT INTO mensalidades (matricula_id, aluno_id, competencia, vencimento, valor, status)
        VALUES (:matricula_id, :aluno_id, :competencia, :vencimento, :valor, 'pendente')
      `, {
        matricula_id: matricula.id,
        aluno_id: matricula.aluno_id,
        competencia,
        vencimento: `${competencia}-${String(matricula.dia_vencimento).padStart(2, '0')}`,
        valor: matricula.valor,
      });
      criadas += 1;
    }
  });
  res.json({ mensagem: `${criadas} mensalidade(s) gerada(s) para ${competencia}.`, criadas, competencia });
}));

roteador.post('/mensalidades', exigirPapel(...GESTAO), rota((req, res) => {
  exigirCampos(req.body, ['aluno_id', 'competencia', 'valor']);
  const alunoId = inteiro(req.body.aluno_id);
  const competencia = texto(req.body.competencia);
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new ErroApi('Competência inválida. Use AAAA-MM.');
  if (um('SELECT id FROM mensalidades WHERE aluno_id = :a AND competencia = :c', { a: alunoId, c: competencia })) {
    throw new ErroApi('Este aluno já tem mensalidade nesta competência.', 409);
  }
  const matricula = um(`SELECT id FROM matriculas WHERE aluno_id = :a AND status = 'ativa' ORDER BY id DESC LIMIT 1`,
    { a: alunoId });
  const criada = executar(`
    INSERT INTO mensalidades (matricula_id, aluno_id, competencia, vencimento, valor, status, observacao)
    VALUES (:matricula_id, :aluno_id, :competencia, :vencimento, :valor, 'pendente', :observacao)
  `, {
    matricula_id: matricula?.id ?? null,
    aluno_id: alunoId,
    competencia,
    vencimento: data(req.body.vencimento, `${competencia}-10`),
    valor: numero(req.body.valor),
    observacao: texto(req.body.observacao),
  });
  res.status(201).json(um(`${SELECT_MENSALIDADE} WHERE me.id = :id`, { id: Number(criada.lastInsertRowid) }));
}));

/** Baixa do pagamento: marca como paga e lanca a receita no financeiro. */
roteador.post('/mensalidades/:id/pagar', exigirPapel(...GESTAO), rota((req, res) => {
  const id = inteiro(req.params.id);
  const mensalidade = um('SELECT * FROM mensalidades WHERE id = :id', { id });
  if (!mensalidade) throw new ErroApi('Mensalidade não encontrada.', 404);
  if (mensalidade.status === 'pago') throw new ErroApi('Esta mensalidade já foi paga.', 409);

  const pagoEm = data(req.body?.pago_em, hoje());
  const valor = numero(req.body?.valor, mensalidade.valor);
  const forma = texto(req.body?.forma_pagamento, 'dinheiro');
  const aluno = um('SELECT nome FROM alunos WHERE id = :id', { id: mensalidade.aluno_id });

  transacao(() => {
    executar(`UPDATE mensalidades SET status = 'pago', pago_em = :pago_em, forma_pagamento = :forma, valor = :valor
              WHERE id = :id`, { id, pago_em: pagoEm, forma, valor });
    executar(`
      INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, forma_pagamento, aluno_id, mensalidade_id, registrado_por)
      VALUES ('receita', 'mensalidade', :descricao, :valor, :data, :forma, :aluno_id, :mensalidade_id, :registrado_por)
    `, {
      descricao: `Mensalidade ${mensalidade.competencia} - ${aluno?.nome ?? 'aluno'}`,
      valor,
      data: pagoEm,
      forma,
      aluno_id: mensalidade.aluno_id,
      mensalidade_id: id,
      registrado_por: req.usuario.id,
    });
  });
  res.json(um(`${SELECT_MENSALIDADE} WHERE me.id = :id`, { id }));
}));

roteador.delete('/mensalidades/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const apagada = executar(`UPDATE mensalidades SET status = 'cancelado' WHERE id = :id`, { id });
  if (!apagada.changes) throw new ErroApi('Mensalidade não encontrada.', 404);
  res.json({ mensagem: 'Mensalidade cancelada.' });
}));

// ----------------- Relatorios -----------------

/**
 * Acompanhamento das mensalidades por arte marcial e por turma.
 * Como um aluno pode treinar mais de uma modalidade, o valor da mensalidade e
 * rateado em partes iguais entre as modalidades dele - assim a soma das linhas
 * bate com o faturamento total, sem contar o mesmo dinheiro duas vezes.
 */
roteador.get('/por-modalidade', exigirPapel(...GESTAO), rota((req, res) => {
  const competencia = texto(req.query.competencia, competenciaAtual());

  const mensalidades = todos(`
    SELECT me.id, me.aluno_id, me.valor, me.status, me.vencimento, a.nome AS aluno
    FROM mensalidades me JOIN alunos a ON a.id = me.aluno_id
    WHERE me.competencia = :competencia AND me.status != 'cancelado'
  `, { competencia });

  const vinculos = todos(`
    SELECT at.aluno_id, t.id AS turma_id, t.nome AS turma,
           m.id AS modalidade_id, m.nome AS modalidade, m.cor
    FROM aluno_turmas at
    JOIN turmas t ON t.id = at.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
  `);

  const porAluno = new Map();
  for (const vinculo of vinculos) {
    if (!porAluno.has(vinculo.aluno_id)) porAluno.set(vinculo.aluno_id, []);
    porAluno.get(vinculo.aluno_id).push(vinculo);
  }

  const hojeISO = hoje();
  const modalidades = new Map();
  const turmas = new Map();
  const semTurma = { modalidade: 'Sem turma definida', cor: null, previsto: 0, recebido: 0, em_aberto: 0, atrasado: 0, alunos: new Set() };

  function acumular(mapa, chave, base, valor, mensalidade) {
    if (!mapa.has(chave)) mapa.set(chave, { ...base, previsto: 0, recebido: 0, em_aberto: 0, atrasado: 0, alunos: new Set(), inadimplentes: new Set() });
    const linha = mapa.get(chave);
    linha.previsto += valor;
    linha.alunos.add(mensalidade.aluno_id);
    if (mensalidade.status === 'pago') linha.recebido += valor;
    else {
      linha.em_aberto += valor;
      if (mensalidade.vencimento < hojeISO) {
        linha.atrasado += valor;
        linha.inadimplentes.add(mensalidade.aluno_id);
      }
    }
  }

  for (const mensalidade of mensalidades) {
    const doAluno = porAluno.get(mensalidade.aluno_id) || [];
    const modalidadesDoAluno = [...new Map(doAluno.map((v) => [v.modalidade_id, v])).values()];

    if (!modalidadesDoAluno.length) {
      semTurma.previsto += mensalidade.valor;
      semTurma.alunos.add(mensalidade.aluno_id);
      if (mensalidade.status === 'pago') semTurma.recebido += mensalidade.valor;
      else {
        semTurma.em_aberto += mensalidade.valor;
        if (mensalidade.vencimento < hojeISO) semTurma.atrasado += mensalidade.valor;
      }
      continue;
    }

    const fatiaModalidade = mensalidade.valor / modalidadesDoAluno.length;
    for (const vinculo of modalidadesDoAluno) {
      acumular(modalidades, vinculo.modalidade_id,
        { modalidade_id: vinculo.modalidade_id, modalidade: vinculo.modalidade, cor: vinculo.cor },
        fatiaModalidade, mensalidade);
    }

    const fatiaTurma = mensalidade.valor / doAluno.length;
    for (const vinculo of doAluno) {
      acumular(turmas, vinculo.turma_id,
        { turma_id: vinculo.turma_id, turma: vinculo.turma, modalidade: vinculo.modalidade, cor: vinculo.cor },
        fatiaTurma, mensalidade);
    }
  }

  const materializar = (mapa) => [...mapa.values()]
    .map((linha) => ({
      ...linha,
      previsto: Number(linha.previsto.toFixed(2)),
      recebido: Number(linha.recebido.toFixed(2)),
      em_aberto: Number(linha.em_aberto.toFixed(2)),
      atrasado: Number(linha.atrasado.toFixed(2)),
      alunos: linha.alunos.size,
      inadimplentes: linha.inadimplentes.size,
    }))
    .sort((a, b) => b.previsto - a.previsto);

  res.json({
    competencia,
    modalidades: materializar(modalidades),
    turmas: materializar(turmas),
    sem_turma: semTurma.previsto > 0
      ? { ...semTurma, alunos: semTurma.alunos.size, previsto: Number(semTurma.previsto.toFixed(2)) }
      : null,
    total_previsto: mensalidades.reduce((soma, m) => soma + m.valor, 0),
  });
}));

roteador.get('/resumo', exigirPapel(...GESTAO), rota((req, res) => {
  somenteDono(req);
  const competencia = texto(req.query.competencia, competenciaAtual());
  const de = `${competencia}-01`;
  const ate = `${competencia}-31`;

  const porTipo = todos(`
    SELECT tipo, SUM(valor) AS total, COUNT(*) AS quantidade
    FROM lancamentos WHERE data BETWEEN :de AND :ate GROUP BY tipo
  `, { de, ate });
  const receitas = porTipo.find((t) => t.tipo === 'receita')?.total ?? 0;
  const despesas = porTipo.find((t) => t.tipo === 'despesa')?.total ?? 0;

  const porCategoria = todos(`
    SELECT tipo, categoria, SUM(valor) AS total FROM lancamentos
    WHERE data BETWEEN :de AND :ate GROUP BY tipo, categoria ORDER BY total DESC
  `, { de, ate });

  const inadimplencia = um(`
    SELECT COUNT(*) AS quantidade, COALESCE(SUM(valor), 0) AS total FROM mensalidades
    WHERE status = 'pendente' AND vencimento < date('now','localtime')
  `);

  const aReceber = um(`
    SELECT COUNT(*) AS quantidade, COALESCE(SUM(valor), 0) AS total FROM mensalidades
    WHERE status = 'pendente' AND competencia = :competencia
  `, { competencia });

  // Evolucao dos ultimos 6 meses para o grafico.
  const evolucao = todos(`
    SELECT substr(data, 1, 7) AS competencia,
           COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0) AS receitas,
           COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor END), 0) AS despesas
    FROM lancamentos
    WHERE data >= date('now','localtime','-5 months','start of month')
    GROUP BY competencia ORDER BY competencia
  `);

  res.json({
    competencia,
    receitas,
    despesas,
    saldo: receitas - despesas,
    por_categoria: porCategoria,
    inadimplencia,
    a_receber: aReceber,
    evolucao,
    categorias: { receita: CATEGORIAS_RECEITA, despesa: CATEGORIAS_DESPESA },
  });
}));

export default roteador;
