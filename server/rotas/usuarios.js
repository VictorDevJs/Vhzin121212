import { Router } from 'express';
import { todos, um, executar, transacao } from '../db.js';
import { exigirPapel, gerarHashSenha, registrar, CARGOS, EQUIPE, GESTAO } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, booleano, inteiro, data, emailValido } from '../util.js';

const roteador = Router();
const PAPEIS = ['dono', 'mestre', 'recepcao', 'competicoes', 'aluno'];
const NOMES_CARGOS = CARGOS.map((c) => c.valor);

const SELECT_USUARIO = `
  SELECT u.id, u.nome, u.apelido, u.email, u.papel, u.telefone, u.foto, u.bio, u.faixa,
         u.instagram, u.desde, u.ativo, u.publicar_site, u.ultimo_acesso, u.criado_em,
         (SELECT COUNT(*) FROM turmas t WHERE t.mestre_id = u.id AND t.ativo = 1) AS turmas
  FROM usuarios u
`;

/** Junta cargos e modalidades de cada pessoa da equipe. */
function completar(usuario) {
  if (!usuario) return usuario;
  usuario.cargos = todos(`
    SELECT c.id, c.cargo, c.modalidade_id, m.nome AS modalidade
    FROM usuario_cargos c LEFT JOIN modalidades m ON m.id = c.modalidade_id
    WHERE c.usuario_id = :id ORDER BY c.cargo
  `, { id: usuario.id });
  usuario.modalidades = todos(`
    SELECT m.id, m.nome, m.cor FROM usuario_modalidades um
    JOIN modalidades m ON m.id = um.modalidade_id
    WHERE um.usuario_id = :id ORDER BY m.ordem, m.nome
  `, { id: usuario.id });
  return usuario;
}

/** Recepção e mestres administram a equipe, mas ninguém cria outro dono. */
function conferirPapelAlvo(req, papel) {
  if (papel === 'dono' && req.usuario.papel !== 'dono') {
    throw new ErroApi('Só o dono da academia pode criar ou promover outro dono.', 403);
  }
}

roteador.get('/cargos', exigirPapel(...EQUIPE), rota((_req, res) => res.json(CARGOS)));

// Lista de mestres usada nos formularios de turma (toda a equipe consulta).
roteador.get('/mestres', exigirPapel(...EQUIPE), rota((_req, res) => {
  const mestres = todos(`${SELECT_USUARIO} WHERE u.papel = 'mestre' AND u.ativo = 1 ORDER BY u.nome`);
  res.json(mestres.map(completar));
}));

roteador.get('/', exigirPapel(...EQUIPE), rota((req, res) => {
  const papel = texto(req.query.papel);
  const onde = papel ? 'WHERE u.papel = :papel' : `WHERE u.papel != 'aluno'`;
  const lista = todos(`${SELECT_USUARIO} ${onde} ORDER BY
    CASE u.papel WHEN 'dono' THEN 0 WHEN 'mestre' THEN 1 WHEN 'competicoes' THEN 2 ELSE 3 END, u.nome`,
  papel ? { papel } : {});
  res.json(lista.map(completar));
}));

roteador.get('/:id', exigirPapel(...EQUIPE), rota((req, res) => {
  const usuario = um(`${SELECT_USUARIO} WHERE u.id = :id`, { id: inteiro(req.params.id) });
  if (!usuario) throw new ErroApi('Usuário não encontrado.', 404);
  res.json(completar(usuario));
}));

