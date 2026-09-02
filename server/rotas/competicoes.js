import { Router } from 'express';
import { todos, um, executar, transacao } from '../db.js';
import { exigirPapel, temCargo, registrar, EQUIPE } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, numero, inteiro, booleano, data, hoje } from '../util.js';
import { CATEGORIAS_PESO } from '../graduacoes-padrao.js';

const roteador = Router();

const TIPOS = ['campeonato', 'seletiva', 'festival', 'interno', 'amistoso', 'graduacao'];
const NIVEIS = ['interno', 'municipal', 'estadual', 'nacional', 'internacional'];
const STATUS = ['agendada', 'inscricoes', 'encerrada', 'realizada', 'cancelada'];
const STATUS_INSCRICAO = ['interesse', 'inscrito', 'confirmado', 'desistiu'];
const MEDALHAS = ['ouro', 'prata', 'bronze', 'participacao'];

const SELECT_COMPETICAO = `
  SELECT c.*, m.nome AS modalidade, m.cor AS modalidade_cor, u.nome AS responsavel,
         (SELECT COUNT(*) FROM competicao_inscricoes i
           WHERE i.competicao_id = c.id AND i.status != 'desistiu') AS inscritos,
         (SELECT COUNT(*) FROM competicao_inscricoes i
           WHERE i.competicao_id = c.id AND i.status = 'confirmado') AS confirmados,
         (SELECT COUNT(*) FROM competicao_inscricoes i
           JOIN competicao_resultados r ON r.inscricao_id = i.id
           WHERE i.competicao_id = c.id AND r.medalha IN ('ouro','prata','bronze')) AS podios
  FROM competicoes c
  LEFT JOIN modalidades m ON m.id = c.modalidade_id
  LEFT JOIN usuarios u ON u.id = c.responsavel_id
`;

/** Só o responsável de competições (ou o dono) publica e altera o calendário. */
function exigirResponsavel(req) {
  if (!temCargo(req.usuario, 'competicoes')) {
    throw new ErroApi('Só o Responsável de Competições ou o dono podem mexer no calendário.', 403);
  }
}

/** Aluno vinculado ao usuário logado, usado nas telas do próprio atleta. */
function alunoDoUsuario(usuario) {
  return um('SELECT * FROM alunos WHERE usuario_id = :id', { id: usuario.id });
}

roteador.get('/categorias-peso', exigirPapel(...EQUIPE, 'aluno'), rota((_req, res) => {
  res.json(CATEGORIAS_PESO);
}));

roteador.get('/', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const filtros = [];
  const params = {};
  if (inteiro(req.query.modalidade_id)) {
    filtros.push('c.modalidade_id = :modalidade_id');
    params.modalidade_id = inteiro(req.query.modalidade_id);
  }
  if (texto(req.query.status)) { filtros.push('c.status = :status'); params.status = texto(req.query.status); }
  if (texto(req.query.periodo) === 'futuras') filtros.push(`c.data_inicio >= date('now','localtime')`);
  if (texto(req.query.periodo) === 'passadas') filtros.push(`c.data_inicio < date('now','localtime')`);

  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const lista = todos(`${SELECT_COMPETICAO} ${onde} ORDER BY c.data_inicio DESC LIMIT 200`, params);

  // O aluno enxerga na hora se ele já está inscrito em cada competição.
  const aluno = req.usuario.papel === 'aluno' ? alunoDoUsuario(req.usuario) : null;
  if (aluno) {
    const minhas = new Map(todos(
      'SELECT competicao_id, status FROM competicao_inscricoes WHERE aluno_id = :id', { id: aluno.id },
    ).map((i) => [i.competicao_id, i.status]));
    for (const competicao of lista) competicao.minha_inscricao = minhas.get(competicao.id) || null;
  }
  res.json(lista);
}));

roteador.get('/agenda', exigirPapel(...EQUIPE, 'aluno'), rota((_req, res) => {
  res.json({
    proximas: todos(`${SELECT_COMPETICAO}
      WHERE c.data_inicio >= date('now','localtime') AND c.status != 'cancelada'
      ORDER BY c.data_inicio LIMIT 6`),
    quadro_medalhas: quadroDeMedalhas(),
  });
}));

