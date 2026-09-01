import { Router } from 'express';
import { todos, um } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, hoje, competenciaAtual, DIAS_SEMANA } from '../util.js';

const roteador = Router();

/** Aulas do dia de hoje, com o mestre responsavel. */
function aulasDeHoje(filtroMestre = null) {
  const diaSemana = new Date().getDay();
  return todos(`
    SELECT h.hora_inicio, h.hora_fim, t.id AS turma_id, t.nome AS turma, t.categoria, t.local,
           m.nome AS modalidade, m.cor AS modalidade_cor, u.nome AS mestre, t.mestre_id,
           (SELECT COUNT(*) FROM aluno_turmas at WHERE at.turma_id = t.id) AS total_alunos,
           (SELECT COUNT(*) FROM presencas p WHERE p.turma_id = t.id AND p.data = :hoje AND p.presente = 1) AS presentes
    FROM horarios h
    JOIN turmas t ON t.id = h.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    LEFT JOIN usuarios u ON u.id = t.mestre_id
    WHERE h.dia_semana = :dia AND h.ativo = 1 AND t.ativo = 1
      ${filtroMestre ? 'AND t.mestre_id = :mestre_id' : ''}
    ORDER BY h.hora_inicio
  `, filtroMestre ? { dia: diaSemana, hoje: hoje(), mestre_id: filtroMestre } : { dia: diaSemana, hoje: hoje() });
}

roteador.get('/', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const papel = req.usuario.papel;
  const competencia = competenciaAtual();

  const base = {
    papel,
    hoje: hoje(),
    dia_semana: DIAS_SEMANA[new Date().getDay()],
    avisos_recentes: todos(`
      SELECT av.id, av.titulo, av.tipo, av.data_evento, av.criado_em, av.fixado
      FROM avisos av WHERE av.ativo = 1 ORDER BY av.fixado DESC, av.criado_em DESC LIMIT 5
    `),
  };

  if (papel === 'aluno') {
    const aluno = um('SELECT * FROM alunos WHERE usuario_id = :id', { id: req.usuario.id });
    return res.json({ ...base, aluno, aulas_hoje: aulasDeHoje() });
  }

  if (papel === 'mestre') {
    const minhasTurmas = todos(`
      SELECT t.id, t.nome, t.categoria, m.nome AS modalidade,
             (SELECT COUNT(*) FROM aluno_turmas at WHERE at.turma_id = t.id) AS total_alunos
      FROM turmas t JOIN modalidades m ON m.id = t.modalidade_id
      WHERE t.mestre_id = :id AND t.ativo = 1 ORDER BY m.nome, t.nome
    `, { id: req.usuario.id });
    const alunosNasMinhasTurmas = um(`
      SELECT COUNT(DISTINCT at.aluno_id) AS total FROM aluno_turmas at
      JOIN turmas t ON t.id = at.turma_id WHERE t.mestre_id = :id
    `, { id: req.usuario.id });
    return res.json({
      ...base,
      minhas_turmas: minhasTurmas,
      total_alunos: alunosNasMinhasTurmas.total,
      aulas_hoje: aulasDeHoje(req.usuario.id),
    });
  }

  // Dono e recepcao
  const alunos = um(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) AS ativos,
      SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS pendentes,
      SUM(CASE WHEN categoria = 'kids' AND status = 'ativo' THEN 1 ELSE 0 END) AS kids,
      SUM(CASE WHEN categoria = 'adulto' AND status = 'ativo' THEN 1 ELSE 0 END) AS adultos
    FROM alunos
  `);
  const inadimplencia = um(`
    SELECT COUNT(*) AS quantidade, COALESCE(SUM(valor), 0) AS total FROM mensalidades
    WHERE status = 'pendente' AND vencimento < date('now','localtime')
  `);
  const aReceber = um(`
    SELECT COALESCE(SUM(valor), 0) AS total FROM mensalidades
    WHERE status = 'pendente' AND competencia = :competencia
  `, { competencia });
  const caixaMes = um(`
    SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0) AS receitas,
           COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor END), 0) AS despesas
    FROM lancamentos WHERE substr(data, 1, 7) = :competencia
  `, { competencia });
  const porModalidade = todos(`
    SELECT m.nome AS modalidade, m.cor, COUNT(DISTINCT at.aluno_id) AS alunos
    FROM modalidades m
    LEFT JOIN turmas t ON t.modalidade_id = m.id
    LEFT JOIN aluno_turmas at ON at.turma_id = t.id
    WHERE m.ativo = 1 GROUP BY m.id ORDER BY alunos DESC
  `);

  res.json({
    ...base,
    alunos,
    financeiro: papel === 'dono'
      ? { ...caixaMes, saldo: caixaMes.receitas - caixaMes.despesas, a_receber: aReceber.total, inadimplencia }
      : { a_receber: aReceber.total, inadimplencia },
    por_modalidade: porModalidade,
    aulas_hoje: aulasDeHoje(),
    turmas_ativas: um('SELECT COUNT(*) AS total FROM turmas WHERE ativo = 1').total,
  });
}));

export default roteador;
