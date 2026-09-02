import { Router } from 'express';
import { todos, um, executar, transacao } from '../db.js';
import { exigirPapel, EQUIPE, GESTAO } from '../auth.js';
import {
  rota, ErroApi, exigirCampos, texto, numero, inteiro, booleano, data, hoje,
} from '../util.js';

const roteador = Router();

/** Categorias da loja. As de vestuário/proteção valem para qualquer luta. */
export const CATEGORIAS = [
  'kimono', 'faixa', 'rashguard', 'short', 'luva', 'caneleira', 'protetor',
  'camisa', 'casaco', 'bermuda', 'mochila', 'acessorio',
];

const SELECT_PRODUTO = `
  SELECT p.*, m.nome AS modalidade, m.cor AS modalidade_cor
  FROM produtos p
  LEFT JOIN modalidades m ON m.id = p.modalidade_id
`;

roteador.get('/produtos', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const filtros = [];
  const params = {};
  if (inteiro(req.query.modalidade_id)) { filtros.push('p.modalidade_id = :m'); params.m = inteiro(req.query.modalidade_id); }
  if (texto(req.query.categoria)) { filtros.push('p.categoria = :c'); params.c = texto(req.query.categoria); }
  if (texto(req.query.busca)) { filtros.push('(p.nome LIKE :b OR p.descricao LIKE :b)'); params.b = `%${texto(req.query.busca)}%`; }
  if (texto(req.query.acessorios) === '1') filtros.push('p.modalidade_id IS NULL');
  if (req.usuario.papel === 'aluno') filtros.push('p.ativo = 1');

  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const lista = todos(`${SELECT_PRODUTO} ${onde} ORDER BY p.ativo DESC, m.nome, p.nome`, params);

  res.json({
    produtos: lista,
    categorias: CATEGORIAS,
    resumo: {
      itens: lista.length,
      em_estoque: lista.reduce((soma, p) => soma + p.estoque, 0),
      valor_estoque: Number(lista.reduce((soma, p) => soma + p.estoque * p.preco, 0).toFixed(2)),
      sem_estoque: lista.filter((p) => p.ativo && p.estoque <= 0).length,
    },
  });
}));

roteador.post('/produtos', exigirPapel('dono'), rota((req, res) => {
  exigirCampos(req.body, ['nome', 'preco']);
  const categoria = texto(req.body.categoria, 'acessorio');
  if (!CATEGORIAS.includes(categoria)) throw new ErroApi(`Categoria inválida. Use uma destas: ${CATEGORIAS.join(', ')}.`);

  const criado = executar(`
    INSERT INTO produtos (nome, descricao, categoria, modalidade_id, preco, custo, estoque, tamanhos, imagem, ativo, publicar_site)
    VALUES (:nome, :descricao, :categoria, :modalidade_id, :preco, :custo, :estoque, :tamanhos, :imagem, :ativo, :publicar_site)
  `, {
    nome: texto(req.body.nome),
    descricao: texto(req.body.descricao),
    categoria,
    modalidade_id: inteiro(req.body.modalidade_id),
    preco: numero(req.body.preco),
    custo: numero(req.body.custo, 0),
    estoque: inteiro(req.body.estoque, 0),
    tamanhos: texto(req.body.tamanhos),
    imagem: texto(req.body.imagem),
    ativo: booleano(req.body.ativo, 1),
    publicar_site: booleano(req.body.publicar_site, 1),
  });
  res.status(201).json(um(`${SELECT_PRODUTO} WHERE p.id = :id`, { id: Number(criado.lastInsertRowid) }));
}));

roteador.put('/produtos/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const atual = um('SELECT * FROM produtos WHERE id = :id', { id });
  if (!atual) throw new ErroApi('Produto não encontrado.', 404);

  executar(`
    UPDATE produtos SET nome = :nome, descricao = :descricao, categoria = :categoria,
           modalidade_id = :modalidade_id, preco = :preco, custo = :custo, estoque = :estoque,
           tamanhos = :tamanhos, imagem = :imagem, ativo = :ativo, publicar_site = :publicar_site
    WHERE id = :id
  `, {
    id,
    nome: texto(req.body.nome, atual.nome),
    descricao: texto(req.body.descricao, atual.descricao),
    categoria: texto(req.body.categoria, atual.categoria),
    modalidade_id: req.body.modalidade_id === '' ? null : inteiro(req.body.modalidade_id, atual.modalidade_id),
    preco: numero(req.body.preco, atual.preco),
    custo: numero(req.body.custo, atual.custo),
    estoque: inteiro(req.body.estoque, atual.estoque),
    tamanhos: texto(req.body.tamanhos, atual.tamanhos),
    imagem: texto(req.body.imagem, atual.imagem),
    ativo: booleano(req.body.ativo, atual.ativo),
    publicar_site: booleano(req.body.publicar_site, atual.publicar_site),
  });
  res.json(um(`${SELECT_PRODUTO} WHERE p.id = :id`, { id }));
}));

