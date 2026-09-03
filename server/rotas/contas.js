import { Router } from 'express';
import { todos, um } from '../db.js';
import { exigirPapel } from '../auth.js';
import { rota, ErroApi, texto, inteiro, hoje, competenciaAtual } from '../util.js';

const roteador = Router();

/**
 * Central de contas dos alunos, para dono e recepção.
 *
 * É a mesma "Minha área" que o aluno vê, mas de fora: todas as contas
 * divididas por arte marcial, com a situação de pagamento calculada na hora.
 */

/** Situação financeira do aluno, decidida pelas mensalidades e pelo vencimento. */
function situacaoDePagamento(alunoId) {
  const hojeISO = hoje();
  const resumo = um(`
    SELECT
      SUM(CASE WHEN status = 'pendente' AND vencimento < :hoje THEN 1 ELSE 0 END) AS atrasadas,
      SUM(CASE WHEN status = 'pendente' AND vencimento < :hoje THEN valor ELSE 0 END) AS valor_atrasado,
      SUM(CASE WHEN status = 'pendente' AND vencimento >= :hoje THEN 1 ELSE 0 END) AS a_vencer,
      MIN(CASE WHEN status = 'pendente' THEN vencimento END) AS proximo_vencimento,
      MAX(CASE WHEN status = 'pago' THEN pago_em END) AS ultimo_pagamento
    FROM mensalidades WHERE aluno_id = :id
  `, { id: alunoId, hoje: hojeISO });

  const matricula = um(`
    SELECT mt.*, p.nome AS plano, p.valor AS valor_plano
    FROM matriculas mt JOIN planos p ON p.id = mt.plano_id
    WHERE mt.aluno_id = :id AND mt.status = 'ativa' ORDER BY mt.id DESC LIMIT 1
  `, { id: alunoId });

  const mesAtual = um(`
    SELECT * FROM mensalidades WHERE aluno_id = :id AND competencia = :mes
  `, { id: alunoId, mes: competenciaAtual() });

  const atrasadas = resumo?.atrasadas || 0;
  const diasParaVencer = resumo?.proximo_vencimento
    ? Math.round((new Date(`${resumo.proximo_vencimento}T00:00:00`) - new Date(`${hojeISO}T00:00:00`)) / 86400000)
    : null;

  let situacao = 'em dia';
  if (!matricula) situacao = 'sem plano';
  else if (atrasadas > 0) situacao = 'atrasado';
  else if (!mesAtual) situacao = 'mês não gerado';
  else if (diasParaVencer !== null && diasParaVencer <= 5) situacao = 'vence em breve';

  return {
    situacao,
    atrasadas,
    valor_atrasado: resumo?.valor_atrasado || 0,
    a_vencer: resumo?.a_vencer || 0,
    proximo_vencimento: resumo?.proximo_vencimento || null,
    dias_para_vencer: diasParaVencer,
    ultimo_pagamento: resumo?.ultimo_pagamento || null,
    plano: matricula?.plano || null,
    valor_plano: matricula?.valor ?? matricula?.valor_plano ?? null,
    dia_vencimento: matricula?.dia_vencimento ?? null,
    mes_atual_pago: mesAtual?.status === 'pago',
  };
}

