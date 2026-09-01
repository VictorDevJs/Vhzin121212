import { Router } from 'express';
import { todos, um, executar } from '../db.js';
import { exigirPapel, EQUIPE, GESTAO } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, inteiro, booleano, hora, DIAS_SEMANA } from '../util.js';

const roteador = Router();

const CATEGORIAS = ['kids', 'adulto', 'misto', 'feminino'];
const NIVEIS = ['iniciante', 'intermediario', 'avancado', 'todos'];

const SELECT_TURMA = `
  SELECT t.*, m.nome AS modalidade, m.cor AS modalidade_cor,
         u.nome AS mestre,
         (SELECT COUNT(*) FROM aluno_turmas at WHERE at.turma_id = t.id) AS total_alunos
  FROM turmas t
  JOIN modalidades m ON m.id = t.modalidade_id
  LEFT JOIN usuarios u ON u.id = t.mestre_id
`;

function comHorarios(turma) {
  if (!turma) return turma;
  const horarios = todos(
    'SELECT * FROM horarios WHERE turma_id = :id ORDER BY dia_semana, hora_inicio',
    { id: turma.id },
  );
  return { ...turma, horarios: horarios.map((h) => ({ ...h, dia_nome: DIAS_SEMANA[h.dia_semana] })) };
}

/** O dono edita tudo; o mestre edita apenas as turmas em que ele leciona. */
function garantirEdicao(req, turmaId) {
  const turma = um('SELECT * FROM turmas WHERE id = :id', { id: turmaId });
  if (!turma) throw new ErroApi('Turma nao encontrada.', 404);
  if (req.usuario.papel === 'dono') return turma;
  if (req.usuario.papel === 'mestre' && turma.mestre_id === req.usuario.id) return turma;
  throw new ErroApi('Voce so pode alterar as turmas em que e o mestre responsavel.', 403);
}

roteador.get('/', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const filtros = [];
  const params = {};
  if (req.query.modalidade_id) { filtros.push('t.modalidade_id = :modalidade_id'); params.modalidade_id = inteiro(req.query.modalidade_id); }
  if (req.query.categoria) { filtros.push('t.categoria = :categoria'); params.categoria = texto(req.query.categoria); }
  if (req.query.mestre_id) { filtros.push('t.mestre_id = :mestre_id'); params.mestre_id = inteiro(req.query.mestre_id); }
  if (req.query.ativo !== undefined && req.query.ativo !== '') { filtros.push('t.ativo = :ativo'); params.ativo = booleano(req.query.ativo, 1); }

  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const lista = todos(`${SELECT_TURMA} ${onde} ORDER BY m.nome, t.nome`, params);
  res.json(lista.map(comHorarios));
}));

// Grade semanal completa (usada na aba de horarios)
roteador.get('/grade', exigirPapel(...EQUIPE, 'aluno'), rota((_req, res) => {
  const aulas = todos(`
    SELECT h.id AS horario_id, h.dia_semana, h.hora_inicio, h.hora_fim,
           t.id AS turma_id, t.nome AS turma, t.categoria, t.nivel, t.local, t.capacidade,
           m.nome AS modalidade, m.cor AS modalidade_cor,
           u.nome AS mestre,
           (SELECT COUNT(*) FROM aluno_turmas at WHERE at.turma_id = t.id) AS total_alunos
    FROM horarios h
    JOIN turmas t ON t.id = h.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    LEFT JOIN usuarios u ON u.id = t.mestre_id
    WHERE h.ativo = 1 AND t.ativo = 1
    ORDER BY h.dia_semana, h.hora_inicio, m.nome
  `);
  res.json({ dias: DIAS_SEMANA, aulas });
}));

roteador.get('/:id', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const turma = um(`${SELECT_TURMA} WHERE t.id = :id`, { id });
  if (!turma) throw new ErroApi('Turma nao encontrada.', 404);
  const alunos = todos(`
    SELECT a.id, a.nome, a.categoria, a.status
    FROM aluno_turmas at JOIN alunos a ON a.id = at.aluno_id
    WHERE at.turma_id = :id ORDER BY a.nome
  `, { id });
  res.json({ ...comHorarios(turma), alunos });
}));

roteador.post('/', exigirPapel('dono'), rota((req, res) => {
  exigirCampos(req.body, ['nome', 'modalidade_id']);
  const modalidadeId = inteiro(req.body.modalidade_id);
  if (!um('SELECT id FROM modalidades WHERE id = :id', { id: modalidadeId })) {
    throw new ErroApi('Modalidade nao encontrada.', 404);
  }
  const categoria = texto(req.body.categoria, 'adulto');
  if (!CATEGORIAS.includes(categoria)) throw new ErroApi(`Categoria invalida. Use: ${CATEGORIAS.join(', ')}.`);
  const nivel = texto(req.body.nivel, 'todos');
  if (!NIVEIS.includes(nivel)) throw new ErroApi(`Nivel invalido. Use: ${NIVEIS.join(', ')}.`);

  const criada = executar(`
    INSERT INTO turmas (modalidade_id, nome, categoria, nivel, mestre_id, capacidade, local, idade_minima, idade_maxima, ativo)
    VALUES (:modalidade_id, :nome, :categoria, :nivel, :mestre_id, :capacidade, :local, :idade_minima, :idade_maxima, :ativo)
  `, {
    modalidade_id: modalidadeId,
    nome: texto(req.body.nome),
    categoria,
    nivel,
    mestre_id: inteiro(req.body.mestre_id),
    capacidade: inteiro(req.body.capacidade, 30),
    local: texto(req.body.local),
    idade_minima: inteiro(req.body.idade_minima),
    idade_maxima: inteiro(req.body.idade_maxima),
    ativo: booleano(req.body.ativo, 1),
  });
  const id = Number(criada.lastInsertRowid);

  // Permite ja mandar os horarios junto na criacao da turma.
  for (const h of req.body.horarios || []) {
    inserirHorario(id, h);
  }
  res.status(201).json(comHorarios(um(`${SELECT_TURMA} WHERE t.id = :id`, { id })));
}));

