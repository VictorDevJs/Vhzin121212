import { Router } from 'express';
import { todos, um, executar } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, inteiro, booleano, data } from '../util.js';

const roteador = Router();

const TIPOS = ['geral', 'campeonato', 'evento', 'cancelamento', 'manutencao', 'graduacao'];
const PUBLICOS = ['todos', 'kids', 'adultos', 'equipe', 'modalidade', 'turma', 'competidores'];

const SELECT_AVISO = `
  SELECT av.*, u.nome AS autor, m.nome AS modalidade, t.nome AS turma
  FROM avisos av
  LEFT JOIN usuarios u ON u.id = av.autor_id
  LEFT JOIN modalidades m ON m.id = av.modalidade_id
  LEFT JOIN turmas t ON t.id = av.turma_id
`;

/** Monta o filtro que decide quais avisos cada pessoa enxerga. */
export function filtroPorUsuario(usuario) {
  if (usuario.papel !== 'aluno') return { clausula: '', params: {} };

  const aluno = um('SELECT * FROM alunos WHERE usuario_id = :id', { id: usuario.id });
  const categoria = aluno?.categoria === 'kids' ? 'kids' : 'adultos';
  const turmas = aluno
    ? todos('SELECT turma_id FROM aluno_turmas WHERE aluno_id = :id', { id: aluno.id }).map((t) => t.turma_id)
    : [];
  const modalidades = aluno
    ? todos(`SELECT DISTINCT t.modalidade_id FROM aluno_turmas at JOIN turmas t ON t.id = at.turma_id
             WHERE at.aluno_id = :id`, { id: aluno.id }).map((t) => t.modalidade_id)
    : [];

  const listaTurmas = turmas.length ? turmas.join(',') : '-1';
  const listaModalidades = modalidades.length ? modalidades.join(',') : '-1';
  // Quem está em alguma equipe de competição também recebe os avisos de competidores.
  const competidor = aluno
    ? um('SELECT COUNT(*) AS total FROM equipe_membros WHERE aluno_id = :id', { id: aluno.id }).total > 0
    : false;

  return {
    clausula: `av.ativo = 1 AND (
        av.publico = 'todos'
        OR av.publico = :categoria
        OR (av.publico = 'turma' AND av.turma_id IN (${listaTurmas}))
        OR (av.publico = 'modalidade' AND av.modalidade_id IN (${listaModalidades}))
        ${competidor ? `OR av.publico = 'competidores'` : ''}
      )`,
    params: { categoria },
  };
}

/**
 * Modalidades que a pessoa acompanha. O aluno vê só as artes que treina;
 * a equipe vê todas, para poder publicar em qualquer uma.
 */
function modalidadesDoUsuario(usuario) {
  if (usuario.papel !== 'aluno') {
    return todos(`
      SELECT m.id, m.nome, m.cor, m.sigla,
             (SELECT COUNT(*) FROM avisos av
               WHERE av.modalidade_id = m.id AND av.ativo = 1) AS avisos
      FROM modalidades m WHERE m.ativo = 1 ORDER BY m.ordem, m.nome
    `);
  }
  const aluno = um('SELECT id FROM alunos WHERE usuario_id = :id', { id: usuario.id });
  if (!aluno) return [];
  return todos(`
    SELECT DISTINCT m.id, m.nome, m.cor, m.sigla,
           (SELECT COUNT(*) FROM avisos av
             WHERE av.modalidade_id = m.id AND av.ativo = 1) AS avisos
    FROM aluno_turmas at
    JOIN turmas t ON t.id = at.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    WHERE at.aluno_id = :id AND m.ativo = 1
    ORDER BY m.ordem, m.nome
  `, { id: aluno.id });
}

/** Abas de modalidade do mural: cada arte marcial tem o seu próprio quadro. */
roteador.get('/modalidades', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  res.json(modalidadesDoUsuario(req.usuario));
}));

roteador.get('/', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const filtros = [];
  const params = {};
  const { clausula, params: paramsUsuario } = filtroPorUsuario(req.usuario);
  if (clausula) { filtros.push(`(${clausula})`); Object.assign(params, paramsUsuario); }
  if (texto(req.query.tipo)) { filtros.push('av.tipo = :tipo'); params.tipo = texto(req.query.tipo); }
  if (texto(req.query.ativo) === '1') filtros.push('av.ativo = 1');
  // Filtro por arte marcial: mostra o que é daquela modalidade e o que vale para todos.
  if (inteiro(req.query.modalidade_id)) {
    filtros.push('av.modalidade_id = :modalidade_id');
    params.modalidade_id = inteiro(req.query.modalidade_id);
  }
  if (texto(req.query.publico)) { filtros.push('av.publico = :publico'); params.publico = texto(req.query.publico); }

  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  res.json(todos(`${SELECT_AVISO} ${onde} ORDER BY av.fixado DESC, av.criado_em DESC LIMIT 200`, params));
}));