roteador.post('/', exigirPapel(...GESTAO, 'mestre'), rota((req, res) => {
  exigirCampos(req.body, ['nome', 'email', 'senha', 'papel']);
  const email = texto(req.body.email);
  const papel = texto(req.body.papel);
  if (!emailValido(email)) throw new ErroApi('Informe um e-mail válido.');
  if (!PAPEIS.includes(papel)) throw new ErroApi(`Papel inválido. Use: ${PAPEIS.join(', ')}.`);
  conferirPapelAlvo(req, papel);
  if (String(req.body.senha).length < 6) throw new ErroApi('A senha precisa ter pelo menos 6 caracteres.');
  if (um('SELECT id FROM usuarios WHERE email = :email', { email })) {
    throw new ErroApi('Já existe um usuário com este e-mail.', 409);
  }

  const id = transacao(() => {
    const criado = executar(`
      INSERT INTO usuarios (nome, apelido, email, senha_hash, papel, telefone, foto, bio, faixa,
                            instagram, desde, publicar_site, ativo)
      VALUES (:nome, :apelido, :email, :senha_hash, :papel, :telefone, :foto, :bio, :faixa,
              :instagram, :desde, :publicar_site, :ativo)
    `, {
      nome: texto(req.body.nome),
      apelido: texto(req.body.apelido),
      email,
      senha_hash: gerarHashSenha(String(req.body.senha)),
      papel,
      telefone: texto(req.body.telefone),
      foto: texto(req.body.foto),
      bio: texto(req.body.bio),
      faixa: texto(req.body.faixa),
      instagram: texto(req.body.instagram),
      desde: data(req.body.desde),
      publicar_site: booleano(req.body.publicar_site, 1),
      ativo: booleano(req.body.ativo, 1),
    });
    const novo = Number(criado.lastInsertRowid);
    salvarModalidades(novo, req.body.modalidades);
    return novo;
  });

  registrar(req, { acao: 'cadastrou', area: 'equipe', alvo: texto(req.body.nome), alvoId: id,
    detalhe: `Função: ${papel}` });
  res.status(201).json(completar(um(`${SELECT_USUARIO} WHERE u.id = :id`, { id })));
}));

roteador.put('/:id', exigirPapel(...GESTAO, 'mestre'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM usuarios WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Usuário não encontrado.', 404);
  if (atual.papel === 'dono' && req.usuario.papel !== 'dono') {
    throw new ErroApi('Só o dono da academia pode editar a conta do dono.', 403);
  }

  const papel = texto(req.body.papel, atual.papel);
  if (!PAPEIS.includes(papel)) throw new ErroApi('Papel inválido.');
  conferirPapelAlvo(req, papel);
  const ativo = booleano(req.body.ativo, atual.ativo);
  // Sem essa trava a academia pode ficar sem nenhum dono ativo no sistema.
  if (atual.papel === 'dono' && (papel !== 'dono' || !ativo)) {
    const outros = um(`SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'dono' AND ativo = 1 AND id != :id`, { id });
    if (!outros.total) throw new ErroApi('É preciso manter pelo menos um dono ativo no sistema.', 409);
  }

  transacao(() => {
    executar(`
      UPDATE usuarios SET nome = :nome, apelido = :apelido, email = :email, papel = :papel,
             telefone = :telefone, foto = :foto, bio = :bio, faixa = :faixa, instagram = :instagram,
             desde = :desde, publicar_site = :publicar_site, ativo = :ativo
      WHERE id = :id
    `, {
      id,
      nome: texto(req.body.nome, atual.nome),
      apelido: texto(req.body.apelido, atual.apelido),
      email: texto(req.body.email, atual.email),
      papel,
      telefone: texto(req.body.telefone, atual.telefone),
      foto: texto(req.body.foto, atual.foto),
      bio: texto(req.body.bio, atual.bio),
      faixa: texto(req.body.faixa, atual.faixa),
      instagram: texto(req.body.instagram, atual.instagram),
      desde: data(req.body.desde, atual.desde),
      publicar_site: booleano(req.body.publicar_site, atual.publicar_site),
      ativo,
    });
    if (req.body.modalidades !== undefined) salvarModalidades(id, req.body.modalidades);
  });

  if (texto(req.body.senha)) {
    if (String(req.body.senha).length < 6) throw new ErroApi('A senha precisa ter pelo menos 6 caracteres.');
    executar('UPDATE usuarios SET senha_hash = :hash WHERE id = :id',
      { hash: gerarHashSenha(String(req.body.senha)), id });
    registrar(req, { acao: 'trocou a senha de', area: 'seguranca', alvo: atual.nome, alvoId: id });
  }
  registrar(req, { acao: 'alterou', area: 'equipe', alvo: atual.nome, alvoId: id });
  res.json(completar(um(`${SELECT_USUARIO} WHERE u.id = :id`, { id })));
}));