roteador.delete('/produtos/:id', exigirPapel('dono'), rota((req, res) => {
  const id = inteiro(req.params.id);
  const vendido = um('SELECT COUNT(*) AS total FROM venda_itens WHERE produto_id = :id', { id });
  if (vendido.total > 0) throw new ErroApi('Este produto já foi vendido. Desative-o em vez de excluir.', 409);
  const apagado = executar('DELETE FROM produtos WHERE id = :id', { id });
  if (!apagado.changes) throw new ErroApi('Produto não encontrado.', 404);
  res.json({ mensagem: 'Produto removido.' });
}));

/**
 * Registra uma venda: baixa o estoque, guarda os itens e lança a receita no caixa,
 * tudo em uma transação só.
 */
roteador.post('/vendas', exigirPapel(...GESTAO), rota((req, res) => {
  const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
  if (!itens.length) throw new ErroApi('Escolha pelo menos um produto para registrar a venda.');

  const alunoId = inteiro(req.body.aluno_id);
  const clienteNome = texto(req.body.cliente_nome);
  const forma = texto(req.body.forma_pagamento, 'dinheiro');
  const dia = data(req.body.data, hoje());

  const resultado = transacao(() => {
    let total = 0;
    const preparados = [];

    for (const item of itens) {
      const produto = um('SELECT * FROM produtos WHERE id = :id', { id: inteiro(item.produto_id) });
      if (!produto) throw new ErroApi('Produto não encontrado na lista da venda.', 404);
      const quantidade = Math.max(1, inteiro(item.quantidade, 1));
      if (produto.estoque < quantidade) {
        throw new ErroApi(`Estoque insuficiente de ${produto.nome}: restam ${produto.estoque}.`, 409);
      }
      const preco = numero(item.preco_unitario, produto.preco);
      total += preco * quantidade;
      preparados.push({ produto, quantidade, preco, tamanho: texto(item.tamanho) });
    }

    const nomeCliente = clienteNome
      || (alunoId ? um('SELECT nome FROM alunos WHERE id = :id', { id: alunoId })?.nome : null)
      || 'Cliente da loja';

    const lancamento = executar(`
      INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, forma_pagamento, aluno_id, registrado_por)
      VALUES ('receita', 'produtos', :descricao, :valor, :data, :forma, :aluno, :usuario)
    `, {
      descricao: `Venda na loja - ${nomeCliente}`,
      valor: Number(total.toFixed(2)),
      data: dia,
      forma,
      aluno: alunoId,
      usuario: req.usuario.id,
    });

    const venda = executar(`
      INSERT INTO vendas (aluno_id, cliente_nome, total, forma_pagamento, data, observacao, lancamento_id, registrado_por)
      VALUES (:aluno, :cliente, :total, :forma, :data, :observacao, :lancamento, :usuario)
    `, {
      aluno: alunoId,
      cliente: nomeCliente,
      total: Number(total.toFixed(2)),
      forma,
      data: dia,
      observacao: texto(req.body.observacao),
      lancamento: Number(lancamento.lastInsertRowid),
      usuario: req.usuario.id,
    });
    const vendaId = Number(venda.lastInsertRowid);

    for (const item of preparados) {
      executar(`
        INSERT INTO venda_itens (venda_id, produto_id, nome, tamanho, quantidade, preco_unitario)
        VALUES (:venda, :produto, :nome, :tamanho, :quantidade, :preco)
      `, {
        venda: vendaId,
        produto: item.produto.id,
        nome: item.produto.nome,
        tamanho: item.tamanho,
        quantidade: item.quantidade,
        preco: item.preco,
      });
      executar('UPDATE produtos SET estoque = estoque - :q WHERE id = :id',
        { q: item.quantidade, id: item.produto.id });
    }

    return { id: vendaId, total: Number(total.toFixed(2)), itens: preparados.length };
  });

  res.status(201).json({ ...resultado, mensagem: 'Venda registrada e lançada no caixa.' });
}));

roteador.get('/vendas', exigirPapel(...GESTAO), rota((req, res) => {
  const de = data(req.query.de, `${hoje().slice(0, 7)}-01`);
  const ate = data(req.query.ate, hoje());
  const vendas = todos(`
    SELECT v.*, a.nome AS aluno, u.nome AS registrado_por_nome
    FROM vendas v
    LEFT JOIN alunos a ON a.id = v.aluno_id
    LEFT JOIN usuarios u ON u.id = v.registrado_por
    WHERE v.data BETWEEN :de AND :ate
    ORDER BY v.data DESC, v.id DESC
  `, { de, ate });

  for (const venda of vendas) {
    venda.itens = todos('SELECT * FROM venda_itens WHERE venda_id = :id', { id: venda.id });
  }

  const maisVendidos = todos(`
    SELECT vi.nome, SUM(vi.quantidade) AS quantidade, SUM(vi.quantidade * vi.preco_unitario) AS total
    FROM venda_itens vi JOIN vendas v ON v.id = vi.venda_id
    WHERE v.data BETWEEN :de AND :ate
    GROUP BY vi.nome ORDER BY quantidade DESC LIMIT 10
  `, { de, ate });

  res.json({
    periodo: { de, ate },
    total: Number(vendas.reduce((soma, v) => soma + v.total, 0).toFixed(2)),
    vendas,
    mais_vendidos: maisVendidos,
  });
}));

export default roteador;
