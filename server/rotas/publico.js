import { Router } from 'express';
import { todos, um } from '../db.js';
import { rota, DIAS_SEMANA } from '../util.js';

const roteador = Router();

/**
 * Vitrine da academia: informacoes abertas, sem login.
 * Mostra modalidades, grade de horarios, planos e avisos marcados para o site.
 */
roteador.get('/academia', rota((_req, res) => {
  const configuracoes = Object.fromEntries(
    todos('SELECT chave, valor FROM configuracoes').map((c) => [c.chave, c.valor]),
  );

  const modalidades = todos(`
    SELECT m.id, m.nome, m.descricao, m.cor,
           (SELECT COUNT(*) FROM turmas t WHERE t.modalidade_id = m.id AND t.ativo = 1) AS turmas
    FROM modalidades m WHERE m.ativo = 1 ORDER BY m.nome
  `);

  const grade = todos(`
    SELECT h.dia_semana, h.hora_inicio, h.hora_fim,
           t.nome AS turma, t.categoria, t.nivel, t.local,
           m.nome AS modalidade, m.cor AS modalidade_cor, u.nome AS mestre
    FROM horarios h
    JOIN turmas t ON t.id = h.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    LEFT JOIN usuarios u ON u.id = t.mestre_id
    WHERE h.ativo = 1 AND t.ativo = 1 AND m.ativo = 1
    ORDER BY h.dia_semana, h.hora_inicio
  `);

  const planos = todos(`SELECT id, nome, descricao, valor, periodicidade, aulas_semana FROM planos WHERE ativo = 1 ORDER BY valor`);
  for (const plano of planos) {
    plano.modalidades = todos(`
      SELECT m.nome FROM plano_modalidades pm JOIN modalidades m ON m.id = pm.modalidade_id
      WHERE pm.plano_id = :id ORDER BY m.nome
    `, { id: plano.id }).map((m) => m.nome);
  }

  const avisos = todos(`
    SELECT id, titulo, mensagem, tipo, data_evento, local_evento, criado_em
    FROM avisos
    WHERE ativo = 1 AND publicar_site = 1 AND publico IN ('todos','kids','adultos')
    ORDER BY fixado DESC, criado_em DESC LIMIT 8
  `);

  const totalAlunos = um(`SELECT COUNT(*) AS total FROM alunos WHERE status = 'ativo'`);

  res.json({
    academia: {
      nome: configuracoes.nome_academia || 'Atak',
      telefone: configuracoes.telefone || '',
      whatsapp: configuracoes.whatsapp || '',
      endereco: configuracoes.endereco || '',
      instagram: configuracoes.instagram || '',
      sobre: configuracoes.sobre || '',
      chamada: configuracoes.chamada || '',
      cor_primaria: configuracoes.cor_primaria || '',
    },
    dias: DIAS_SEMANA,
    modalidades,
    grade,
    planos,
    avisos,
    numeros: { alunos_ativos: totalAlunos.total, modalidades: modalidades.length, aulas_semana: grade.length },
  });
}));

export default roteador;