roteador.delete('/:id', exigirPapel('dono', 'recepcao'), rota((req, res) => {
  const id = inteiro(req.params.id);
  if (id === req.usuario.id) throw new ErroApi('Você não pode excluir o próprio usuário.', 409);
  const atual = um('SELECT nome, papel FROM usuarios WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Usuário não encontrado.', 404);
  if (atual.papel === 'dono') throw new ErroApi('A conta do dono não pode ser excluída.', 409);
  if (atual.papel !== 'aluno' && req.usuario.papel !== 'dono' && atual.papel !== 'mestre') {
    throw new ErroApi('A recepção só pode remover mestres e alunos.', 403);
  }

  const turmas = um('SELECT COUNT(*) AS total FROM turmas WHERE mestre_id = :id AND ativo = 1', { id });
  if (turmas.total > 0) {
    throw new ErroApi(
      `Este mestre ainda responde por ${turmas.total} turma(s). Troque o professor das turmas antes de remover.`, 409);
  }

  executar('DELETE FROM usuarios WHERE id = :id', { id });
  registrar(req, { acao: 'removeu', area: 'equipe', alvo: atual.nome, alvoId: id });
  res.json({ mensagem: 'Usuário removido.' });
}));

// --------------------------------------------------------------- cargos

roteador.post('/:id/cargos', exigirPapel(...GESTAO, 'mestre'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const usuario = um('SELECT nome FROM usuarios WHERE id = :id', { id });
  if (!usuario) throw new ErroApi('Usuário não encontrado.', 404);

  const cargo = texto(req.body.cargo);
  if (!NOMES_CARGOS.includes(cargo)) throw new ErroApi(`Cargo inválido. Use: ${NOMES_CARGOS.join(', ')}.`);
  const modalidadeId = inteiro(req.body.modalidade_id);
  if (um(`SELECT id FROM usuario_cargos WHERE usuario_id = :id AND cargo = :cargo
          AND IFNULL(modalidade_id, -1) = IFNULL(:modalidade, -1)`,
  { id, cargo, modalidade: modalidadeId })) {
    throw new ErroApi('Esta pessoa já tem esse cargo.', 409);
  }

  executar(`
    INSERT INTO usuario_cargos (usuario_id, cargo, modalidade_id, observacao, criado_por)
    VALUES (:id, :cargo, :modalidade, :observacao, :por)
  `, {
    id, cargo, modalidade: modalidadeId,
    observacao: texto(req.body.observacao),
    por: req.usuario.id,
  });
  registrar(req, { acao: 'atribuiu cargo', area: 'seguranca', alvo: usuario.nome, alvoId: id, detalhe: cargo });
  res.status(201).json(completar(um(`${SELECT_USUARIO} WHERE u.id = :id`, { id })));
}));

roteador.delete('/:id/cargos/:cargoId', exigirPapel(...GESTAO, 'mestre'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const apagado = executar('DELETE FROM usuario_cargos WHERE id = :cargo AND usuario_id = :id',
    { cargo: inteiro(req.params.cargoId), id });
  if (!apagado.changes) throw new ErroApi('Cargo não encontrado.', 404);
  registrar(req, { acao: 'retirou cargo', area: 'seguranca', alvoId: id });
  res.json(completar(um(`${SELECT_USUARIO} WHERE u.id = :id`, { id })));
}));

function salvarModalidades(usuarioId, lista) {
  executar('DELETE FROM usuario_modalidades WHERE usuario_id = :id', { id: usuarioId });
  for (const modalidadeId of [].concat(lista || [])) {
    const id = inteiro(modalidadeId);
    if (!id) continue;
    executar('INSERT OR IGNORE INTO usuario_modalidades (usuario_id, modalidade_id) VALUES (:u, :m)',
      { u: usuarioId, m: id });
  }
}

export default roteador;