/** Ranking de medalhas por modalidade e por atleta. */
export function quadroDeMedalhas() {
  const porModalidade = todos(`
    SELECT m.id, m.nome AS modalidade, m.cor,
           SUM(CASE WHEN r.medalha = 'ouro' THEN 1 ELSE 0 END) AS ouro,
           SUM(CASE WHEN r.medalha = 'prata' THEN 1 ELSE 0 END) AS prata,
           SUM(CASE WHEN r.medalha = 'bronze' THEN 1 ELSE 0 END) AS bronze,
           COUNT(*) AS participacoes
    FROM competicao_resultados r
    JOIN competicao_inscricoes i ON i.id = r.inscricao_id
    JOIN competicoes c ON c.id = i.competicao_id
    LEFT JOIN modalidades m ON m.id = c.modalidade_id
    GROUP BY m.id ORDER BY ouro DESC, prata DESC, bronze DESC
  `);
  const atletas = todos(`
    SELECT a.id, a.nome,
           SUM(CASE WHEN r.medalha = 'ouro' THEN 1 ELSE 0 END) AS ouro,
           SUM(CASE WHEN r.medalha = 'prata' THEN 1 ELSE 0 END) AS prata,
           SUM(CASE WHEN r.medalha = 'bronze' THEN 1 ELSE 0 END) AS bronze,
           COUNT(*) AS competicoes,
           SUM(r.vitorias) AS vitorias, SUM(r.lutas) AS lutas
    FROM competicao_resultados r
    JOIN competicao_inscricoes i ON i.id = r.inscricao_id
    JOIN alunos a ON a.id = i.aluno_id
    GROUP BY a.id ORDER BY ouro DESC, prata DESC, bronze DESC, vitorias DESC LIMIT 20
  `);
  return { por_modalidade: porModalidade, atletas };
}

roteador.get('/:id', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const competicao = um(`${SELECT_COMPETICAO} WHERE c.id = :id`, { id });
  if (!competicao) throw new ErroApi('Competição não encontrada.', 404);

  competicao.inscricoes = todos(`
    SELECT i.*, a.nome AS aluno, a.categoria AS categoria_aluno, e.nome AS equipe,
           g.nome AS graduacao, g.cor AS graduacao_cor,
           r.colocacao, r.medalha, r.lutas, r.vitorias, r.finalizacoes, r.observacao AS resultado_observacao
    FROM competicao_inscricoes i
    JOIN alunos a ON a.id = i.aluno_id
    LEFT JOIN equipes e ON e.id = i.equipe_id
    LEFT JOIN graduacoes g ON g.id = i.graduacao_id
    LEFT JOIN competicao_resultados r ON r.inscricao_id = i.id
    WHERE i.competicao_id = :id
    ORDER BY r.colocacao, a.nome
  `, { id });
  res.json(competicao);
}));

roteador.post('/', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirResponsavel(req);
  exigirCampos(req.body, ['nome', 'data_inicio']);
  const tipo = texto(req.body.tipo, 'campeonato');
  const nivel = texto(req.body.nivel, 'estadual');
  const status = texto(req.body.status, 'agendada');
  if (!TIPOS.includes(tipo)) throw new ErroApi(`Tipo inválido. Use: ${TIPOS.join(', ')}.`);
  if (!NIVEIS.includes(nivel)) throw new ErroApi(`Nível inválido. Use: ${NIVEIS.join(', ')}.`);
  if (!STATUS.includes(status)) throw new ErroApi(`Situação inválida. Use: ${STATUS.join(', ')}.`);

  const criada = executar(`
    INSERT INTO competicoes (nome, modalidade_id, tipo, nivel, organizador, data_inicio, data_fim,
                             inscricao_ate, local, cidade, endereco, taxa, vagas, descricao, regulamento,
                             cartaz, link, responsavel_id, status, publicar_site, criado_por)
    VALUES (:nome, :modalidade_id, :tipo, :nivel, :organizador, :data_inicio, :data_fim,
            :inscricao_ate, :local, :cidade, :endereco, :taxa, :vagas, :descricao, :regulamento,
            :cartaz, :link, :responsavel_id, :status, :publicar_site, :criado_por)
  `, {
    nome: texto(req.body.nome),
    modalidade_id: inteiro(req.body.modalidade_id),
    tipo,
    nivel,
    organizador: texto(req.body.organizador),
    data_inicio: data(req.body.data_inicio),
    data_fim: data(req.body.data_fim),
    inscricao_ate: data(req.body.inscricao_ate),
    local: texto(req.body.local),
    cidade: texto(req.body.cidade),
    endereco: texto(req.body.endereco),
    taxa: numero(req.body.taxa, 0),
    vagas: inteiro(req.body.vagas, 0),
    descricao: texto(req.body.descricao),
    regulamento: texto(req.body.regulamento),
    cartaz: texto(req.body.cartaz),
    link: texto(req.body.link),
    responsavel_id: inteiro(req.body.responsavel_id, req.usuario.id),
    status,
    publicar_site: booleano(req.body.publicar_site, 1),
    criado_por: req.usuario.id,
  });

  const id = Number(criada.lastInsertRowid);
  registrar(req, { acao: 'criou', area: 'competicoes', alvo: texto(req.body.nome), alvoId: id });
  res.status(201).json(um(`${SELECT_COMPETICAO} WHERE c.id = :id`, { id }));
}));

