import { Router } from 'express';
import { um, executar, transacao } from '../db.js';
import { gerarHashSenha, conferirSenha, gerarToken, exigirLogin } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, emailValido, hoje } from '../util.js';

const roteador = Router();

function perfilCompleto(usuario) {
  const aluno = um('SELECT * FROM alunos WHERE usuario_id = :id', { id: usuario.id });
  return { ...usuario, aluno: aluno || null };
}

/** Calcula se o aluno entra na categoria kids (menor de 16 anos). */
function categoriaPorIdade(dataNascimento) {
  if (!dataNascimento) return 'adulto';
  const nascimento = new Date(`${dataNascimento}T00:00:00`);
  if (Number.isNaN(nascimento.getTime())) return 'adulto';
  const idade = (Date.now() - nascimento.getTime()) / (365.25 * 24 * 3600 * 1000);
  return idade < 16 ? 'kids' : 'adulto';
}

// Cadastro aberto: o proprio aluno cria a conta e entra na lista de pendentes.
roteador.post('/registrar', rota((req, res) => {
  const { nome, email, senha, telefone, data_nascimento, responsavel_nome, responsavel_telefone, observacoes } = req.body || {};
  exigirCampos(req.body, ['nome', 'email', 'senha']);

  if (!emailValido(email)) throw new ErroApi('Informe um e-mail válido.');
  if (String(senha).length < 6) throw new ErroApi('A senha precisa ter pelo menos 6 caracteres.');

  const jaExiste = um('SELECT id FROM usuarios WHERE email = :email', { email: texto(email) });
  if (jaExiste) throw new ErroApi('Já existe uma conta com este e-mail.', 409);

  const categoria = categoriaPorIdade(texto(data_nascimento));

  const usuario = transacao(() => {
    const criado = executar(
      `INSERT INTO usuarios (nome, email, senha_hash, papel, telefone)
       VALUES (:nome, :email, :senha_hash, 'aluno', :telefone)`,
      {
        nome: texto(nome),
        email: texto(email),
        senha_hash: gerarHashSenha(String(senha)),
        telefone: texto(telefone),
      },
    );
    const usuarioId = Number(criado.lastInsertRowid);
    executar(
      `INSERT INTO alunos (usuario_id, nome, email, telefone, data_nascimento, categoria,
                           responsavel_nome, responsavel_telefone, observacoes, status)
       VALUES (:usuario_id, :nome, :email, :telefone, :data_nascimento, :categoria,
               :responsavel_nome, :responsavel_telefone, :observacoes, 'pendente')`,
      {
        usuario_id: usuarioId,
        nome: texto(nome),
        email: texto(email),
        telefone: texto(telefone),
        data_nascimento: texto(data_nascimento),
        categoria,
        responsavel_nome: texto(responsavel_nome),
        responsavel_telefone: texto(responsavel_telefone),
        observacoes: texto(observacoes),
      },
    );
    return um('SELECT id, nome, email, papel, telefone, ativo FROM usuarios WHERE id = :id', { id: usuarioId });
  });

  res.status(201).json({
    token: gerarToken(usuario),
    usuario: perfilCompleto(usuario),
    mensagem: 'Cadastro realizado! A recepção vai confirmar sua matrícula e liberar seu plano.',
  });
}));

roteador.post('/login', rota((req, res) => {
  const { email, senha } = req.body || {};
  exigirCampos(req.body, ['email', 'senha']);

  const usuario = um('SELECT * FROM usuarios WHERE email = :email', { email: texto(email) });
  if (!usuario || !conferirSenha(String(senha), usuario.senha_hash)) {
    throw new ErroApi('E-mail ou senha incorretos.', 401);
  }
  if (!usuario.ativo) throw new ErroApi('Sua conta esta desativada. Fale com a recepção.', 403);

  const { senha_hash, ...publico } = usuario;
  res.json({ token: gerarToken(usuario), usuario: perfilCompleto(publico) });
}));

roteador.get('/eu', exigirLogin, rota((req, res) => {
  res.json({ usuario: perfilCompleto(req.usuario) });
}));

roteador.put('/senha', exigirLogin, rota((req, res) => {
  const { senha_atual, senha_nova } = req.body || {};
  exigirCampos(req.body, ['senha_atual', 'senha_nova']);
  if (String(senha_nova).length < 6) throw new ErroApi('A nova senha precisa ter pelo menos 6 caracteres.');

  const usuario = um('SELECT * FROM usuarios WHERE id = :id', { id: req.usuario.id });
  if (!conferirSenha(String(senha_atual), usuario.senha_hash)) {
    throw new ErroApi('Senha atual incorreta.', 401);
  }
  executar('UPDATE usuarios SET senha_hash = :hash WHERE id = :id', {
    hash: gerarHashSenha(String(senha_nova)),
    id: req.usuario.id,
  });
  res.json({ mensagem: 'Senha atualizada.', em: hoje() });
}));

export default roteador;
