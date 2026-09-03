import { Router } from 'express';
import { todos, um } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, hoje, competenciaAtual, DIAS_SEMANA } from '../util.js';
import { recorteDeModalidade } from '../escopo.js';
import { filtroPorUsuario } from './avisos.js';

const roteador = Router();

/**
 * Aulas do dia de hoje, com o mestre responsavel. O recorte segue o resto
 * do sistema: quem treina uma arte só vê as aulas dela.
 */
function aulasDeHoje(filtroMestre = null, usuario = null) {
  const diaSemana = new Date().getDay();
  const recorte = usuario ? recorteDeModalidade(usuario, 't.modalidade_id', { incluirGerais: false }) : null;
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
      ${recorte ? `AND ${recorte}` : ''}
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
    // Os avisos do painel seguem a mesma regra da aba de avisos: o aluno
    // recebe os da arte dele, os da turma dele e os que valem para todos.
    avisos_recentes: (() => {
      const { clausula, params } = filtroPorUsuario(req.usuario);
      return todos(`
        SELECT av.id, av.titulo, av.tipo, av.data_evento, av.criado_em, av.fixado,
               m.nome AS modalidade, m.cor AS modalidade_cor
        FROM avisos av
        LEFT JOIN modalidades m ON m.id = av.modalidade_id
        WHERE ${clausula || 'av.ativo = 1'}
        ORDER BY av.fixado DESC, av.criado_em DESC LIMIT 5
      `, params);
    })(),
  };

  if (papel === 'aluno') {
    const aluno = um('SELECT * FROM alunos WHERE usuario_id = :id', { id: req.usuario.id });
    return res.json({ ...base, aluno, aulas_hoje: aulasDeHoje(null, req.usuario) });
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

  // Series dos ultimos 6 meses para os mini-graficos do painel.
  const serieMatriculas = todos(`
    SELECT substr(criado_em, 1, 7) AS competencia, COUNT(*) AS total
    FROM matriculas
    WHERE criado_em >= date('now','localtime','-5 months','start of month')
    GROUP BY competencia ORDER BY competencia
  `);
  const serieCaixa = todos(`
    SELECT substr(data, 1, 7) AS competencia,
           COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0) AS receitas,
           COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor END), 0) AS despesas
    FROM lancamentos
    WHERE data >= date('now','localtime','-5 months','start of month')
    GROUP BY competencia ORDER BY competencia
  `);

  // Aniversariantes do mes: gancho simples de relacionamento com o aluno.
  const aniversariantes = todos(`
    SELECT nome, data_nascimento, telefone, categoria,
           CAST(strftime('%d', data_nascimento) AS INTEGER) AS dia
    FROM alunos
    WHERE data_nascimento IS NOT NULL
      AND strftime('%m', data_nascimento) = strftime('%m', 'now', 'localtime')
      AND status = 'ativo'
    ORDER BY dia
  `);

  const avaliacoesPendentes = um(`SELECT COUNT(*) AS total FROM avaliacoes WHERE status = 'pendente'`);

  res.json({
    ...base,
    alunos,
    aniversariantes,
    avaliacoes_pendentes: avaliacoesPendentes.total,
    serie_matriculas: serieMatriculas,
    serie_caixa: papel === 'dono' ? serieCaixa : [],
    financeiro: papel === 'dono'
      ? { ...caixaMes, saldo: caixaMes.receitas - caixaMes.despesas, a_receber: aReceber.total, inadimplencia }
      : { a_receber: aReceber.total, inadimplencia },
    por_modalidade: porModalidade,
    aulas_hoje: aulasDeHoje(),
    turmas_ativas: um('SELECT COUNT(*) AS total FROM turmas WHERE ativo = 1').total,
  });
}));

/**
 * Análise por modalidade: quanto cada arte marcial traz de aluno, de presença
 * e de dinheiro. É a tela que responde "qual luta está crescendo?".
 */
