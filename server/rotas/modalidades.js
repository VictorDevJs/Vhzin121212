import { Router } from 'express';
import { todos, um, executar } from '../db.js';
import { exigirPapel, temCargo, registrar, EQUIPE } from '../auth.js';
import { GRADUACOES_PADRAO, aplicarGraduacoes } from '../graduacoes-padrao.js';
import { recorteDeModalidade, podeVerModalidade } from '../escopo.js';
import { rota, ErroApi, exigirCampos, texto, inteiro, booleano } from '../util.js';

const roteador = Router();

// Toda a equipe consulta; somente o dono cadastra e altera as modalidades.
roteador.get('/', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  // "todas=1" é o pedido explícito de quem monta cadastro (formulários do dono).
  const recorte = texto(req.query.todas) === '1'
    ? null
    : recorteDeModalidade(req.usuario, 'm.id', { incluirGerais: false });
  const lista = todos(`
    SELECT m.*,
           (SELECT COUNT(*) FROM turmas t WHERE t.modalidade_id = m.id AND t.ativo = 1) AS total_turmas,
           (SELECT COUNT(*) FROM graduacoes g WHERE g.modalidade_id = m.id) AS total_graduacoes
    FROM modalidades m
    ${recorte ? `WHERE ${recorte}` : ''}
    ORDER BY m.ativo DESC, m.ordem, m.nome
  `);
  res.json(lista);
}));

roteador.post('/', exigirPapel('dono'), rota((req, res) => {
  exigirCampos(req.body, ['nome']);
  const nome = texto(req.body.nome);
  if (um('SELECT id FROM modalidades WHERE nome = :nome', { nome })) {
    throw new ErroApi('Já existe uma modalidade com este nome.', 409);
  }
  const criada = executar(`
    INSERT INTO modalidades (nome, descricao, cor, destaque, sigla, ordem, imagem, ativo)
    VALUES (:nome, :descricao, :cor, :destaque, :sigla, :ordem, :imagem, :ativo)
  `, {
    nome,
    sigla: texto(req.body.sigla),
    descricao: texto(req.body.descricao),
    cor: texto(req.body.cor, '#2a78d6'),
    destaque: texto(req.body.destaque),
    ordem: inteiro(req.body.ordem, 0),
    imagem: texto(req.body.imagem),
    ativo: booleano(req.body.ativo, 1),
  });
  const id = Number(criada.lastInsertRowid);
  // Quando a arte marcial tem escala oficial conhecida, ela já nasce completa.
  aplicarGraduacoes(executar, todos, id, nome);
  registrar(req, { acao: 'criou modalidade', area: 'modalidades', alvo: nome, alvoId: id });
  res.status(201).json(um('SELECT * FROM modalidades WHERE id = :id', { id }));
}));

roteador.put('/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM modalidades WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Modalidade não encontrada.', 404);

  executar(`
    UPDATE modalidades SET nome = :nome, descricao = :descricao, cor = :cor, sigla = :sigla,
           destaque = :destaque, ordem = :ordem, imagem = :imagem, ativo = :ativo
    WHERE id = :id
  `, {
    id,
    sigla: texto(req.body.sigla, atual.sigla),
    nome: texto(req.body.nome, atual.nome),
    descricao: texto(req.body.descricao, atual.descricao),
    cor: texto(req.body.cor, atual.cor),
    destaque: texto(req.body.destaque, atual.destaque),
    ordem: inteiro(req.body.ordem, atual.ordem),
    imagem: texto(req.body.imagem, atual.imagem),
    ativo: booleano(req.body.ativo, atual.ativo),
  });
  res.json(um('SELECT * FROM modalidades WHERE id = :id', { id }));
}));

