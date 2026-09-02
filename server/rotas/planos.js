import { Router } from 'express';
import { todos, um, executar, transacao } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, numero, inteiro, booleano } from '../util.js';

const roteador = Router();
const PERIODICIDADES = ['mensal', 'trimestral', 'semestral', 'anual'];

function comModalidades(plano) {
  if (!plano) return plano;
  const modalidades = todos(`
    SELECT m.id, m.nome, m.cor FROM plano_modalidades pm
    JOIN modalidades m ON m.id = pm.modalidade_id
    WHERE pm.plano_id = :id ORDER BY m.nome
  `, { id: plano.id });
  return { ...plano, modalidades, livre: modalidades.length === 0 };
}

roteador.get('/', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const onde = req.query.ativo === '1' ? 'WHERE ativo = 1' : '';
  const lista = todos(`
    SELECT p.*, (SELECT COUNT(*) FROM matriculas mt WHERE mt.plano_id = p.id AND mt.status = 'ativa') AS alunos_ativos
    FROM planos p ${onde} ORDER BY p.ativo DESC, p.valor
  `);
  res.json(lista.map(comModalidades));
}));

roteador.post('/', exigirPapel('dono'), rota((req, res) => {
  exigirCampos(req.body, ['nome', 'valor']);
  const periodicidade = texto(req.body.periodicidade, 'mensal');
  if (!PERIODICIDADES.includes(periodicidade)) {
    throw new ErroApi(`Periodicidade invalida. Use: ${PERIODICIDADES.join(', ')}.`);
  }
  const valor = numero(req.body.valor, -1);
  if (valor < 0) throw new ErroApi('Informe um valor válido para o plano.');

  const id = transacao(() => {
    const criado = executar(`
      INSERT INTO planos (nome, descricao, valor, periodicidade, aulas_semana, ativo)
      VALUES (:nome, :descricao, :valor, :periodicidade, :aulas_semana, :ativo)
    `, {
      nome: texto(req.body.nome),
      descricao: texto(req.body.descricao),
      valor,
      periodicidade,
      aulas_semana: inteiro(req.body.aulas_semana, 0),
      ativo: booleano(req.body.ativo, 1),
    });
    const planoId = Number(criado.lastInsertRowid);
    salvarModalidades(planoId, req.body.modalidades);
    return planoId;
  });
  res.status(201).json(comModalidades(um('SELECT * FROM planos WHERE id = :id', { id })));
}));

roteador.put('/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM planos WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Plano não encontrado.', 404);

  transacao(() => {
    executar(`
      UPDATE planos SET nome = :nome, descricao = :descricao, valor = :valor,
             periodicidade = :periodicidade, aulas_semana = :aulas_semana, ativo = :ativo
      WHERE id = :id
    `, {
      id,
      nome: texto(req.body.nome, atual.nome),
      descricao: texto(req.body.descricao, atual.descricao),
      valor: numero(req.body.valor, atual.valor),
      periodicidade: texto(req.body.periodicidade, atual.periodicidade),
      aulas_semana: inteiro(req.body.aulas_semana, atual.aulas_semana),
      ativo: booleano(req.body.ativo, atual.ativo),
    });
    if (req.body.modalidades !== undefined) salvarModalidades(id, req.body.modalidades);
  });
  res.json(comModalidades(um('SELECT * FROM planos WHERE id = :id', { id })));
}));

roteador.delete('/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const emUso = um('SELECT COUNT(*) AS total FROM matriculas WHERE plano_id = :id', { id });
  if (emUso.total > 0) throw new ErroApi('Ha matrículas usando este plano. Desative-o em vez de excluir.', 409);
  const apagado = executar('DELETE FROM planos WHERE id = :id', { id });
  if (!apagado.changes) throw new ErroApi('Plano não encontrado.', 404);
  res.json({ mensagem: 'Plano removido.' });
}));

function salvarModalidades(planoId, modalidades) {
  executar('DELETE FROM plano_modalidades WHERE plano_id = :id', { id: planoId });
  for (const modalidadeId of modalidades || []) {
    const id = inteiro(modalidadeId);
    if (!id) continue;
    executar('INSERT OR IGNORE INTO plano_modalidades (plano_id, modalidade_id) VALUES (:p, :m)', { p: planoId, m: id });
  }
}

export default roteador;
