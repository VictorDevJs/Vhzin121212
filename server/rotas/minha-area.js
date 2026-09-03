import { Router } from 'express';
import { todos, um } from '../db.js';
import { exigirPapel } from '../auth.js';
import { rota, ErroApi, DIAS_SEMANA, hoje } from '../util.js';
import { situacaoDePagamento } from '../cobranca.js';

const roteador = Router();

/** Painel do aluno: plano, turmas, horarios, pagamentos, presencas e avisos. */
roteador.get('/', exigirPapel('aluno'), rota((req, res) => {
  const aluno = um('SELECT * FROM alunos WHERE usuario_id = :id', { id: req.usuario.id });
  if (!aluno) throw new ErroApi('Cadastro de aluno não encontrado. Fale com a recepção.', 404);

  const matricula = um(`
    SELECT mt.*, p.nome AS plano, p.periodicidade, p.aulas_semana, p.descricao AS plano_descricao
    FROM matriculas mt JOIN planos p ON p.id = mt.plano_id
    WHERE mt.aluno_id = :id AND mt.status = 'ativa' ORDER BY mt.id DESC LIMIT 1
  `, { id: aluno.id });

  const turmas = todos(`
    SELECT t.id, t.nome, t.categoria, t.nivel, t.local, m.nome AS modalidade, m.cor AS modalidade_cor,
           u.nome AS mestre
    FROM aluno_turmas at
    JOIN turmas t ON t.id = at.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    LEFT JOIN usuarios u ON u.id = t.mestre_id
    WHERE at.aluno_id = :id ORDER BY m.nome, t.nome
  `, { id: aluno.id });

  const meusHorarios = todos(`
    SELECT h.dia_semana, h.hora_inicio, h.hora_fim, t.nome AS turma, m.nome AS modalidade, m.cor AS modalidade_cor
    FROM aluno_turmas at
    JOIN horarios h ON h.turma_id = at.turma_id
    JOIN turmas t ON t.id = at.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    WHERE at.aluno_id = :id AND h.ativo = 1 AND t.ativo = 1
    ORDER BY h.dia_semana, h.hora_inicio
  `, { id: aluno.id });

  const mensalidades = todos(`
    SELECT id, competencia, vencimento, valor, status, pago_em, forma_pagamento,
           CASE WHEN status = 'pendente' AND vencimento < date('now','localtime') THEN 1 ELSE 0 END AS atrasada
    FROM mensalidades WHERE aluno_id = :id ORDER BY competencia DESC LIMIT 12
  `, { id: aluno.id });

  const graduacoes = todos(`
    SELECT ag.data, ag.observacao, ag.grau, g.nome AS graduacao, g.cor, g.cor_ponta, g.graus,
           m.nome AS modalidade, m.cor AS modalidade_cor
    FROM aluno_graduacoes ag
    JOIN graduacoes g ON g.id = ag.graduacao_id
    JOIN modalidades m ON m.id = ag.modalidade_id
    WHERE ag.aluno_id = :id ORDER BY ag.data DESC
  `, { id: aluno.id });

  // Faixa atual de cada arte e qual é o próximo degrau da escala.
  const proximaFaixa = todos(`
    SELECT m.nome AS modalidade, m.cor AS modalidade_cor,
           atual.nome AS faixa_atual, atual.cor AS cor_atual, atual.cor_ponta AS ponta_atual,
           atual.graus, ultima.grau,
           (SELECT g2.nome FROM graduacoes g2
             WHERE g2.modalidade_id = m.id AND g2.ordem > atual.ordem
               AND g2.faixa_etaria IN (:categoria, 'ambos')
             ORDER BY g2.ordem LIMIT 1) AS proxima,
           atual.tempo_minimo, ultima.data AS desde
    FROM (
      SELECT ag.modalidade_id, MAX(ag.data) AS data, ag.graduacao_id, ag.grau
      FROM aluno_graduacoes ag WHERE ag.aluno_id = :id GROUP BY ag.modalidade_id
    ) ultima
    JOIN graduacoes atual ON atual.id = ultima.graduacao_id
    JOIN modalidades m ON m.id = ultima.modalidade_id
    ORDER BY m.ordem
  `, { id: aluno.id, categoria: aluno.categoria });

  // Campeonatos em que o aluno se inscreveu e como foi cada um.
  const competicoes = todos(`
    SELECT c.id, c.nome AS competicao, c.data_inicio, c.nivel, c.local, c.cidade, c.status,
           m.nome AS modalidade, m.cor AS modalidade_cor,
           i.status AS inscricao, i.categoria_peso, i.taxa_paga,
           r.colocacao, r.medalha, r.lutas, r.vitorias, r.finalizacoes,
           e.nome AS equipe
    FROM competicao_inscricoes i
    JOIN competicoes c ON c.id = i.competicao_id
    LEFT JOIN modalidades m ON m.id = c.modalidade_id
    LEFT JOIN equipes e ON e.id = i.equipe_id
    LEFT JOIN competicao_resultados r ON r.inscricao_id = i.id
    WHERE i.aluno_id = :id ORDER BY c.data_inicio DESC
  `, { id: aluno.id });

  const equipes = todos(`
    SELECT e.nome, e.categoria, e.cor, em.funcao, em.categoria_peso, em.desde,
           m.nome AS modalidade, u.nome AS tecnico
    FROM equipe_membros em
    JOIN equipes e ON e.id = em.equipe_id
    LEFT JOIN modalidades m ON m.id = e.modalidade_id
    LEFT JOIN usuarios u ON u.id = e.tecnico_id
    WHERE em.aluno_id = :id AND e.ativo = 1
  `, { id: aluno.id });

  const presencas = todos(`
    SELECT p.data, p.presente, t.nome AS turma, m.nome AS modalidade
    FROM presencas p JOIN turmas t ON t.id = p.turma_id JOIN modalidades m ON m.id = t.modalidade_id
    WHERE p.aluno_id = :id ORDER BY p.data DESC LIMIT 20
  `, { id: aluno.id });

  const frequencia = um(`
    SELECT COUNT(*) AS total, SUM(CASE WHEN presente = 1 THEN 1 ELSE 0 END) AS presentes
    FROM presencas WHERE aluno_id = :id AND data >= date('now','localtime','-30 days')
  `, { id: aluno.id });

  res.json({
    aluno,
    matricula,
    pagamento: situacaoDePagamento(aluno.id),
    turmas,
    horarios: meusHorarios.map((h) => ({ ...h, dia_nome: DIAS_SEMANA[h.dia_semana] })),
    mensalidades,
    graduacoes,
    proxima_faixa: proximaFaixa,
    competicoes,
    equipes,
    presencas,
    frequencia,
    hoje: hoje(),
  });
}));

export default roteador;