/** Todas as contas, agrupadas pela arte marcial que o aluno treina. */
roteador.get('/', exigirPapel('dono', 'recepcao'), rota((req, res) => {
  const filtros = ["a.status != 'inativo'"];
  const params = {};
  if (texto(req.query.status)) { filtros.push('a.status = :status'); params.status = texto(req.query.status); }
  if (texto(req.query.busca)) {
    filtros.push('(a.nome LIKE :busca OR a.email LIKE :busca OR a.telefone LIKE :busca)');
    params.busca = `%${texto(req.query.busca)}%`;
  }

  const alunos = todos(`
    SELECT a.id, a.nome, a.email, a.telefone, a.categoria, a.status, a.data_nascimento,
           a.matriculado_em, a.responsavel_nome, a.responsavel_telefone,
           u.id AS usuario_id, u.ativo AS acesso_ativo, u.ultimo_acesso
    FROM alunos a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    WHERE ${filtros.join(' AND ')}
    ORDER BY a.nome
  `, params);

  const modalidades = todos(`
    SELECT id, nome, cor, sigla FROM modalidades WHERE ativo = 1 ORDER BY ordem, nome
  `);

  // Cada aluno carrega a arte que treina, a graduação atual e a situação do plano.
  for (const aluno of alunos) {
    aluno.modalidades = todos(`
      SELECT DISTINCT m.id, m.nome, m.cor FROM aluno_turmas at
      JOIN turmas t ON t.id = at.turma_id
      JOIN modalidades m ON m.id = t.modalidade_id
      WHERE at.aluno_id = :id ORDER BY m.ordem
    `, { id: aluno.id });
    aluno.turmas = todos(`
      SELECT t.id, t.nome, m.nome AS modalidade FROM aluno_turmas at
      JOIN turmas t ON t.id = at.turma_id JOIN modalidades m ON m.id = t.modalidade_id
      WHERE at.aluno_id = :id ORDER BY m.ordem, t.nome
    `, { id: aluno.id });
    aluno.graduacoes = todos(`
      SELECT m.nome AS modalidade, g.nome AS graduacao, g.cor, ag.grau
      FROM aluno_graduacoes ag
      JOIN graduacoes g ON g.id = ag.graduacao_id
      JOIN modalidades m ON m.id = ag.modalidade_id
      WHERE ag.aluno_id = :id
      GROUP BY ag.modalidade_id
      HAVING ag.data = MAX(ag.data)
    `, { id: aluno.id });
    aluno.frequencia_30d = um(`
      SELECT COUNT(*) AS total FROM checkins
      WHERE aluno_id = :id AND data >= date('now','localtime','-30 day')
    `, { id: aluno.id }).total;
    aluno.pagamento = situacaoDePagamento(aluno.id);
  }

  // Grupos por modalidade, mais um grupo para quem ainda não entrou em turma.
  const grupos = modalidades.map((m) => ({
    ...m,
    alunos: alunos.filter((a) => a.modalidades.some((x) => x.id === m.id)),
  })).filter((g) => g.alunos.length);

  const semTurma = alunos.filter((a) => !a.modalidades.length);
  if (semTurma.length) {
    grupos.push({ id: null, nome: 'Sem turma definida', cor: '#78766f', sigla: null, alunos: semTurma });
  }

  res.json({
    grupos,
    total: alunos.length,
    resumo: {
      em_dia: alunos.filter((a) => a.pagamento.situacao === 'em dia').length,
      vence_em_breve: alunos.filter((a) => a.pagamento.situacao === 'vence em breve').length,
      atrasados: alunos.filter((a) => a.pagamento.situacao === 'atrasado').length,
      sem_plano: alunos.filter((a) => a.pagamento.situacao === 'sem plano').length,
      mes_nao_gerado: alunos.filter((a) => a.pagamento.situacao === 'mês não gerado').length,
      valor_atrasado: alunos.reduce((soma, a) => soma + (a.pagamento.valor_atrasado || 0), 0),
      sem_acesso: alunos.filter((a) => !a.usuario_id).length,
    },
  });
}));

