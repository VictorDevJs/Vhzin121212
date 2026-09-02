import { Router } from 'express';
import { todos, um, executar } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, inteiro, booleano } from '../util.js';

const roteador = Router();

// Toda a equipe consulta; somente o dono cadastra e altera as modalidades.
roteador.get('/', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const lista = todos(`
    SELECT m.*,
           (SELECT COUNT(*) FROM turmas t WHERE t.modalidade_id = m.id AND t.ativo = 1) AS total_turmas,
           (SELECT COUNT(*) FROM graduacoes g WHERE g.modalidade_id = m.id) AS total_graduacoes
    FROM modalidades m
    ORDER BY m.ativo DESC, m.nome
  `);
  res.json(lista);
}));

roteador.post('/', exigirPapel('dono'), rota((req, res) => {
  exigirCampos(req.body, ['nome']);
  const nome = texto(req.body.nome);
  if (um('SELECT id FROM modalidades WHERE nome = :nome', { nome })) {
    throw new ErroApi('Já existe uma modalidade com este nome.', 409);
  }
  const criada = executar(
    'INSERT INTO modalidades (nome, descricao, cor, ativo) VALUES (:nome, :descricao, :cor, :ativo)',
    {
      nome,
      descricao: texto(req.body.descricao),
      cor: texto(req.body.cor, '#2a78d6'),
      ativo: booleano(req.body.ativo, 1),
    },
  );
  res.status(201).json(um('SELECT * FROM modalidades WHERE id = :id', { id: Number(criada.lastInsertRowid) }));
}));

roteador.put('/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM modalidades WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Modalidade não encontrada.', 404);

  executar(
    `UPDATE modalidades SET nome = :nome, descricao = :descricao, cor = :cor, ativo = :ativo WHERE id = :id`,
    {
      id,
      nome: texto(req.body.nome, atual.nome),
      descricao: texto(req.body.descricao, atual.descricao),
      cor: texto(req.body.cor, atual.cor),
      ativo: booleano(req.body.ativo, atual.ativo),
    },
  );
  res.json(um('SELECT * FROM modalidades WHERE id = :id', { id }));
}));

roteador.delete('/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const turmas = um('SELECT COUNT(*) AS total FROM turmas WHERE modalidade_id = :id', { id });
  if (turmas.total > 0) {
    throw new ErroApi('Existem turmas nesta modalidade. Desative a modalidade em vez de excluir.', 409);
  }
  const apagada = executar('DELETE FROM modalidades WHERE id = :id', { id });
  if (!apagada.changes) throw new ErroApi('Modalidade não encontrada.', 404);
  res.json({ mensagem: 'Modalidade removida.' });
}));

// ----- Graduacoes / faixas de cada modalidade -----

roteador.get('/:id/graduacoes', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  res.json(todos('SELECT * FROM graduacoes WHERE modalidade_id = :id ORDER BY ordem, nome', {
    id: inteiro(req.params.id),
  }));
}));

roteador.post('/:id/graduacoes', exigirPapel('dono', 'mestre'), rota((req, res) => {
  const modalidadeId = inteiro(req.params.id);
  if (!um('SELECT id FROM modalidades WHERE id = :id', { id: modalidadeId })) {
    throw new ErroApi('Modalidade não encontrada.', 404);
  }
  exigirCampos(req.body, ['nome']);
  const nome = texto(req.body.nome);
  if (um('SELECT id FROM graduacoes WHERE modalidade_id = :m AND nome = :nome', { m: modalidadeId, nome })) {
    throw new ErroApi('Esta graduação já existe na modalidade.', 409);
  }
  const criada = executar(
    'INSERT INTO graduacoes (modalidade_id, nome, ordem, cor) VALUES (:modalidade_id, :nome, :ordem, :cor)',
    {
      modalidade_id: modalidadeId,
      nome,
      ordem: inteiro(req.body.ordem, 0),
      cor: texto(req.body.cor, '#888888'),
    },
  );
  res.status(201).json(um('SELECT * FROM graduacoes WHERE id = :id', { id: Number(criada.lastInsertRowid) }));
}));

roteador.delete('/:id/graduacoes/:graduacaoId', exigirPapel('dono', 'mestre'), rota((req, res) => {
  const apagada = executar('DELETE FROM graduacoes WHERE id = :id AND modalidade_id = :m', {
    id: inteiro(req.params.graduacaoId),
    m: inteiro(req.params.id),
  });
  if (!apagada.changes) throw new ErroApi('Graduação não encontrada.', 404);
  res.json({ mensagem: 'Graduação removida.' });
}));

export default roteador;