roteador.put('/:id', exigirPapel('dono', 'mestre'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = garantirEdicao(req, id);

  executar(`
    UPDATE turmas SET modalidade_id = :modalidade_id, nome = :nome, categoria = :categoria, nivel = :nivel,
           mestre_id = :mestre_id, capacidade = :capacidade, local = :local,
           idade_minima = :idade_minima, idade_maxima = :idade_maxima, ativo = :ativo
    WHERE id = :id
  `, {
    id,
    modalidade_id: inteiro(req.body.modalidade_id, atual.modalidade_id),
    nome: texto(req.body.nome, atual.nome),
    categoria: texto(req.body.categoria, atual.categoria),
    nivel: texto(req.body.nivel, atual.nivel),
    mestre_id: req.body.mestre_id === '' ? null : inteiro(req.body.mestre_id, atual.mestre_id),
    capacidade: inteiro(req.body.capacidade, atual.capacidade),
    local: texto(req.body.local, atual.local),
    idade_minima: inteiro(req.body.idade_minima, atual.idade_minima),
    idade_maxima: inteiro(req.body.idade_maxima, atual.idade_maxima),
    ativo: booleano(req.body.ativo, atual.ativo),
  });
  res.json(comHorarios(um(`${SELECT_TURMA} WHERE t.id = :id`, { id })));
}));

roteador.delete('/:id', exigirPapel('dono'), rota((req, res) => {
  const apagada = executar('DELETE FROM turmas WHERE id = :id', { id: inteiro(req.params.id) });
  if (!apagada.changes) throw new ErroApi('Turma nao encontrada.', 404);
  res.json({ mensagem: 'Turma removida.' });
}));

// ----- Horarios da turma -----

function inserirHorario(turmaId, dados) {
  const dia = inteiro(dados.dia_semana, -1);
  if (dia < 0 || dia > 6) throw new ErroApi('Dia da semana invalido (0 = domingo ... 6 = sabado).');
  const inicio = hora(dados.hora_inicio);
  const fim = hora(dados.hora_fim);
  if (fim <= inicio) throw new ErroApi('O horario final precisa ser maior que o inicial.');

  const conflito = um(`
    SELECT h.id, t.nome AS turma FROM horarios h JOIN turmas t ON t.id = h.turma_id
    WHERE h.turma_id = :turma_id AND h.dia_semana = :dia AND h.hora_inicio = :inicio
  `, { turma_id: turmaId, dia, inicio });
  if (conflito) throw new ErroApi('Esta turma ja tem uma aula neste dia e horario.', 409);

  const criado = executar(
    'INSERT INTO horarios (turma_id, dia_semana, hora_inicio, hora_fim, ativo) VALUES (:turma_id, :dia, :inicio, :fim, 1)',
    { turma_id: turmaId, dia, inicio, fim },
  );
  return Number(criado.lastInsertRowid);
}

roteador.post('/:id/horarios', exigirPapel('dono', 'mestre'), rota((req, res) => {
  const turmaId = inteiro(req.params.id);
  garantirEdicao(req, turmaId);
  const id = inserirHorario(turmaId, req.body || {});
  res.status(201).json(um('SELECT * FROM horarios WHERE id = :id', { id }));
}));

roteador.delete('/:id/horarios/:horarioId', exigirPapel('dono', 'mestre'), rota((req, res) => {
  const turmaId = inteiro(req.params.id);
  garantirEdicao(req, turmaId);
  const apagado = executar('DELETE FROM horarios WHERE id = :id AND turma_id = :turma_id', {
    id: inteiro(req.params.horarioId), turma_id: turmaId,
  });
  if (!apagado.changes) throw new ErroApi('Horario nao encontrado.', 404);
  res.json({ mensagem: 'Horario removido.' });
}));

// ----- Alunos da turma -----

roteador.post('/:id/alunos', exigirPapel(...GESTAO, 'mestre'), rota((req, res) => {
  const turmaId = inteiro(req.params.id);
  const alunoId = inteiro(req.body.aluno_id);
  const turma = um('SELECT * FROM turmas WHERE id = :id', { id: turmaId });
  if (!turma) throw new ErroApi('Turma nao encontrada.', 404);
  if (!um('SELECT id FROM alunos WHERE id = :id', { id: alunoId })) throw new ErroApi('Aluno nao encontrado.', 404);

  const ocupacao = um('SELECT COUNT(*) AS total FROM aluno_turmas WHERE turma_id = :id', { id: turmaId });
  const jaEsta = um('SELECT 1 AS ok FROM aluno_turmas WHERE turma_id = :t AND aluno_id = :a', { t: turmaId, a: alunoId });
  if (!jaEsta && ocupacao.total >= turma.capacidade) {
    throw new ErroApi(`Turma lotada (${turma.capacidade} vagas).`, 409);
  }
  executar('INSERT OR IGNORE INTO aluno_turmas (aluno_id, turma_id) VALUES (:a, :t)', { a: alunoId, t: turmaId });
  res.status(201).json({ mensagem: 'Aluno incluido na turma.' });
}));

roteador.delete('/:id/alunos/:alunoId', exigirPapel(...GESTAO, 'mestre'), rota((req, res) => {
  executar('DELETE FROM aluno_turmas WHERE turma_id = :t AND aluno_id = :a', {
    t: inteiro(req.params.id), a: inteiro(req.params.alunoId),
  });
  res.json({ mensagem: 'Aluno removido da turma.' });
}));

export default roteador;
