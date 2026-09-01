import { Router } from 'express';
import { todos, um, executar, transacao } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, ErroApi, exigirCampos, inteiro, data, hoje, booleano } from '../util.js';

const roteador = Router();

/** Lista de chamada de uma turma em uma data. */
roteador.get('/', exigirPapel(...EQUIPE), rota((req, res) => {
  const turmaId = inteiro(req.query.turma_id);
  if (!turmaId) throw new ErroApi('Informe a turma (turma_id).');
  const dia = data(req.query.data, hoje());

  const turma = um(`
    SELECT t.*, m.nome AS modalidade FROM turmas t JOIN modalidades m ON m.id = t.modalidade_id WHERE t.id = :id
  `, { id: turmaId });
  if (!turma) throw new ErroApi('Turma nao encontrada.', 404);

  const alunos = todos(`
    SELECT a.id, a.nome, a.categoria, a.status,
           COALESCE(p.presente, -1) AS presente
    FROM aluno_turmas at
    JOIN alunos a ON a.id = at.aluno_id
    LEFT JOIN presencas p ON p.aluno_id = a.id AND p.turma_id = at.turma_id AND p.data = :data
    WHERE at.turma_id = :turma_id
    ORDER BY a.nome
  `, { turma_id: turmaId, data: dia });

  res.json({ turma, data: dia, alunos });
}));

/** Salva a chamada inteira de uma vez. */
roteador.post('/', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirCampos(req.body, ['turma_id']);
  const turmaId = inteiro(req.body.turma_id);
  const dia = data(req.body.data, hoje());
  const marcacoes = Array.isArray(req.body.presencas) ? req.body.presencas : [];
  if (!um('SELECT id FROM turmas WHERE id = :id', { id: turmaId })) throw new ErroApi('Turma nao encontrada.', 404);

  transacao(() => {
    for (const marcacao of marcacoes) {
      const alunoId = inteiro(marcacao.aluno_id);
      if (!alunoId) continue;
      executar(`
        INSERT INTO presencas (aluno_id, turma_id, data, presente, registrado_por)
        VALUES (:aluno_id, :turma_id, :data, :presente, :registrado_por)
        ON CONFLICT (aluno_id, turma_id, data)
        DO UPDATE SET presente = excluded.presente, registrado_por = excluded.registrado_por
      `, {
        aluno_id: alunoId,
        turma_id: turmaId,
        data: dia,
        presente: booleano(marcacao.presente, 0),
        registrado_por: req.usuario.id,
      });
    }
  });
  res.json({ mensagem: `Chamada de ${dia} registrada.`, total: marcacoes.length });
}));

/** Frequencia por turma no periodo. */
roteador.get('/resumo', exigirPapel(...EQUIPE), rota((req, res) => {
  const de = data(req.query.de, `${hoje().slice(0, 7)}-01`);
  const ate = data(req.query.ate, hoje());
  const porTurma = todos(`
    SELECT t.id, t.nome AS turma, m.nome AS modalidade,
           COUNT(DISTINCT p.data) AS aulas,
           SUM(CASE WHEN p.presente = 1 THEN 1 ELSE 0 END) AS presencas,
           SUM(CASE WHEN p.presente = 0 THEN 1 ELSE 0 END) AS faltas
    FROM presencas p
    JOIN turmas t ON t.id = p.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    WHERE p.data BETWEEN :de AND :ate
    GROUP BY t.id ORDER BY presencas DESC
  `, { de, ate });
  res.json({ periodo: { de, ate }, turmas: porTurma });
}));

export default roteador;