roteador.get('/analises', exigirPapel('dono', 'recepcao'), rota((_req, res) => {
  const modalidades = todos(`
    SELECT m.id, m.nome, m.cor, m.sigla,
           (SELECT COUNT(DISTINCT at.aluno_id) FROM aluno_turmas at
             JOIN turmas t ON t.id = at.turma_id
             JOIN alunos a ON a.id = at.aluno_id
            WHERE t.modalidade_id = m.id AND a.status = 'ativo') AS alunos,
           (SELECT COUNT(*) FROM turmas t WHERE t.modalidade_id = m.id AND t.ativo = 1) AS turmas,
           (SELECT COUNT(*) FROM horarios h JOIN turmas t ON t.id = h.turma_id
             WHERE t.modalidade_id = m.id AND h.ativo = 1 AND t.ativo = 1) AS aulas_semana,
           (SELECT COUNT(*) FROM checkins c JOIN turmas t ON t.id = c.turma_id
             WHERE t.modalidade_id = m.id AND c.data >= date('now','localtime','-30 day')) AS checkins_mes,
           (SELECT COUNT(*) FROM checkins c JOIN turmas t ON t.id = c.turma_id
             WHERE t.modalidade_id = m.id
               AND c.data >= date('now','localtime','-60 day')
               AND c.data < date('now','localtime','-30 day')) AS checkins_anterior,
           (SELECT COUNT(*) FROM competicao_inscricoes i JOIN competicoes c ON c.id = i.competicao_id
             WHERE c.modalidade_id = m.id AND i.status != 'desistiu') AS inscricoes,
           (SELECT COUNT(*) FROM competicao_resultados r
             JOIN competicao_inscricoes i ON i.id = r.inscricao_id
             JOIN competicoes c ON c.id = i.competicao_id
            WHERE c.modalidade_id = m.id AND r.medalha IN ('ouro','prata','bronze')) AS podios,
           (SELECT COUNT(*) FROM aluno_graduacoes ag
             WHERE ag.modalidade_id = m.id
               AND ag.data >= date('now','localtime','-12 month')) AS graduacoes_ano
    FROM modalidades m WHERE m.ativo = 1 ORDER BY m.ordem, m.nome
  `);

  // Vagas ocupadas: quantos lugares das turmas já estão preenchidos.
  const ocupacao = todos(`
    SELECT t.modalidade_id,
           SUM(t.capacidade) AS capacidade,
           (SELECT COUNT(*) FROM aluno_turmas at2 WHERE at2.turma_id IN
             (SELECT id FROM turmas WHERE modalidade_id = t.modalidade_id AND ativo = 1)) AS ocupadas
    FROM turmas t WHERE t.ativo = 1 GROUP BY t.modalidade_id
  `);
  const mapaOcupacao = new Map(ocupacao.map((o) => [o.modalidade_id, o]));

  for (const modalidade of modalidades) {
    const vagas = mapaOcupacao.get(modalidade.id);
    modalidade.capacidade = vagas?.capacidade || 0;
    modalidade.ocupacao = vagas?.capacidade
      ? Math.round((vagas.ocupadas / vagas.capacidade) * 100)
      : 0;
    // Variação de presença entre os últimos 30 dias e os 30 anteriores.
    modalidade.variacao_presenca = modalidade.checkins_anterior
      ? Math.round(((modalidade.checkins_mes - modalidade.checkins_anterior) / modalidade.checkins_anterior) * 100)
      : null;
    modalidade.media_por_aula = modalidade.aulas_semana
      ? Math.round(modalidade.checkins_mes / (modalidade.aulas_semana * 4.3))
      : 0;
  }

  const retencao = um(`
    SELECT
      (SELECT COUNT(*) FROM alunos WHERE status = 'ativo') AS ativos,
      (SELECT COUNT(*) FROM alunos WHERE status = 'inativo') AS inativos,
      (SELECT COUNT(*) FROM alunos WHERE status = 'trancado') AS trancados,
      (SELECT COUNT(*) FROM alunos WHERE status = 'pendente') AS pendentes,
      (SELECT COUNT(*) FROM alunos
        WHERE matriculado_em >= date('now','localtime','-30 day')) AS novos_mes,
      (SELECT COUNT(DISTINCT c.aluno_id) FROM checkins c
        WHERE c.data >= date('now','localtime','-14 day')) AS treinando,
      (SELECT COUNT(*) FROM alunos a WHERE a.status = 'ativo'
        AND NOT EXISTS (SELECT 1 FROM checkins c WHERE c.aluno_id = a.id
                         AND c.data >= date('now','localtime','-21 day'))) AS sumidos
  `);

  const graduacoes = todos(`
    SELECT m.nome AS modalidade, g.nome AS graduacao, g.cor, g.cor_ponta,
           COUNT(DISTINCT ag.aluno_id) AS alunos
    FROM aluno_graduacoes ag
    JOIN graduacoes g ON g.id = ag.graduacao_id
    JOIN modalidades m ON m.id = ag.modalidade_id
    GROUP BY g.id ORDER BY m.ordem, g.ordem
  `);

  res.json({ modalidades, retencao, graduacoes });
}));

export default roteador;