roteador.post('/', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirCampos(req.body, ['titulo', 'mensagem']);
  const tipo = texto(req.body.tipo, 'geral');
  if (!TIPOS.includes(tipo)) throw new ErroApi(`Tipo inválido. Use: ${TIPOS.join(', ')}.`);
  const publico = texto(req.body.publico, 'todos');
  if (!PUBLICOS.includes(publico)) throw new ErroApi(`Público inválido. Use: ${PUBLICOS.join(', ')}.`);
  if (publico === 'modalidade' && !inteiro(req.body.modalidade_id)) throw new ErroApi('Escolha a modalidade do aviso.');
  if (publico === 'turma' && !inteiro(req.body.turma_id)) throw new ErroApi('Escolha a turma do aviso.');

  const criado = executar(`
    INSERT INTO avisos (titulo, mensagem, tipo, publico, modalidade_id, turma_id, data_evento,
                        local_evento, fixado, publicar_site, ativo, autor_id)
    VALUES (:titulo, :mensagem, :tipo, :publico, :modalidade_id, :turma_id, :data_evento,
            :local_evento, :fixado, :publicar_site, 1, :autor_id)
  `, {
    titulo: texto(req.body.titulo),
    mensagem: texto(req.body.mensagem),
    tipo,
    publico,
    modalidade_id: publico === 'modalidade' ? inteiro(req.body.modalidade_id) : null,
    turma_id: publico === 'turma' ? inteiro(req.body.turma_id) : null,
    data_evento: data(req.body.data_evento),
    local_evento: texto(req.body.local_evento),
    fixado: booleano(req.body.fixado, 0),
    publicar_site: booleano(req.body.publicar_site, 1),
    autor_id: req.usuario.id,
  });
  res.status(201).json(um(`${SELECT_AVISO} WHERE av.id = :id`, { id: Number(criado.lastInsertRowid) }));
}));

roteador.put('/:id', exigirPapel(...EQUIPE), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM avisos WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Aviso não encontrado.', 404);
  // O mestre so mexe nos avisos que ele mesmo publicou.
  if (req.usuario.papel === 'mestre' && atual.autor_id !== req.usuario.id) {
    throw new ErroApi('Você só pode editar os avisos publicados por você.', 403);
  }

  executar(`
    UPDATE avisos SET titulo = :titulo, mensagem = :mensagem, tipo = :tipo, publico = :publico,
           modalidade_id = :modalidade_id, turma_id = :turma_id, data_evento = :data_evento,
           local_evento = :local_evento, fixado = :fixado, publicar_site = :publicar_site, ativo = :ativo
    WHERE id = :id
  `, {
    id,
    titulo: texto(req.body.titulo, atual.titulo),
    mensagem: texto(req.body.mensagem, atual.mensagem),
    tipo: texto(req.body.tipo, atual.tipo),
    publico: texto(req.body.publico, atual.publico),
    modalidade_id: inteiro(req.body.modalidade_id, atual.modalidade_id),
    turma_id: inteiro(req.body.turma_id, atual.turma_id),
    data_evento: data(req.body.data_evento, atual.data_evento),
    local_evento: texto(req.body.local_evento, atual.local_evento),
    fixado: booleano(req.body.fixado, atual.fixado),
    publicar_site: booleano(req.body.publicar_site, atual.publicar_site),
    ativo: booleano(req.body.ativo, atual.ativo),
  });
  res.json(um(`${SELECT_AVISO} WHERE av.id = :id`, { id }));
}));

roteador.delete('/:id', exigirPapel(...EQUIPE), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM avisos WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Aviso não encontrado.', 404);
  if (req.usuario.papel === 'mestre' && atual.autor_id !== req.usuario.id) {
    throw new ErroApi('Você só pode remover os avisos publicados por você.', 403);
  }
  executar('DELETE FROM avisos WHERE id = :id', { id });
  res.json({ mensagem: 'Aviso removido.' });
}));

export default roteador;
