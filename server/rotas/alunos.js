import { Router } from 'express';
import { todos, um, executar, transacao } from '../db.js';
import { exigirPapel, EQUIPE, GESTAO } from '../auth.js';
import { gerarHashSenha } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, inteiro, data, hoje, emailValido } from '../util.js';

const roteador = Router();

const STATUS = ['pendente', 'ativo', 'inativo', 'trancado'];

const SELECT_ALUNO = `
  SELECT a.*,
         u.email AS login_email,
         u.ativo AS login_ativo,
         (SELECT p.nome FROM matriculas mt JOIN planos p ON p.id = mt.plano_id
           WHERE mt.aluno_id = a.id AND mt.status = 'ativa' ORDER BY mt.id DESC LIMIT 1) AS plano,
         (SELECT mt.id FROM matriculas mt WHERE mt.aluno_id = a.id AND mt.status = 'ativa' ORDER BY mt.id DESC LIMIT 1) AS matricula_id,
         (SELECT COUNT(*) FROM mensalidades me
           WHERE me.aluno_id = a.id AND me.status = 'pendente' AND me.vencimento < date('now','localtime')) AS mensalidades_atrasadas
  FROM alunos a
  LEFT JOIN usuarios u ON u.id = a.usuario_id
`;

roteador.get('/', exigirPapel(...EQUIPE), rota((req, res) => {
  const filtros = [];
  const params = {};
  if (texto(req.query.busca)) {
    filtros.push('(a.nome LIKE :busca OR a.email LIKE :busca OR a.telefone LIKE :busca)');
    params.busca = `%${texto(req.query.busca)}%`;
  }
  if (texto(req.query.status)) { filtros.push('a.status = :status'); params.status = texto(req.query.status); }
  if (texto(req.query.categoria)) { filtros.push('a.categoria = :categoria'); params.categoria = texto(req.query.categoria); }
  if (inteiro(req.query.turma_id)) {
    filtros.push('a.id IN (SELECT aluno_id FROM aluno_turmas WHERE turma_id = :turma_id)');
    params.turma_id = inteiro(req.query.turma_id);
  }
  if (inteiro(req.query.modalidade_id)) {
    filtros.push(`a.id IN (SELECT at.aluno_id FROM aluno_turmas at
                            JOIN turmas t ON t.id = at.turma_id WHERE t.modalidade_id = :modalidade_id)`);
    params.modalidade_id = inteiro(req.query.modalidade_id);
  }
  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  let lista = todos(`${SELECT_ALUNO} ${onde} ORDER BY a.nome`, params);
  if (texto(req.query.inadimplente) === '1') lista = lista.filter((a) => a.mensalidades_atrasadas > 0);
  res.json(lista);
}));

roteador.get('/:id', exigirPapel(...EQUIPE), rota((req, res) => {
  const id = inteiro(req.params.id);
  const aluno = um(`${SELECT_ALUNO} WHERE a.id = :id`, { id });
  if (!aluno) throw new ErroApi('Aluno não encontrado.', 404);

  const turmas = todos(`
    SELECT t.id, t.nome, t.categoria, t.nivel, m.nome AS modalidade, m.cor AS modalidade_cor
    FROM aluno_turmas at JOIN turmas t ON t.id = at.turma_id JOIN modalidades m ON m.id = t.modalidade_id
    WHERE at.aluno_id = :id ORDER BY m.nome, t.nome
  `, { id });

  const matriculas = todos(`
    SELECT mt.*, p.nome AS plano, p.periodicidade
    FROM matriculas mt JOIN planos p ON p.id = mt.plano_id
    WHERE mt.aluno_id = :id ORDER BY mt.id DESC
  `, { id });

  const mensalidades = todos(
    'SELECT * FROM mensalidades WHERE aluno_id = :id ORDER BY competencia DESC LIMIT 24', { id },
  );

  const graduacoes = todos(`
    SELECT ag.*, g.nome AS graduacao, g.cor, m.nome AS modalidade
    FROM aluno_graduacoes ag
    JOIN graduacoes g ON g.id = ag.graduacao_id
    JOIN modalidades m ON m.id = ag.modalidade_id
    WHERE ag.aluno_id = :id ORDER BY ag.data DESC
  `, { id });

  const presencas = todos(`
    SELECT p.data, p.presente, t.nome AS turma, m.nome AS modalidade
    FROM presencas p JOIN turmas t ON t.id = p.turma_id JOIN modalidades m ON m.id = t.modalidade_id
    WHERE p.aluno_id = :id ORDER BY p.data DESC LIMIT 30
  `, { id });

  res.json({ ...aluno, turmas, matriculas, mensalidades, graduacoes, presencas });
}));