roteador.delete('/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const turmas = um('SELECT COUNT(*) AS total FROM turmas WHERE modalidade_id = :id', { id });
  if (turmas.total > 0) {
    throw new ErroApi('Existem turmas nesta modalidade. Desative a modalidade em vez de excluir.', 409);
  }
  const apagada = executar('DELETE FROM modalidades WHERE id = :id', { id });
  if (!apagada.changes) throw new ErroApi('Modalidade não encontrada.', 404);
  res.json({ mensagem: 'Modalidade removida.' });
}));

// ----- Graduacoes: a escala de faixas, cordas ou niveis de cada arte -----

const ETARIAS = ['kids', 'adulto', 'ambos'];

/** Quem conduz exame de faixa: o dono, um mestre ou o responsável de graduação. */
function exigirGraduador(req, modalidadeId) {
  if (req.usuario.papel === 'mestre' || temCargo(req.usuario, 'graduacao', modalidadeId)) return;
  throw new ErroApi('Só mestres, o dono ou o Responsável de Graduação mexem nas faixas.', 403);
}

/** Catálogo oficial disponível para copiar dentro do sistema. */
roteador.get('/catalogo-graduacoes', exigirPapel(...EQUIPE, 'aluno'), rota((_req, res) => {
  res.json(Object.entries(GRADUACOES_PADRAO).map(([nome, dados]) => ({
    modalidade: nome,
    federacao: dados.federacao,
    resumo: dados.resumo,
    degraus: dados.degraus.length,
  })));
}));

roteador.get('/:id/graduacoes', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const id = inteiro(req.params.id);
  if (!podeVerModalidade(req.usuario, id)) {
    throw new ErroApi('Esta modalidade não faz parte do seu treino.', 403);
  }
  const lista = todos(`
    SELECT g.*,
           (SELECT COUNT(DISTINCT ag.aluno_id) FROM aluno_graduacoes ag
             WHERE ag.graduacao_id = g.id) AS alunos
    FROM graduacoes g WHERE g.modalidade_id = :id ORDER BY g.ordem, g.nome
  `, { id });
  res.json(lista);
}));

/** Copia (ou completa) a escala oficial da federação para a modalidade. */
roteador.post('/:id/graduacoes/padrao', exigirPapel(...EQUIPE), rota((req, res) => {
  const id = inteiro(req.params.id);
  const modalidade = um('SELECT * FROM modalidades WHERE id = :id', { id });
  if (!modalidade) throw new ErroApi('Modalidade não encontrada.', 404);
  exigirGraduador(req, id);

  const catalogo = GRADUACOES_PADRAO[modalidade.nome];
  if (!catalogo) {
    throw new ErroApi(`Ainda não existe escala oficial pronta para ${modalidade.nome}. Cadastre as faixas uma a uma.`);
  }
  const criadas = aplicarGraduacoes(executar, todos, id, modalidade.nome);
  registrar(req, { acao: 'aplicou a escala oficial', area: 'graduacoes', alvo: modalidade.nome, alvoId: id });
  res.json({
    mensagem: criadas
      ? `${criadas} graduação(ões) de ${modalidade.nome} incluída(s) a partir da escala ${catalogo.federacao}.`
      : `A escala de ${modalidade.nome} já estava completa.`,
    criadas,
    federacao: catalogo.federacao,
  });
}));