/** A "Minha área" do aluno, vista por quem administra. */
roteador.get('/:id', exigirPapel('dono', 'recepcao'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const aluno = um(`
    SELECT a.*, u.id AS usuario_id, u.email AS email_acesso, u.ativo AS acesso_ativo, u.ultimo_acesso
    FROM alunos a LEFT JOIN usuarios u ON u.id = a.usuario_id WHERE a.id = :id
  `, { id });
  if (!aluno) throw new ErroApi('Aluno não encontrado.', 404);

  const turmas = todos(`
    SELECT t.id, t.nome, t.categoria, t.nivel, t.local, m.id AS modalidade_id,
           m.nome AS modalidade, m.cor AS modalidade_cor, u.nome AS mestre
    FROM aluno_turmas at
    JOIN turmas t ON t.id = at.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    LEFT JOIN usuarios u ON u.id = t.mestre_id
    WHERE at.aluno_id = :id ORDER BY m.ordem, t.nome
  `, { id });

  const horarios = todos(`
    SELECT h.dia_semana, h.hora_inicio, h.hora_fim, h.rotulo,
           t.nome AS turma, m.nome AS modalidade, m.cor AS modalidade_cor
    FROM aluno_turmas at
    JOIN horarios h ON h.turma_id = at.turma_id
    JOIN turmas t ON t.id = at.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    WHERE at.aluno_id = :id AND h.ativo = 1 AND t.ativo = 1
    ORDER BY h.dia_semana, h.hora_inicio
  `, { id });

  res.json({
    aluno,
    turmas,
    horarios,
    pagamento: situacaoDePagamento(id),
    matriculas: todos(`
      SELECT mt.*, p.nome AS plano, p.periodicidade FROM matriculas mt
      JOIN planos p ON p.id = mt.plano_id WHERE mt.aluno_id = :id ORDER BY mt.id DESC
    `, { id }),
    mensalidades: todos(`
      SELECT *, CASE WHEN status = 'pendente' AND vencimento < date('now','localtime')
                     THEN 1 ELSE 0 END AS atrasada
      FROM mensalidades WHERE aluno_id = :id ORDER BY competencia DESC LIMIT 24
    `, { id }),
    graduacoes: todos(`
      SELECT ag.data, ag.grau, ag.observacao, g.nome AS graduacao, g.cor, g.cor_ponta,
             m.nome AS modalidade, m.cor AS modalidade_cor
      FROM aluno_graduacoes ag
      JOIN graduacoes g ON g.id = ag.graduacao_id
      JOIN modalidades m ON m.id = ag.modalidade_id
      WHERE ag.aluno_id = :id ORDER BY ag.data DESC
    `, { id }),
    competicoes: todos(`
      SELECT c.nome AS competicao, c.data_inicio, m.nome AS modalidade, m.cor AS modalidade_cor,
             i.status AS inscricao, i.categoria_peso, r.colocacao, r.medalha, r.lutas, r.vitorias
      FROM competicao_inscricoes i
      JOIN competicoes c ON c.id = i.competicao_id
      LEFT JOIN modalidades m ON m.id = c.modalidade_id
      LEFT JOIN competicao_resultados r ON r.inscricao_id = i.id
      WHERE i.aluno_id = :id ORDER BY c.data_inicio DESC
    `, { id }),
    equipes: todos(`
      SELECT e.nome, e.categoria, em.funcao, m.nome AS modalidade
      FROM equipe_membros em JOIN equipes e ON e.id = em.equipe_id
      LEFT JOIN modalidades m ON m.id = e.modalidade_id
      WHERE em.aluno_id = :id
    `, { id }),
    checkins: todos(`
      SELECT c.data, c.hora, t.nome AS turma, m.nome AS modalidade
      FROM checkins c JOIN turmas t ON t.id = c.turma_id
      JOIN modalidades m ON m.id = t.modalidade_id
      WHERE c.aluno_id = :id ORDER BY c.data DESC, c.hora DESC LIMIT 20
    `, { id }),
    frequencia: um(`
      SELECT
        (SELECT COUNT(*) FROM checkins WHERE aluno_id = :id) AS total,
        (SELECT COUNT(*) FROM checkins WHERE aluno_id = :id
          AND data >= date('now','localtime','-30 day')) AS mes,
        (SELECT COUNT(*) FROM checkins WHERE aluno_id = :id
          AND data >= date('now','localtime','-7 day')) AS semana
    `, { id }),
  });
}));

export default roteador;
