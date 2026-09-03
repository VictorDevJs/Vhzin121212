import { Router } from 'express';
import { todos, um, executar, transacao } from '../db.js';
import { exigirPapel, temCargo, registrar } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, inteiro, booleano } from '../util.js';
import { recorteDeModalidade, podeVerModalidade } from '../escopo.js';
import { apagarArquivoOrfao } from './arquivos.js';

const roteador = Router();

export const CATEGORIAS_FOTO = [
  'treino', 'turma', 'estrutura', 'competicao', 'evento', 'graduacao', 'equipe',
];

/**
 * Galeria da academia.
 *
 * As fotos seguem o mesmo recorte do resto do sistema: uma foto pode ser de
 * uma arte marcial ou da casa inteira, e o mestre de Judô só mexe nas de Judô.
 */

const SELECT_FOTO = `
  SELECT f.*, m.nome AS modalidade, m.cor AS modalidade_cor, u.nome AS enviada_por
  FROM fotos f
  LEFT JOIN modalidades m ON m.id = f.modalidade_id
  LEFT JOIN usuarios u ON u.id = f.criado_por
`;

/** Quem cuida das fotos: a gestão e quem recebeu o cargo de comunicação. */
function podeCuidarDasFotos(usuario) {
  return ['dono', 'recepcao', 'mestre'].includes(usuario.papel)
    || temCargo(usuario, 'marketing');
}

function exigirCuidador(req) {
  if (!podeCuidarDasFotos(req.usuario)) {
    throw new ErroApi('Só a gestão e quem tem o cargo de comunicação mexem na galeria.', 403);
  }
}

/** A foto tem que ser de uma arte que a pessoa acompanha (ou da casa toda). */
function exigirEscopo(req, modalidadeId) {
  if (req.usuario.papel === 'dono' || req.usuario.papel === 'recepcao') return;
  if (modalidadeId === null) {
    throw new ErroApi('Foto geral da academia só o dono e a recepção publicam.', 403);
  }
  if (!podeVerModalidade(req.usuario, modalidadeId)) {
    throw new ErroApi('Esta foto é de uma modalidade que você não acompanha.', 403);
  }
}

roteador.get('/', exigirPapel('dono', 'mestre', 'recepcao', 'competicoes', 'aluno'), rota((req, res) => {
  const filtros = [];
  const params = {};
  if (inteiro(req.query.modalidade_id)) {
    filtros.push('f.modalidade_id = :modalidade_id');
    params.modalidade_id = inteiro(req.query.modalidade_id);
  }
  if (texto(req.query.categoria)) {
    filtros.push('f.categoria = :categoria');
    params.categoria = texto(req.query.categoria);
  }
  const recorte = recorteDeModalidade(req.usuario, 'f.modalidade_id');
  if (recorte) filtros.push(recorte);

  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  res.json(todos(`${SELECT_FOTO} ${onde} ORDER BY f.destaque DESC, f.ordem, f.id DESC`, params));
}));

roteador.post('/', exigirPapel('dono', 'mestre', 'recepcao', 'competicoes'), rota((req, res) => {
  exigirCuidador(req);
  exigirCampos(req.body, ['arquivo']);

  const categoria = texto(req.body.categoria, 'treino');
  if (!CATEGORIAS_FOTO.includes(categoria)) {
    throw new ErroApi(`Categoria inválida. Use: ${CATEGORIAS_FOTO.join(', ')}.`);
  }
  const modalidadeId = inteiro(req.body.modalidade_id);
  exigirEscopo(req, modalidadeId);

  const criada = executar(`
    INSERT INTO fotos (arquivo, legenda, categoria, modalidade_id, ordem, destaque, publicar_site, criado_por)
    VALUES (:arquivo, :legenda, :categoria, :modalidade_id, :ordem, :destaque, :publicar_site, :criado_por)
  `, {
    arquivo: texto(req.body.arquivo),
    legenda: texto(req.body.legenda),
    categoria,
    modalidade_id: modalidadeId,
    ordem: inteiro(req.body.ordem, 0),
    destaque: booleano(req.body.destaque, 0),
    publicar_site: booleano(req.body.publicar_site, 1),
    criado_por: req.usuario.id,
  });

  const id = Number(criada.lastInsertRowid);
  registrar(req, { acao: 'criou', area: 'fotos', alvo: 'foto', alvoId: id });
  res.status(201).json(um(`${SELECT_FOTO} WHERE f.id = :id`, { id }));
}));

roteador.put('/:id', exigirPapel('dono', 'mestre', 'recepcao', 'competicoes'), rota((req, res) => {
  exigirCuidador(req);
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM fotos WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Foto não encontrada.', 404);
  exigirEscopo(req, atual.modalidade_id);

  const categoria = texto(req.body.categoria, atual.categoria);
  if (!CATEGORIAS_FOTO.includes(categoria)) {
    throw new ErroApi(`Categoria inválida. Use: ${CATEGORIAS_FOTO.join(', ')}.`);
  }
  const modalidadeId = req.body.modalidade_id === undefined
    ? atual.modalidade_id
    : inteiro(req.body.modalidade_id);
  exigirEscopo(req, modalidadeId);

  executar(`
    UPDATE fotos SET
      legenda = :legenda, categoria = :categoria, modalidade_id = :modalidade_id,
      ordem = :ordem, destaque = :destaque, publicar_site = :publicar_site
    WHERE id = :id
  `, {
    id,
    legenda: req.body.legenda === undefined ? atual.legenda : texto(req.body.legenda),
    categoria,
    modalidade_id: modalidadeId,
    ordem: req.body.ordem === undefined ? atual.ordem : inteiro(req.body.ordem, 0),
    destaque: req.body.destaque === undefined ? atual.destaque : booleano(req.body.destaque, 0),
    publicar_site: req.body.publicar_site === undefined
      ? atual.publicar_site
      : booleano(req.body.publicar_site, 1),
  });

  registrar(req, { acao: 'editou', area: 'fotos', alvo: 'foto', alvoId: id });
  res.json(um(`${SELECT_FOTO} WHERE f.id = :id`, { id }));
}));

roteador.delete('/:id', exigirPapel('dono', 'mestre', 'recepcao', 'competicoes'), rota((req, res) => {
  exigirCuidador(req);
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM fotos WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Foto não encontrada.', 404);
  exigirEscopo(req, atual.modalidade_id);

  executar('DELETE FROM fotos WHERE id = :id', { id });
  // A foto saiu do banco: se ninguém mais usa o arquivo, ele sai do disco também.
  apagarArquivoOrfao(atual.arquivo);
  registrar(req, { acao: 'removeu', area: 'fotos', alvo: 'foto', alvoId: id });
  res.status(204).end();
}));

/** Reordena a galeria de uma vez: a ordem que o dono arrasta na tela. */
roteador.post('/ordenar', exigirPapel('dono', 'recepcao'), rota((req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((v) => inteiro(v)).filter(Boolean) : [];
  if (!ids.length) throw new ErroApi('Envie a lista de ids na ordem desejada.');

  transacao(() => {
    ids.forEach((id, posicao) => {
      executar('UPDATE fotos SET ordem = :ordem WHERE id = :id', { id, ordem: posicao });
    });
  });
  registrar(req, { acao: 'reordenou', area: 'fotos', alvo: 'galeria', detalhe: `${ids.length} foto(s)` });
  res.json({ mensagem: 'Ordem da galeria atualizada.' });
}));

export default roteador;