roteador.post('/:id/graduacoes', exigirPapel(...EQUIPE), rota((req, res) => {
  const modalidadeId = inteiro(req.params.id);
  if (!um('SELECT id FROM modalidades WHERE id = :id', { id: modalidadeId })) {
    throw new ErroApi('Modalidade não encontrada.', 404);
  }
  exigirGraduador(req, modalidadeId);
  exigirCampos(req.body, ['nome']);
  const nome = texto(req.body.nome);
  if (um('SELECT id FROM graduacoes WHERE modalidade_id = :m AND nome = :nome', { m: modalidadeId, nome })) {
    throw new ErroApi('Esta graduação já existe na modalidade.', 409);
  }
  const faixaEtaria = texto(req.body.faixa_etaria, 'adulto');
  if (!ETARIAS.includes(faixaEtaria)) throw new ErroApi(`Faixa etária inválida. Use: ${ETARIAS.join(', ')}.`);

  const criada = executar(`
    INSERT INTO graduacoes (modalidade_id, nome, ordem, cor, cor_ponta, graus, faixa_etaria,
                            idade_minima, tempo_minimo, descricao)
    VALUES (:modalidade_id, :nome, :ordem, :cor, :cor_ponta, :graus, :faixa_etaria,
            :idade_minima, :tempo_minimo, :descricao)
  `, {
    modalidade_id: modalidadeId,
    nome,
    ordem: inteiro(req.body.ordem, proximaOrdem(modalidadeId)),
    cor: texto(req.body.cor, '#888888'),
    cor_ponta: texto(req.body.cor_ponta),
    graus: inteiro(req.body.graus, 0),
    faixa_etaria: faixaEtaria,
    idade_minima: inteiro(req.body.idade_minima),
    tempo_minimo: inteiro(req.body.tempo_minimo, 0),
    descricao: texto(req.body.descricao),
  });
  res.status(201).json(um('SELECT * FROM graduacoes WHERE id = :id', { id: Number(criada.lastInsertRowid) }));
}));

roteador.put('/:id/graduacoes/:graduacaoId', exigirPapel(...EQUIPE), rota((req, res) => {
  const modalidadeId = inteiro(req.params.id);
  exigirGraduador(req, modalidadeId);
  const id = inteiro(req.params.graduacaoId);
  const atual = um('SELECT * FROM graduacoes WHERE id = :id AND modalidade_id = :m', { id, m: modalidadeId });
  if (!atual) throw new ErroApi('Graduação não encontrada.', 404);

  executar(`
    UPDATE graduacoes SET nome = :nome, ordem = :ordem, cor = :cor, cor_ponta = :cor_ponta,
           graus = :graus, faixa_etaria = :faixa_etaria, idade_minima = :idade_minima,
           tempo_minimo = :tempo_minimo, descricao = :descricao
    WHERE id = :id
  `, {
    id,
    nome: texto(req.body.nome, atual.nome),
    ordem: inteiro(req.body.ordem, atual.ordem),
    cor: texto(req.body.cor, atual.cor),
    cor_ponta: texto(req.body.cor_ponta, atual.cor_ponta),
    graus: inteiro(req.body.graus, atual.graus),
    faixa_etaria: texto(req.body.faixa_etaria, atual.faixa_etaria),
    idade_minima: inteiro(req.body.idade_minima, atual.idade_minima),
    tempo_minimo: inteiro(req.body.tempo_minimo, atual.tempo_minimo),
    descricao: texto(req.body.descricao, atual.descricao),
  });
  res.json(um('SELECT * FROM graduacoes WHERE id = :id', { id }));
}));

roteador.delete('/:id/graduacoes/:graduacaoId', exigirPapel(...EQUIPE), rota((req, res) => {
  const modalidadeId = inteiro(req.params.id);
  exigirGraduador(req, modalidadeId);
  const id = inteiro(req.params.graduacaoId);
  const usada = um('SELECT COUNT(*) AS total FROM aluno_graduacoes WHERE graduacao_id = :id', { id });
  if (usada.total > 0) {
    throw new ErroApi(`${usada.total} aluno(s) já foram graduados nesta faixa. Ela não pode ser apagada.`, 409);
  }
  const apagada = executar('DELETE FROM graduacoes WHERE id = :id AND modalidade_id = :m',
    { id, m: modalidadeId });
  if (!apagada.changes) throw new ErroApi('Graduação não encontrada.', 404);
  res.json({ mensagem: 'Graduação removida.' });
}));

function proximaOrdem(modalidadeId) {
  const ultima = um('SELECT MAX(ordem) AS ordem FROM graduacoes WHERE modalidade_id = :id', { id: modalidadeId });
  return (ultima?.ordem ?? 0) + 1;
}

export default roteador;
