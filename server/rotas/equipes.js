import { Router } from 'express';
import { todos, um, executar } from '../db.js';
import { exigirPapel, temCargo, registrar, EQUIPE } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, numero, inteiro, booleano, data } from '../util.js';

const roteador = Router();

const CATEGORIAS = ['kids', 'adulto', 'misto', 'feminino'];
const FUNCOES = ['atleta', 'capitao', 'reserva', 'tecnico'];

const SELECT_EQUIPE = `
  SELECT e.*, m.nome AS modalidade, m.cor AS modalidade_cor, u.nome AS tecnico,
         (SELECT COUNT(*) FROM equipe_membros em WHERE em.equipe_id = e.id) AS atletas,
         (SELECT COUNT(*) FROM competicao_resultados r
            JOIN competicao_inscricoes i ON i.id = r.inscricao_id
           WHERE i.equipe_id = e.id AND r.medalha IN ('ouro','prata','bronze')) AS podios
  FROM equipes e
  LEFT JOIN modalidades m ON m.id = e.modalidade_id
  LEFT JOIN usuarios u ON u.id = e.tecnico_id
`;

function exigirResponsavel(req) {
  if (!temCargo(req.usuario, 'competicoes')) {
    throw new ErroApi('Só o Responsável de Competições ou o dono podem montar as equipes.', 403);
  }
}

roteador.get('/', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const filtros = [];
  const params = {};
  if (inteiro(req.query.modalidade_id)) {
    filtros.push('e.modalidade_id = :modalidade_id');
    params.modalidade_id = inteiro(req.query.modalidade_id);
  }
  if (texto(req.query.ativo) === '1') filtros.push('e.ativo = 1');
  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  res.json(todos(`${SELECT_EQUIPE} ${onde} ORDER BY e.ativo DESC, m.ordem, e.nome`, params));
}));

roteador.get('/:id', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const equipe = um(`${SELECT_EQUIPE} WHERE e.id = :id`, { id });
  if (!equipe) throw new ErroApi('Equipe não encontrada.', 404);

  equipe.membros = todos(`
    SELECT em.*, a.nome AS aluno, a.categoria AS categoria_aluno, a.data_nascimento, a.status,
           (SELECT g.nome FROM aluno_graduacoes ag JOIN graduacoes g ON g.id = ag.graduacao_id
             WHERE ag.aluno_id = a.id AND ag.modalidade_id = :modalidade
             ORDER BY ag.data DESC LIMIT 1) AS graduacao,
           (SELECT g.cor FROM aluno_graduacoes ag JOIN graduacoes g ON g.id = ag.graduacao_id
             WHERE ag.aluno_id = a.id AND ag.modalidade_id = :modalidade
             ORDER BY ag.data DESC LIMIT 1) AS graduacao_cor,
           (SELECT COUNT(*) FROM competicao_resultados r
              JOIN competicao_inscricoes i ON i.id = r.inscricao_id
             WHERE i.aluno_id = a.id AND r.medalha = 'ouro') AS ouro
    FROM equipe_membros em
    JOIN alunos a ON a.id = em.aluno_id
    WHERE em.equipe_id = :id
    ORDER BY CASE em.funcao WHEN 'capitao' THEN 0 WHEN 'atleta' THEN 1 ELSE 2 END, a.nome
  `, { id, modalidade: equipe.modalidade_id });

  equipe.competicoes = todos(`
    SELECT c.id, c.nome, c.data_inicio, c.status, COUNT(i.id) AS inscritos
    FROM competicao_inscricoes i
    JOIN competicoes c ON c.id = i.competicao_id
    WHERE i.equipe_id = :id
    GROUP BY c.id ORDER BY c.data_inicio DESC LIMIT 12
  `, { id });
  res.json(equipe);
}));

roteador.post('/', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirResponsavel(req);
  exigirCampos(req.body, ['nome']);
  const categoria = texto(req.body.categoria, 'adulto');
  if (!CATEGORIAS.includes(categoria)) throw new ErroApi(`Categoria inválida. Use: ${CATEGORIAS.join(', ')}.`);

  const criada = executar(`
    INSERT INTO equipes (nome, modalidade_id, categoria, tecnico_id, descricao, cor, imagem, ativo)
    VALUES (:nome, :modalidade_id, :categoria, :tecnico_id, :descricao, :cor, :imagem, :ativo)
  `, {
    nome: texto(req.body.nome),
    modalidade_id: inteiro(req.body.modalidade_id),
    categoria,
    tecnico_id: inteiro(req.body.tecnico_id),
    descricao: texto(req.body.descricao),
    cor: texto(req.body.cor, '#f5b301'),
    imagem: texto(req.body.imagem),
    ativo: booleano(req.body.ativo, 1),
  });
  const id = Number(criada.lastInsertRowid);
  registrar(req, { acao: 'criou', area: 'equipes', alvo: texto(req.body.nome), alvoId: id });
  res.status(201).json(um(`${SELECT_EQUIPE} WHERE e.id = :id`, { id }));
}));

