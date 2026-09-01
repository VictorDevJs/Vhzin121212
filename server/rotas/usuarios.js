import { Router } from 'express';
import { todos, um, executar } from '../db.js';
import { exigirPapel, gerarHashSenha, EQUIPE } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, booleano, inteiro, emailValido } from '../util.js';

const roteador = Router();
const PAPEIS = ['dono', 'mestre', 'recepcao', 'aluno'];

// Lista de mestres usada nos formularios de turma (toda a equipe consulta).
roteador.get('/mestres', exigirPapel(...EQUIPE), rota((_req, res) => {
  res.json(todos(`SELECT id, nome, email, telefone FROM usuarios WHERE papel = 'mestre' AND ativo = 1 ORDER BY nome`));
}));

roteador.get('/', exigirPapel('dono'), rota((req, res) => {
  const papel = texto(req.query.papel);
  const onde = papel ? 'WHERE papel = :papel' : `WHERE papel != 'aluno'`;
  res.json(todos(`
    SELECT u.id, u.nome, u.email, u.papel, u.telefone, u.ativo, u.criado_em,
           (SELECT COUNT(*) FROM turmas t WHERE t.mestre_id = u.id AND t.ativo = 1) AS turmas
    FROM usuarios u ${onde} ORDER BY u.papel, u.nome
  `, papel ? { papel } : {}));
}));

roteador.post('/', exigirPapel('dono'), rota((req, res) => {
  exigirCampos(req.body, ['nome', 'email', 'senha', 'papel']);
  const email = texto(req.body.email);
  const papel = texto(req.body.papel);
  if (!emailValido(email)) throw new ErroApi('Informe um e-mail valido.');
  if (!PAPEIS.includes(papel)) throw new ErroApi(`Papel invalido. Use: ${PAPEIS.join(', ')}.`);
  if (String(req.body.senha).length < 6) throw new ErroApi('A senha precisa ter pelo menos 6 caracteres.');
  if (um('SELECT id FROM usuarios WHERE email = :email', { email })) {
    throw new ErroApi('Ja existe um usuario com este e-mail.', 409);
  }

  const criado = executar(`
    INSERT INTO usuarios (nome, email, senha_hash, papel, telefone, ativo)
    VALUES (:nome, :email, :senha_hash, :papel, :telefone, :ativo)
  `, {
    nome: texto(req.body.nome),
    email,
    senha_hash: gerarHashSenha(String(req.body.senha)),
    papel,
    telefone: texto(req.body.telefone),
    ativo: booleano(req.body.ativo, 1),
  });
  res.status(201).json(um('SELECT id, nome, email, papel, telefone, ativo FROM usuarios WHERE id = :id',
    { id: Number(criado.lastInsertRowid) }));
}));

roteador.put('/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM usuarios WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Usuario nao encontrado.', 404);

  const papel = texto(req.body.papel, atual.papel);
  if (!PAPEIS.includes(papel)) throw new ErroApi('Papel invalido.');
  const ativo = booleano(req.body.ativo, atual.ativo);
  // Sem essa trava a academia pode ficar sem nenhum dono ativo no sistema.
  if (atual.papel === 'dono' && (papel !== 'dono' || !ativo)) {
    const outros = um(`SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'dono' AND ativo = 1 AND id != :id`, { id });
    if (!outros.total) throw new ErroApi('E preciso manter pelo menos um dono ativo no sistema.', 409);
  }

  executar(`
    UPDATE usuarios SET nome = :nome, email = :email, papel = :papel, telefone = :telefone, ativo = :ativo
    WHERE id = :id
  `, {
    id,
    nome: texto(req.body.nome, atual.nome),
    email: texto(req.body.email, atual.email),
    papel,
    telefone: texto(req.body.telefone, atual.telefone),
    ativo,
  });

  if (texto(req.body.senha)) {
    if (String(req.body.senha).length < 6) throw new ErroApi('A senha precisa ter pelo menos 6 caracteres.');
    executar('UPDATE usuarios SET senha_hash = :hash WHERE id = :id',
      { hash: gerarHashSenha(String(req.body.senha)), id });
  }
  res.json(um('SELECT id, nome, email, papel, telefone, ativo FROM usuarios WHERE id = :id', { id }));
}));

roteador.delete('/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  if (id === req.usuario.id) throw new ErroApi('Voce nao pode excluir o proprio usuario.', 409);
  const apagado = executar('DELETE FROM usuarios WHERE id = :id', { id });
  if (!apagado.changes) throw new ErroApi('Usuario nao encontrado.', 404);
  res.json({ mensagem: 'Usuario removido.' });
}));

export default roteador;