roteador.put('/:id', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirResponsavel(req);
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM competicoes WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Competição não encontrada.', 404);

  executar(`
    UPDATE competicoes SET nome = :nome, modalidade_id = :modalidade_id, tipo = :tipo, nivel = :nivel,
           organizador = :organizador, data_inicio = :data_inicio, data_fim = :data_fim,
           inscricao_ate = :inscricao_ate, local = :local, cidade = :cidade, endereco = :endereco,
           taxa = :taxa, vagas = :vagas, descricao = :descricao, regulamento = :regulamento,
           cartaz = :cartaz, link = :link, responsavel_id = :responsavel_id, status = :status,
           publicar_site = :publicar_site
    WHERE id = :id
  `, {
    id,
    nome: texto(req.body.nome, atual.nome),
    modalidade_id: inteiro(req.body.modalidade_id, atual.modalidade_id),
    tipo: texto(req.body.tipo, atual.tipo),
    nivel: texto(req.body.nivel, atual.nivel),
    organizador: texto(req.body.organizador, atual.organizador),
    data_inicio: data(req.body.data_inicio, atual.data_inicio),
    data_fim: data(req.body.data_fim, atual.data_fim),
    inscricao_ate: data(req.body.inscricao_ate, atual.inscricao_ate),
    local: texto(req.body.local, atual.local),
    cidade: texto(req.body.cidade, atual.cidade),
    endereco: texto(req.body.endereco, atual.endereco),
    taxa: numero(req.body.taxa, atual.taxa),
    vagas: inteiro(req.body.vagas, atual.vagas),
    descricao: texto(req.body.descricao, atual.descricao),
    regulamento: texto(req.body.regulamento, atual.regulamento),
    cartaz: texto(req.body.cartaz, atual.cartaz),
    link: texto(req.body.link, atual.link),
    responsavel_id: inteiro(req.body.responsavel_id, atual.responsavel_id),
    status: texto(req.body.status, atual.status),
    publicar_site: booleano(req.body.publicar_site, atual.publicar_site),
  });
  registrar(req, { acao: 'alterou', area: 'competicoes', alvo: atual.nome, alvoId: id });
  res.json(um(`${SELECT_COMPETICAO} WHERE c.id = :id`, { id }));
}));

roteador.delete('/:id', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirResponsavel(req);
  const id = inteiro(req.params.id);
  const atual = um('SELECT nome FROM competicoes WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Competição não encontrada.', 404);
  executar('DELETE FROM competicoes WHERE id = :id', { id });
  registrar(req, { acao: 'removeu', area: 'competicoes', alvo: atual.nome, alvoId: id });
  res.json({ mensagem: 'Competição removida.' });
}));

// ---------------------------------------------------------- inscrições

