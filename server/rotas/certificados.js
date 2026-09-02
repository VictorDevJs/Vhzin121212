import { Router } from 'express';
import { todos, um, executar } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, ErroApi, exigirCampos, texto, inteiro, booleano, data } from '../util.js';

const roteador = Router();

export const TIPOS_CERTIFICADO = ['faixa_preta', 'graduacao', 'mestre', 'federacao', 'curso', 'premiacao', 'outro'];

const SELECT_CERTIFICADO = `
  SELECT c.*, m.nome AS modalidade, m.cor AS modalidade_cor, u.nome AS responsavel
  FROM certificados c
  LEFT JOIN modalidades m ON m.id = c.modalidade_id
  LEFT JOIN usuarios u ON u.id = c.criado_por
`;

roteador.get('/', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const filtros = [];
  const params = {};
  if (texto(req.query.tipo)) { filtros.push('c.tipo = :tipo'); params.tipo = texto(req.query.tipo); }
  if (inteiro(req.query.modalidade_id)) { filtros.push('c.modalidade_id = :modalidade_id'); params.modalidade_id = inteiro(req.query.modalidade_id); }
  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  res.json(todos(`${SELECT_CERTIFICADO} ${onde} ORDER BY c.data_emissao DESC, c.id DESC`, params));
}));

roteador.post('/', exigirPapel('dono'), rota((req, res) => {
  exigirCampos(req.body, ['titulo', 'pessoa_nome']);
  const tipo = texto(req.body.tipo, 'faixa_preta');
  if (!TIPOS_CERTIFICADO.includes(tipo)) throw new ErroApi(`Tipo inválido. Use: ${TIPOS_CERTIFICADO.join(', ')}.`);

  const criado = executar(`
    INSERT INTO certificados (titulo, tipo, pessoa_nome, aluno_id, usuario_id, modalidade_id, entidade,
                              registro, data_emissao, descricao, arquivo, publicar_site, criado_por)
    VALUES (:titulo, :tipo, :pessoa_nome, :aluno_id, :usuario_id, :modalidade_id, :entidade,
            :registro, :data_emissao, :descricao, :arquivo, :publicar_site, :criado_por)
  `, {
    titulo: texto(req.body.titulo),
    tipo,
    pessoa_nome: texto(req.body.pessoa_nome),
    aluno_id: inteiro(req.body.aluno_id),
    usuario_id: inteiro(req.body.usuario_id),
    modalidade_id: inteiro(req.body.modalidade_id),
    entidade: texto(req.body.entidade),
    registro: texto(req.body.registro),
    data_emissao: data(req.body.data_emissao),
    descricao: texto(req.body.descricao),
    arquivo: texto(req.body.arquivo),
    publicar_site: booleano(req.body.publicar_site, 1),
    criado_por: req.usuario.id,
  });
  res.status(201).json(um(`${SELECT_CERTIFICADO} WHERE c.id = :id`, { id: Number(criado.lastInsertRowid) }));
}));

roteador.put('/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM certificados WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Certificado não encontrado.', 404);

  executar(`
    UPDATE certificados SET titulo = :titulo, tipo = :tipo, pessoa_nome = :pessoa_nome,
           modalidade_id = :modalidade_id, entidade = :entidade, registro = :registro,
           data_emissao = :data_emissao, descricao = :descricao, arquivo = :arquivo,
           publicar_site = :publicar_site
    WHERE id = :id
  `, {
    id,
    titulo: texto(req.body.titulo, atual.titulo),
    tipo: texto(req.body.tipo, atual.tipo),
    pessoa_nome: texto(req.body.pessoa_nome, atual.pessoa_nome),
    modalidade_id: inteiro(req.body.modalidade_id, atual.modalidade_id),
    entidade: texto(req.body.entidade, atual.entidade),
    registro: texto(req.body.registro, atual.registro),
    data_emissao: data(req.body.data_emissao, atual.data_emissao),
    descricao: texto(req.body.descricao, atual.descricao),
    arquivo: texto(req.body.arquivo, atual.arquivo),
    publicar_site: booleano(req.body.publicar_site, atual.publicar_site),
  });
  res.json(um(`${SELECT_CERTIFICADO} WHERE c.id = :id`, { id }));
}));

roteador.delete('/:id', exigirPapel('dono'), rota((req, res) => {
  const apagado = executar('DELETE FROM certificados WHERE id = :id', { id: inteiro(req.params.id) });
  if (!apagado.changes) throw new ErroApi('Certificado não encontrado.', 404);
  res.json({ mensagem: 'Certificado removido.' });
}));

export default roteador;