roteador.post('/', exigirPapel(...GESTAO), rota((req, res) => {
  exigirCampos(req.body, ['nome']);
  const email = texto(req.body.email);
  if (email && !emailValido(email)) throw new ErroApi('Informe um e-mail válido.');

  const senha = texto(req.body.senha);
  const criado = transacao(() => {
    let usuarioId = null;
    // Cria o login do aluno quando a recepcao informar e-mail + senha.
    if (email && senha) {
      if (senha.length < 6) throw new ErroApi('A senha precisa ter pelo menos 6 caracteres.');
      if (um('SELECT id FROM usuarios WHERE email = :email', { email })) {
        throw new ErroApi('Já existe um usuário com este e-mail.', 409);
      }
      const usuario = executar(
        `INSERT INTO usuarios (nome, email, senha_hash, papel, telefone)
         VALUES (:nome, :email, :senha_hash, 'aluno', :telefone)`,
        { nome: texto(req.body.nome), email, senha_hash: gerarHashSenha(senha), telefone: texto(req.body.telefone) },
      );
      usuarioId = Number(usuario.lastInsertRowid);
    }
    const aluno = executar(`
      INSERT INTO alunos (usuario_id, nome, email, telefone, data_nascimento, categoria,
                          responsavel_nome, responsavel_telefone, observacoes, status, matriculado_em)
      VALUES (:usuario_id, :nome, :email, :telefone, :data_nascimento, :categoria,
              :responsavel_nome, :responsavel_telefone, :observacoes, :status, :matriculado_em)
    `, {
      usuario_id: usuarioId,
      nome: texto(req.body.nome),
      email,
      telefone: texto(req.body.telefone),
      data_nascimento: data(req.body.data_nascimento),
      categoria: texto(req.body.categoria, 'adulto'),
      responsavel_nome: texto(req.body.responsavel_nome),
      responsavel_telefone: texto(req.body.responsavel_telefone),
      observacoes: texto(req.body.observacoes),
      status: texto(req.body.status, 'ativo'),
      matriculado_em: data(req.body.matriculado_em, hoje()),
    });
    return Number(aluno.lastInsertRowid);
  });

  res.status(201).json(um(`${SELECT_ALUNO} WHERE a.id = :id`, { id: criado }));
}));

roteador.put('/:id', exigirPapel(...GESTAO), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM alunos WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Aluno não encontrado.', 404);

  const status = texto(req.body.status, atual.status);
  if (!STATUS.includes(status)) throw new ErroApi(`Status invalido. Use: ${STATUS.join(', ')}.`);

  executar(`
    UPDATE alunos SET nome = :nome, email = :email, telefone = :telefone, data_nascimento = :data_nascimento,
           categoria = :categoria, responsavel_nome = :responsavel_nome, responsavel_telefone = :responsavel_telefone,
           observacoes = :observacoes, status = :status,
           matriculado_em = COALESCE(matriculado_em, CASE WHEN :status = 'ativo' THEN :hoje END)
    WHERE id = :id
  `, {
    id,
    nome: texto(req.body.nome, atual.nome),
    email: texto(req.body.email, atual.email),
    telefone: texto(req.body.telefone, atual.telefone),
    data_nascimento: data(req.body.data_nascimento, atual.data_nascimento),
    categoria: texto(req.body.categoria, atual.categoria),
    responsavel_nome: texto(req.body.responsavel_nome, atual.responsavel_nome),
    responsavel_telefone: texto(req.body.responsavel_telefone, atual.responsavel_telefone),
    observacoes: texto(req.body.observacoes, atual.observacoes),
    status,
    hoje: hoje(),
  });
  res.json(um(`${SELECT_ALUNO} WHERE a.id = :id`, { id }));
}));

roteador.delete('/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const aluno = um('SELECT * FROM alunos WHERE id = :id', { id });
  if (!aluno) throw new ErroApi('Aluno não encontrado.', 404);
  transacao(() => {
    executar('DELETE FROM alunos WHERE id = :id', { id });
    if (aluno.usuario_id) executar('DELETE FROM usuarios WHERE id = :id', { id: aluno.usuario_id });
  });
  res.json({ mensagem: 'Aluno removido.' });
}));

// ----- Graduacoes do aluno (troca de faixa) -----

roteador.post('/:id/graduacoes', exigirPapel('dono', 'mestre'), rota((req, res) => {
  const alunoId = inteiro(req.params.id);
  exigirCampos(req.body, ['graduacao_id']);
  const graduacao = um('SELECT * FROM graduacoes WHERE id = :id', { id: inteiro(req.body.graduacao_id) });
  if (!graduacao) throw new ErroApi('Graduação não encontrada.', 404);
  if (!um('SELECT id FROM alunos WHERE id = :id', { id: alunoId })) throw new ErroApi('Aluno não encontrado.', 404);

  executar(`
    INSERT INTO aluno_graduacoes (aluno_id, modalidade_id, graduacao_id, data, observacao, registrado_por)
    VALUES (:aluno_id, :modalidade_id, :graduacao_id, :data, :observacao, :registrado_por)
  `, {
    aluno_id: alunoId,
    modalidade_id: graduacao.modalidade_id,
    graduacao_id: graduacao.id,
    data: data(req.body.data, hoje()),
    observacao: texto(req.body.observacao),
    registrado_por: req.usuario.id,
  });
  res.status(201).json({ mensagem: `Graduacao ${graduacao.nome} registrada.` });
}));

export default roteador;