roteador.put('/:id', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirResponsavel(req);
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM equipes WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Equipe não encontrada.', 404);

  executar(`
    UPDATE equipes SET nome = :nome, modalidade_id = :modalidade_id, categoria = :categoria,
           tecnico_id = :tecnico_id, descricao = :descricao, cor = :cor, imagem = :imagem, ativo = :ativo
    WHERE id = :id
  `, {
    id,
    nome: texto(req.body.nome, atual.nome),
    modalidade_id: inteiro(req.body.modalidade_id, atual.modalidade_id),
    categoria: texto(req.body.categoria, atual.categoria),
    tecnico_id: inteiro(req.body.tecnico_id, atual.tecnico_id),
    descricao: texto(req.body.descricao, atual.descricao),
    cor: texto(req.body.cor, atual.cor),
    imagem: texto(req.body.imagem, atual.imagem),
    ativo: booleano(req.body.ativo, atual.ativo),
  });
  registrar(req, { acao: 'alterou', area: 'equipes', alvo: atual.nome, alvoId: id });
  res.json(um(`${SELECT_EQUIPE} WHERE e.id = :id`, { id }));
}));

roteador.delete('/:id', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirResponsavel(req);
  const id = inteiro(req.params.id);
  const atual = um('SELECT nome FROM equipes WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Equipe não encontrada.', 404);
  executar('DELETE FROM equipes WHERE id = :id', { id });
  registrar(req, { acao: 'removeu', area: 'equipes', alvo: atual.nome, alvoId: id });
  res.json({ mensagem: 'Equipe removida.' });
}));

// ------------------------------------------------------------- atletas

roteador.post('/:id/membros', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirResponsavel(req);
  const equipeId = inteiro(req.params.id);
  const equipe = um('SELECT * FROM equipes WHERE id = :id', { id: equipeId });
  if (!equipe) throw new ErroApi('Equipe não encontrada.', 404);

  const alunoId = inteiro(req.body.aluno_id);
  if (!alunoId) throw new ErroApi('Escolha o atleta.');
  const aluno = um('SELECT * FROM alunos WHERE id = :id', { id: alunoId });
  if (!aluno) throw new ErroApi('Aluno não encontrado.', 404);
  if (equipe.categoria === 'kids' && aluno.categoria !== 'kids') {
    throw new ErroApi('Esta é uma equipe kids: escolha um atleta da categoria infantil.');
  }
  if (um('SELECT aluno_id FROM equipe_membros WHERE equipe_id = :e AND aluno_id = :a',
    { e: equipeId, a: alunoId })) {
    throw new ErroApi('Este atleta já faz parte da equipe.', 409);
  }

  const funcao = texto(req.body.funcao, 'atleta');
  if (!FUNCOES.includes(funcao)) throw new ErroApi(`Função inválida. Use: ${FUNCOES.join(', ')}.`);

  executar(`
    INSERT INTO equipe_membros (equipe_id, aluno_id, funcao, peso, categoria_peso, desde)
    VALUES (:equipe, :aluno, :funcao, :peso, :categoria_peso, :desde)
  `, {
    equipe: equipeId,
    aluno: alunoId,
    funcao,
    peso: req.body.peso === undefined || req.body.peso === '' ? null : numero(req.body.peso, 0),
    categoria_peso: texto(req.body.categoria_peso),
    desde: data(req.body.desde),
  });
  registrar(req, { acao: 'incluiu atleta', area: 'equipes', alvo: equipe.nome, alvoId: equipeId });
  res.status(201).json({ mensagem: 'Atleta incluído na equipe.' });
}));

roteador.put('/:id/membros/:alunoId', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirResponsavel(req);
  const equipeId = inteiro(req.params.id);
  const alunoId = inteiro(req.params.alunoId);
  const atual = um('SELECT * FROM equipe_membros WHERE equipe_id = :e AND aluno_id = :a',
    { e: equipeId, a: alunoId });
  if (!atual) throw new ErroApi('Atleta não está nesta equipe.', 404);

  executar(`
    UPDATE equipe_membros SET funcao = :funcao, peso = :peso, categoria_peso = :categoria_peso, desde = :desde
    WHERE equipe_id = :e AND aluno_id = :a
  `, {
    e: equipeId,
    a: alunoId,
    funcao: texto(req.body.funcao, atual.funcao),
    peso: req.body.peso === undefined || req.body.peso === '' ? atual.peso : numero(req.body.peso, atual.peso),
    categoria_peso: texto(req.body.categoria_peso, atual.categoria_peso),
    desde: data(req.body.desde, atual.desde),
  });
  res.json({ mensagem: 'Atleta atualizado.' });
}));

roteador.delete('/:id/membros/:alunoId', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirResponsavel(req);
  const apagado = executar('DELETE FROM equipe_membros WHERE equipe_id = :e AND aluno_id = :a', {
    e: inteiro(req.params.id),
    a: inteiro(req.params.alunoId),
  });
  if (!apagado.changes) throw new ErroApi('Atleta não está nesta equipe.', 404);
  res.json({ mensagem: 'Atleta removido da equipe.' });
}));

export default roteador;