roteador.post('/:id/inscricoes', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const competicaoId = inteiro(req.params.id);
  const competicao = um('SELECT * FROM competicoes WHERE id = :id', { id: competicaoId });
  if (!competicao) throw new ErroApi('Competição não encontrada.', 404);
  if (competicao.status === 'cancelada') throw new ErroApi('Esta competição foi cancelada.');

  // O aluno só inscreve a si mesmo; a equipe inscreve qualquer atleta.
  let alunoId;
  if (req.usuario.papel === 'aluno') {
    const aluno = alunoDoUsuario(req.usuario);
    if (!aluno) throw new ErroApi('Sua ficha de aluno ainda não foi criada. Fale com a recepção.', 404);
    alunoId = aluno.id;
    if (competicao.inscricao_ate && competicao.inscricao_ate < hoje()) {
      throw new ErroApi('O prazo de inscrição já encerrou. Fale com o responsável de competições.');
    }
  } else {
    exigirResponsavel(req);
    alunoId = inteiro(req.body.aluno_id);
    if (!alunoId) throw new ErroApi('Escolha o atleta.');
  }

  if (um('SELECT id FROM competicao_inscricoes WHERE competicao_id = :c AND aluno_id = :a',
    { c: competicaoId, a: alunoId })) {
    throw new ErroApi('Este atleta já está inscrito nesta competição.', 409);
  }
  if (competicao.vagas > 0) {
    const usadas = um(`SELECT COUNT(*) AS total FROM competicao_inscricoes
                       WHERE competicao_id = :c AND status != 'desistiu'`, { c: competicaoId });
    if (usadas.total >= competicao.vagas) throw new ErroApi('As vagas desta competição acabaram.', 409);
  }

  const status = req.usuario.papel === 'aluno' ? 'interesse' : texto(req.body.status, 'inscrito');
  if (!STATUS_INSCRICAO.includes(status)) throw new ErroApi('Situação de inscrição inválida.');

  const criada = executar(`
    INSERT INTO competicao_inscricoes (competicao_id, aluno_id, equipe_id, graduacao_id, categoria_peso,
                                       peso, categoria_idade, status, taxa_paga, observacao, criado_por)
    VALUES (:competicao_id, :aluno_id, :equipe_id, :graduacao_id, :categoria_peso, :peso,
            :categoria_idade, :status, :taxa_paga, :observacao, :criado_por)
  `, {
    competicao_id: competicaoId,
    aluno_id: alunoId,
    equipe_id: inteiro(req.body.equipe_id),
    graduacao_id: inteiro(req.body.graduacao_id),
    categoria_peso: texto(req.body.categoria_peso),
    peso: req.body.peso === undefined || req.body.peso === '' ? null : numero(req.body.peso, 0),
    categoria_idade: texto(req.body.categoria_idade),
    status,
    taxa_paga: booleano(req.body.taxa_paga, 0),
    observacao: texto(req.body.observacao),
    criado_por: req.usuario.id,
  });
  registrar(req, { acao: 'inscreveu atleta', area: 'competicoes', alvo: competicao.nome, alvoId: competicaoId });
  res.status(201).json(um('SELECT * FROM competicao_inscricoes WHERE id = :id',
    { id: Number(criada.lastInsertRowid) }));
}));

roteador.put('/:id/inscricoes/:inscricaoId', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirResponsavel(req);
  const inscricaoId = inteiro(req.params.inscricaoId);
  const atual = um('SELECT * FROM competicao_inscricoes WHERE id = :id AND competicao_id = :c',
    { id: inscricaoId, c: inteiro(req.params.id) });
  if (!atual) throw new ErroApi('Inscrição não encontrada.', 404);

  executar(`
    UPDATE competicao_inscricoes SET equipe_id = :equipe_id, graduacao_id = :graduacao_id,
           categoria_peso = :categoria_peso, peso = :peso, categoria_idade = :categoria_idade,
           status = :status, taxa_paga = :taxa_paga, observacao = :observacao
    WHERE id = :id
  `, {
    id: inscricaoId,
    equipe_id: inteiro(req.body.equipe_id, atual.equipe_id),
    graduacao_id: inteiro(req.body.graduacao_id, atual.graduacao_id),
    categoria_peso: texto(req.body.categoria_peso, atual.categoria_peso),
    peso: req.body.peso === undefined || req.body.peso === '' ? atual.peso : numero(req.body.peso, atual.peso),
    categoria_idade: texto(req.body.categoria_idade, atual.categoria_idade),
    status: texto(req.body.status, atual.status),
    taxa_paga: booleano(req.body.taxa_paga, atual.taxa_paga),
    observacao: texto(req.body.observacao, atual.observacao),
  });
  res.json(um('SELECT * FROM competicao_inscricoes WHERE id = :id', { id: inscricaoId }));
}));

