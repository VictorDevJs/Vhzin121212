import { Router } from 'express';
import { todos, um, executar } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, inteiro, hoje } from '../util.js';

const roteador = Router();

const SELECT_AVALIACAO = `
  SELECT av.*, m.nome AS modalidade, u.nome AS mestre, a.nome AS aluno
  FROM avaliacoes av
  LEFT JOIN modalidades m ON m.id = av.modalidade_id
  LEFT JOIN usuarios u ON u.id = av.mestre_id
  LEFT JOIN alunos a ON a.id = av.aluno_id
`;

/** Media, total e distribuicao das notas aprovadas. */
export function resumoAvaliacoes() {
  const aprovadas = todos(`SELECT nota FROM avaliacoes WHERE status = 'aprovada'`);
  const total = aprovadas.length;
  const soma = aprovadas.reduce((acumulado, item) => acumulado + item.nota, 0);
  const distribuicao = [5, 4, 3, 2, 1].map((nota) => ({
    nota,
    quantidade: aprovadas.filter((item) => item.nota === nota).length,
  }));
  return { total, media: total ? Number((soma / total).toFixed(1)) : 0, distribuicao };
}

/** Valida e grava uma avaliacao nova. Toda avaliacao entra como pendente. */
export function registrarAvaliacao(corpo, { alunoId = null, origem = 'site' } = {}) {
  exigirCampos(corpo, ['autor_nome', 'nota']);
  const nota = inteiro(corpo.nota);
  if (!nota || nota < 1 || nota > 5) throw new ErroApi('A nota precisa ser de 1 a 5 estrelas.');
  const comentario = texto(corpo.comentario);
  if (comentario && comentario.length > 1200) throw new ErroApi('O comentário ficou longo demais (max. 1200 caracteres).');

  const criada = executar(`
    INSERT INTO avaliacoes (aluno_id, autor_nome, autor_contato, nota, comentario, modalidade_id, mestre_id, origem)
    VALUES (:aluno_id, :autor_nome, :autor_contato, :nota, :comentario, :modalidade_id, :mestre_id, :origem)
  `, {
    aluno_id: alunoId,
    autor_nome: texto(corpo.autor_nome).slice(0, 80),
    autor_contato: texto(corpo.autor_contato),
    nota,
    comentario,
    modalidade_id: inteiro(corpo.modalidade_id),
    mestre_id: inteiro(corpo.mestre_id),
    origem,
  });
  return Number(criada.lastInsertRowid);
}

// ---- Area interna: moderacao das avaliacoes ----

roteador.get('/', exigirPapel(...EQUIPE), rota((req, res) => {
  const filtros = [];
  const params = {};
  if (texto(req.query.status)) { filtros.push('av.status = :status'); params.status = texto(req.query.status); }
  if (inteiro(req.query.nota)) { filtros.push('av.nota = :nota'); params.nota = inteiro(req.query.nota); }
  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  res.json({
    resumo: resumoAvaliacoes(),
    pendentes: um(`SELECT COUNT(*) AS total FROM avaliacoes WHERE status = 'pendente'`).total,
    avaliacoes: todos(`${SELECT_AVALIACAO} ${onde} ORDER BY av.criado_em DESC LIMIT 300`, params),
  });
}));

/** O aluno logado avalia a academia, uma modalidade ou um mestre. */
roteador.post('/', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  let alunoId = null;
  let autorNome = req.usuario.nome;
  if (req.usuario.papel === 'aluno') {
    const aluno = um('SELECT id, nome FROM alunos WHERE usuario_id = :id', { id: req.usuario.id });
    if (!aluno) throw new ErroApi('Cadastro de aluno não encontrado.', 404);
    alunoId = aluno.id;
    autorNome = aluno.nome;
  }
  const id = registrarAvaliacao({ ...req.body, autor_nome: autorNome }, { alunoId, origem: 'aluno' });
  res.status(201).json({
    id,
    mensagem: 'Avaliação enviada! Ela aparece no site assim que a academia aprovar.',
  });
}));

roteador.put('/:id', exigirPapel('dono', 'recepcao'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM avaliacoes WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Avaliação não encontrada.', 404);

  const status = texto(req.body.status, atual.status);
  if (!['pendente', 'aprovada', 'recusada'].includes(status)) throw new ErroApi('Status inválido.');
  const resposta = texto(req.body.resposta, atual.resposta);

  executar(`
    UPDATE avaliacoes SET status = :status, resposta = :resposta,
           respondido_em = CASE WHEN :resposta IS NULL THEN respondido_em ELSE :hoje END
    WHERE id = :id
  `, { id, status, resposta, hoje: hoje() });
  res.json(um(`${SELECT_AVALIACAO} WHERE av.id = :id`, { id }));
}));

roteador.delete('/:id', exigirPapel('dono'), rota((req, res) => {
  const apagada = executar('DELETE FROM avaliacoes WHERE id = :id', { id: inteiro(req.params.id) });
  if (!apagada.changes) throw new ErroApi('Avaliação não encontrada.', 404);
  res.json({ mensagem: 'Avaliação removida.' });
}));

/** Avaliacoes do proprio aluno, para ele acompanhar o que enviou. */
roteador.get('/minhas', exigirPapel('aluno'), rota((req, res) => {
  const aluno = um('SELECT id FROM alunos WHERE usuario_id = :id', { id: req.usuario.id });
  if (!aluno) return res.json([]);
  res.json(todos(`${SELECT_AVALIACAO} WHERE av.aluno_id = :id ORDER BY av.criado_em DESC`, { id: aluno.id }));
}));

export default roteador;
