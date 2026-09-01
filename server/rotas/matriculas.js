import { Router } from 'express';
import { todos, um, executar, transacao } from '../db.js';
import { exigirPapel, EQUIPE, GESTAO } from '../auth.js';
import {
  rota, ErroApi, exigirCampos, texto, numero, inteiro, data, hoje,
  somarMeses, MESES_POR_PERIODICIDADE,
} from '../util.js';

const roteador = Router();

const SELECT_MATRICULA = `
  SELECT mt.*, a.nome AS aluno, a.categoria, p.nome AS plano, p.periodicidade
  FROM matriculas mt
  JOIN alunos a ON a.id = mt.aluno_id
  JOIN planos p ON p.id = mt.plano_id
`;

roteador.get('/', exigirPapel(...EQUIPE), rota((req, res) => {
  const filtros = [];
  const params = {};
  if (texto(req.query.status)) { filtros.push('mt.status = :status'); params.status = texto(req.query.status); }
  if (inteiro(req.query.aluno_id)) { filtros.push('mt.aluno_id = :aluno_id'); params.aluno_id = inteiro(req.query.aluno_id); }
  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  res.json(todos(`${SELECT_MATRICULA} ${onde} ORDER BY mt.id DESC`, params));
}));

/**
 * Matricula o aluno em um plano. Encerra a matricula ativa anterior,
 * ativa o cadastro do aluno e ja gera a primeira mensalidade.
 */
roteador.post('/', exigirPapel(...GESTAO), rota((req, res) => {
  exigirCampos(req.body, ['aluno_id', 'plano_id']);
  const alunoId = inteiro(req.body.aluno_id);
  const planoId = inteiro(req.body.plano_id);

  const aluno = um('SELECT * FROM alunos WHERE id = :id', { id: alunoId });
  if (!aluno) throw new ErroApi('Aluno nao encontrado.', 404);
  const plano = um('SELECT * FROM planos WHERE id = :id', { id: planoId });
  if (!plano) throw new ErroApi('Plano nao encontrado.', 404);
  if (!plano.ativo) throw new ErroApi('Este plano esta desativado.');

  const inicio = data(req.body.inicio, hoje());
  const valor = numero(req.body.valor, plano.valor);
  const diaVencimento = Math.min(Math.max(inteiro(req.body.dia_vencimento, 10), 1), 28);
  const meses = MESES_POR_PERIODICIDADE[plano.periodicidade] || 1;

  const id = transacao(() => {
    executar(`UPDATE matriculas SET status = 'encerrada', fim = COALESCE(fim, :hoje)
              WHERE aluno_id = :aluno_id AND status = 'ativa'`, { aluno_id: alunoId, hoje: hoje() });

    const criada = executar(`
      INSERT INTO matriculas (aluno_id, plano_id, inicio, fim, valor, dia_vencimento, status)
      VALUES (:aluno_id, :plano_id, :inicio, :fim, :valor, :dia_vencimento, 'ativa')
    `, {
      aluno_id: alunoId,
      plano_id: planoId,
      inicio,
      fim: data(req.body.fim, somarMeses(inicio, meses)),
      valor,
      dia_vencimento: diaVencimento,
    });
    const matriculaId = Number(criada.lastInsertRowid);

    executar(`UPDATE alunos SET status = 'ativo', matriculado_em = COALESCE(matriculado_em, :inicio) WHERE id = :id`,
      { id: alunoId, inicio });

    // Primeira mensalidade da competencia atual (se ainda nao existir).
    const competencia = inicio.slice(0, 7);
    const jaTem = um('SELECT id FROM mensalidades WHERE aluno_id = :a AND competencia = :c',
      { a: alunoId, c: competencia });
    if (!jaTem) {
      executar(`
        INSERT INTO mensalidades (matricula_id, aluno_id, competencia, vencimento, valor, status)
        VALUES (:matricula_id, :aluno_id, :competencia, :vencimento, :valor, 'pendente')
      `, {
        matricula_id: matriculaId,
        aluno_id: alunoId,
        competencia,
        vencimento: `${competencia}-${String(diaVencimento).padStart(2, '0')}`,
        valor,
      });
    }
    return matriculaId;
  });

  res.status(201).json(um(`${SELECT_MATRICULA} WHERE mt.id = :id`, { id }));
}));

roteador.put('/:id', exigirPapel(...GESTAO), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM matriculas WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Matricula nao encontrada.', 404);

  const status = texto(req.body.status, atual.status);
  if (!['ativa', 'suspensa', 'encerrada'].includes(status)) throw new ErroApi('Status invalido.');

  executar(`
    UPDATE matriculas SET status = :status, valor = :valor, dia_vencimento = :dia_vencimento,
           inicio = :inicio, fim = :fim
    WHERE id = :id
  `, {
    id,
    status,
    valor: numero(req.body.valor, atual.valor),
    dia_vencimento: inteiro(req.body.dia_vencimento, atual.dia_vencimento),
    inicio: data(req.body.inicio, atual.inicio),
    fim: data(req.body.fim, atual.fim),
  });

  if (status === 'encerrada') {
    const restantes = um(`SELECT COUNT(*) AS total FROM matriculas WHERE aluno_id = :a AND status = 'ativa'`,
      { a: atual.aluno_id });
    if (!restantes.total) executar(`UPDATE alunos SET status = 'inativo' WHERE id = :id`, { id: atual.aluno_id });
  }
  res.json(um(`${SELECT_MATRICULA} WHERE mt.id = :id`, { id }));
}));

export default roteador;