roteador.delete('/:id/inscricoes/:inscricaoId', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const inscricaoId = inteiro(req.params.inscricaoId);
  const atual = um('SELECT * FROM competicao_inscricoes WHERE id = :id', { id: inscricaoId });
  if (!atual) throw new ErroApi('Inscrição não encontrada.', 404);
  if (req.usuario.papel === 'aluno') {
    const aluno = alunoDoUsuario(req.usuario);
    if (!aluno || aluno.id !== atual.aluno_id) throw new ErroApi('Você só pode cancelar a sua inscrição.', 403);
  } else {
    exigirResponsavel(req);
  }
  executar('DELETE FROM competicao_inscricoes WHERE id = :id', { id: inscricaoId });
  res.json({ mensagem: 'Inscrição cancelada.' });
}));

// ----------------------------------------------------------- resultados

roteador.put('/:id/resultados/:inscricaoId', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirResponsavel(req);
  const inscricaoId = inteiro(req.params.inscricaoId);
  const inscricao = um('SELECT * FROM competicao_inscricoes WHERE id = :id AND competicao_id = :c',
    { id: inscricaoId, c: inteiro(req.params.id) });
  if (!inscricao) throw new ErroApi('Inscrição não encontrada.', 404);

  const medalha = texto(req.body.medalha);
  if (medalha && !MEDALHAS.includes(medalha)) throw new ErroApi(`Medalha inválida. Use: ${MEDALHAS.join(', ')}.`);

  transacao(() => {
    executar(`
      INSERT INTO competicao_resultados (inscricao_id, colocacao, medalha, lutas, vitorias, finalizacoes,
                                         observacao, registrado_por)
      VALUES (:inscricao_id, :colocacao, :medalha, :lutas, :vitorias, :finalizacoes, :observacao, :por)
      ON CONFLICT (inscricao_id) DO UPDATE SET
        colocacao = excluded.colocacao, medalha = excluded.medalha, lutas = excluded.lutas,
        vitorias = excluded.vitorias, finalizacoes = excluded.finalizacoes,
        observacao = excluded.observacao, registrado_por = excluded.registrado_por
    `, {
      inscricao_id: inscricaoId,
      colocacao: inteiro(req.body.colocacao),
      medalha: medalha || null,
      lutas: inteiro(req.body.lutas, 0),
      vitorias: inteiro(req.body.vitorias, 0),
      finalizacoes: inteiro(req.body.finalizacoes, 0),
      observacao: texto(req.body.observacao),
      por: req.usuario.id,
    });
    executar(`UPDATE competicao_inscricoes SET status = 'confirmado' WHERE id = :id AND status != 'desistiu'`,
      { id: inscricaoId });
  });
  registrar(req, { acao: 'lançou resultado', area: 'competicoes', alvoId: inscricaoId });
  res.json(um('SELECT * FROM competicao_resultados WHERE inscricao_id = :id', { id: inscricaoId }));
}));

/** Histórico de competição de um atleta, usado na ficha e na área do aluno. */
export function historicoDoAtleta(alunoId) {
  return todos(`
    SELECT c.nome AS competicao, c.data_inicio, c.nivel, m.nome AS modalidade, m.cor AS modalidade_cor,
           i.categoria_peso, i.status, r.colocacao, r.medalha, r.lutas, r.vitorias, r.finalizacoes
    FROM competicao_inscricoes i
    JOIN competicoes c ON c.id = i.competicao_id
    LEFT JOIN modalidades m ON m.id = c.modalidade_id
    LEFT JOIN competicao_resultados r ON r.inscricao_id = i.id
    WHERE i.aluno_id = :id
    ORDER BY c.data_inicio DESC
  `, { id: alunoId });
}

export default roteador;
