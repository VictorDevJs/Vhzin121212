import { api, sessao } from '../api.js';
import {
  el, cartao, indicador, botao, etiqueta, tabela, celula, moeda, dataBr, vazio, esqueleto,
  abrirFormulario, abrirModal, aviso, confirmar,
} from '../ui.js';
import { topo } from '../app.js';

const ROTULO_CATEGORIA = {
  kimono: 'Kimono', faixa: 'Faixa', rashguard: 'Rashguard', short: 'Short', luva: 'Luva',
  caneleira: 'Caneleira', protetor: 'Protetor', camisa: 'Camisa', casaco: 'Casaco',
  bermuda: 'Bermuda', mochila: 'Mochila', acessorio: 'Acessório',
};

/** Loja da academia: equipamento por luta e acessórios para todo mundo. */
export default async function paginaLoja() {
  const ehDono = sessao.papel === 'dono';
  const podeVender = sessao.ehUm('dono', 'recepcao');
  const [modalidades, alunos] = await Promise.all([
    api.obter('/modalidades'),
    podeVender ? api.obter('/alunos?status=ativo') : Promise.resolve([]),
  ]);

  const filtro = { modalidade_id: '', categoria: '', busca: '' };
  const carrinho = [];
  const area = el('div');
  const areaResumo = el('div');
  let catalogo = [];

  async function carregar() {
    area.replaceChildren(esqueleto(2, 220));
    const dados = await api.obter(`/loja/produtos${consulta()}`);
    catalogo = dados.produtos;
    desenharResumo(dados.resumo);
    desenharCatalogo(dados.produtos);
  }

  function consulta() {
    const partes = Object.entries(filtro).filter(([, v]) => v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    return partes.length ? `?${partes.join('&')}` : '';
  }

  function desenharResumo(resumo) {
    if (!sessao.ehUm('dono', 'recepcao')) { areaResumo.replaceChildren(); return; }
    areaResumo.replaceChildren(el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
      indicador({ rotulo: 'Itens no catálogo', valor: String(resumo.itens), tipo: 'destaque' }),
      indicador({ rotulo: 'Peças em estoque', valor: String(resumo.em_estoque), tipo: 'bom' }),
      indicador({ rotulo: 'Valor do estoque', valor: moeda(resumo.valor_estoque) }),
      indicador({
        rotulo: 'Sem estoque', valor: String(resumo.sem_estoque),
        detalhe: resumo.sem_estoque ? 'Reponha para não perder venda' : 'Tudo disponível',
        tipo: resumo.sem_estoque ? 'atencao' : '',
      }),
    ]));
  }

  function desenharCatalogo(produtos) {
    if (!produtos.length) {
      area.replaceChildren(vazio('Nenhum produto com esse filtro.'));
      return;
    }
    // Agrupa por luta; os itens sem modalidade viram a linha de acessórios.
    const grupos = new Map();
    for (const produto of produtos) {
      const chave = produto.modalidade || 'Acessórios e vestuário';
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(produto);
    }

    area.replaceChildren(...[...grupos.entries()].map(([nome, itens]) => cartao(
      nome,
      el('div', { classe: 'grade produtos' }, itens.map(cartaoProduto)),
      etiqueta(`${itens.length} item(ns)`, 'neutra'),
    )));
  }

  function cartaoProduto(produto) {
    const semEstoque = produto.estoque <= 0;
    return el('article', { classe: `produto tilt ${semEstoque ? 'esgotado' : ''}` }, [
      el('div', { classe: 'capa' }, [
        produto.imagem
          ? el('img', { src: produto.imagem, alt: produto.nome, loading: 'lazy' })
          : el('span', { classe: 'sem-foto', texto: (ROTULO_CATEGORIA[produto.categoria] || 'Produto').slice(0, 2).toUpperCase() }),
        el('span', { classe: 'selo', texto: ROTULO_CATEGORIA[produto.categoria] || produto.categoria }),
      ]),
      el('div', { classe: 'corpo-produto' }, [
        el('h3', { texto: produto.nome, estilo: 'margin:0' }),
        produto.descricao ? el('p', { classe: 'dica', estilo: 'margin:0', texto: produto.descricao }) : null,
        produto.tamanhos ? el('div', { classe: 'dica', texto: `Tamanhos: ${produto.tamanhos}` }) : null,
        el('div', { classe: 'preco', texto: moeda(produto.preco) }),
        el('div', { classe: 'acoes' }, [
          semEstoque
            ? etiqueta('sem estoque', 'critico')
            : etiqueta(`${produto.estoque} em estoque`, produto.estoque <= 3 ? 'atencao' : 'bom'),
          produto.ativo ? null : etiqueta('inativo', 'neutra'),
        ]),
        el('div', { classe: 'acoes', estilo: 'margin-top:auto' }, [
          podeVender && !semEstoque ? botao('Adicionar à venda', () => adicionar(produto), 'botao pequeno') : null,
          ehDono ? botao('Editar', () => formulario(produto), 'botao pequeno secundario') : null,
          ehDono ? botao('Excluir', () => excluir(produto), 'botao pequeno perigo') : null,
        ].filter(Boolean)),
      ]),
    ]);
  }

  /* ---------------- venda ---------------- */

  function adicionar(produto) {
    const existente = carrinho.find((item) => item.produto.id === produto.id);
    if (existente) existente.quantidade += 1;
    else carrinho.push({ produto, quantidade: 1, tamanho: '' });
    aviso(`${produto.nome} adicionado à venda.`);
    atualizarBotaoVenda();
  }

  const botaoVenda = botao('Fechar venda', abrirVenda, 'botao');
  function atualizarBotaoVenda() {
    const itens = carrinho.reduce((soma, item) => soma + item.quantidade, 0);
    botaoVenda.textContent = itens ? `Fechar venda (${itens})` : 'Fechar venda';
    botaoVenda.disabled = !itens;
  }

  function abrirVenda() {
    if (!carrinho.length) return aviso('Adicione um produto antes de fechar a venda.', 'erro');
    const conteudo = el('div');
    const { fechar } = abrirModal({ titulo: 'Registrar venda', conteudo });

    function desenharVenda() {
      const total = carrinho.reduce((soma, item) => soma + item.quantidade * item.produto.preco, 0);
      conteudo.replaceChildren(
        tabela(['Produto', 'Tamanho', 'Qtd.', 'Preço', ''], carrinho.map((item, indice) => [
          item.produto.nome,
          celula([el('input', {
            value: item.tamanho, placeholder: item.produto.tamanhos || '—',
            estilo: 'width:110px', aoMudar: (e) => { item.tamanho = e.target.value; },
          })]),
          celula([el('input', {
            type: 'number', min: 1, max: item.produto.estoque, value: item.quantidade, estilo: 'width:80px',
            aoMudar: (e) => { item.quantidade = Math.max(1, Number(e.target.value) || 1); desenharVenda(); },
          })]),
          moeda(item.produto.preco * item.quantidade),
          celula([botao('Remover', () => { carrinho.splice(indice, 1); desenharVenda(); atualizarBotaoVenda(); }, 'botao pequeno perigo')]),
        ])),
        el('div', { classe: 'linha', estilo: 'margin-top:1rem' }, [
          el('div', { classe: 'campo' }, [
            el('label', { texto: 'Aluno (opcional)' }),
            el('select', { id: 'venda-aluno' }, [
              el('option', { value: '', texto: 'Cliente avulso' }),
              ...alunos.map((a) => el('option', { value: a.id, texto: a.nome })),
            ]),
          ]),
          el('div', { classe: 'campo' }, [
            el('label', { texto: 'Forma de pagamento' }),
            el('select', { id: 'venda-forma' },
              ['dinheiro', 'pix', 'débito', 'crédito', 'transferência'].map((f) => el('option', { value: f, texto: f }))),
          ]),
        ]),
        el('div', { estilo: 'display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-top:.5rem' }, [
          el('div', {}, [
            el('div', { classe: 'dica', texto: 'Total da venda' }),
            el('div', { estilo: 'font-family:var(--fonte-titulo);font-size:2rem', texto: moeda(total) }),
          ]),
          botao('Confirmar venda', async () => {
            try {
              const resposta = await api.criar('/loja/vendas', {
                aluno_id: document.getElementById('venda-aluno').value || null,
                forma_pagamento: document.getElementById('venda-forma').value,
                itens: carrinho.map((item) => ({
                  produto_id: item.produto.id, quantidade: item.quantidade, tamanho: item.tamanho,
                })),
              });
              aviso(`${resposta.mensagem} Total: ${moeda(resposta.total)}.`);
              carrinho.length = 0;
              atualizarBotaoVenda();
              fechar();
              await carregar();
            } catch (erro) {
              aviso(erro.message, 'erro');
            }
          }),
        ]),
      );
    }
    desenharVenda();
  }

  /* ---------------- cadastro ---------------- */

  function formulario(produto = null) {
    abrirFormulario({
      titulo: produto ? `Editar ${produto.nome}` : 'Novo produto',
      aviso: 'Deixe a modalidade em branco para o item aparecer em "Acessórios e vestuário".',
      campos: [
        { nome: 'nome', rotulo: 'Nome do produto', obrigatorio: true, placeholder: 'Kimono Atak trançado' },
        { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea' },
        { nome: 'categoria', rotulo: 'Categoria', tipo: 'select',
          opcoes: Object.entries(ROTULO_CATEGORIA).map(([valor, rotulo]) => ({ valor, rotulo })) },
        { nome: 'modalidade_id', rotulo: 'Modalidade', tipo: 'select',
          opcoes: [{ valor: '', rotulo: 'Acessórios e vestuário' },
            ...modalidades.map((m) => ({ valor: m.id, rotulo: m.nome }))] },
        { nome: 'preco', rotulo: 'Preço de venda (R$)', tipo: 'number', passo: '0.01', obrigatorio: true },
        { nome: 'custo', rotulo: 'Custo (R$)', tipo: 'number', passo: '0.01' },
        { nome: 'estoque', rotulo: 'Quantidade em estoque', tipo: 'number', min: 0 },
        { nome: 'tamanhos', rotulo: 'Tamanhos disponíveis', placeholder: 'P, M, G, GG' },
        { nome: 'imagem_nova', rotulo: 'Foto do produto', tipo: 'arquivo', aceita: 'image/*',
          dica: 'JPG, PNG ou WEBP de até 5 MB.' },
        { nome: 'ativo', rotulo: 'À venda', tipo: 'checkbox', valor: 1 },
        { nome: 'publicar_site', rotulo: 'Mostrar na página pública', tipo: 'checkbox', valor: 1 },
      ],
      valores: produto || { categoria: 'kimono', ativo: 1, publicar_site: 1, estoque: 0 },
      aoSalvar: async (dados) => {
        const { imagem_nova: imagem, ...corpo } = dados;
        if (imagem) {
          const enviada = await api.criar('/arquivos', { conteudo: imagem });
          corpo.imagem = enviada.url;
        } else if (produto?.imagem) {
          corpo.imagem = produto.imagem;
        }
        if (produto) await api.atualizar(`/loja/produtos/${produto.id}`, corpo);
        else await api.criar('/loja/produtos', corpo);
        aviso('Produto salvo.');
        await carregar();
      },
    });
  }

  async function excluir(produto) {
    if (!confirmar(`Excluir "${produto.nome}" do catálogo?`)) return;
    try {
      await api.remover(`/loja/produtos/${produto.id}`);
      aviso('Produto removido.');
      await carregar();
    } catch (erro) {
      aviso(erro.message, 'erro');
    }
  }

  async function verVendas() {
    const conteudo = el('div', {}, [esqueleto(2, 60)]);
    abrirModal({ titulo: 'Vendas do mês', conteudo, largura: '820px' });
    const dados = await api.obter('/loja/vendas');
    conteudo.replaceChildren(
      el('div', { classe: 'grade col-2', estilo: 'margin-bottom:1rem' }, [
        indicador({ rotulo: 'Total vendido', valor: moeda(dados.total), tipo: 'bom' }),
        indicador({ rotulo: 'Vendas registradas', valor: String(dados.vendas.length) }),
      ]),
      dados.mais_vendidos.length
        ? cartao('Mais vendidos', tabela(['Produto', 'Quantidade', 'Total'],
          dados.mais_vendidos.map((p) => [p.nome, String(p.quantidade), moeda(p.total)])))
        : null,
      dados.vendas.length
        ? tabela(['Data', 'Cliente', 'Itens', 'Forma', 'Total'], dados.vendas.map((v) => [
          dataBr(v.data), v.aluno || v.cliente_nome,
          v.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(', '),
          v.forma_pagamento || '—', moeda(v.total),
        ]))
        : vazio('Nenhuma venda registrada neste mês.'),
    );
  }

  atualizarBotaoVenda();
  await carregar();

  const acoes = [];
  if (podeVender) acoes.push(botaoVenda, botao('Vendas do mês', verVendas, 'botao secundario'));
  if (ehDono) acoes.push(botao('+ Novo produto', () => formulario(), 'botao secundario'));

  return el('div', {}, [
    topo('Loja', sessao.papel === 'aluno'
      ? 'Kimonos, faixas, luvas e a linha Atak. Fale com a recepção para comprar.'
      : 'Equipamento por luta, acessórios e controle de estoque. A venda entra direto no caixa.',
    acoes),

    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Buscar' }),
        el('input', {
          placeholder: 'Nome do produto',
          aoDigitar: (e) => { filtro.busca = e.target.value; clearTimeout(temporizador); temporizador = setTimeout(carregar, 300); },
        }),
      ]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Modalidade' }),
        el('select', { aoMudar: (e) => { filtro.modalidade_id = e.target.value; carregar(); } }, [
          el('option', { value: '', texto: 'Todas' }),
          ...modalidades.map((m) => el('option', { value: m.id, texto: m.nome })),
        ]),
      ]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Categoria' }),
        el('select', { aoMudar: (e) => { filtro.categoria = e.target.value; carregar(); } }, [
          el('option', { value: '', texto: 'Todas' }),
          ...Object.entries(ROTULO_CATEGORIA).map(([valor, rotulo]) => el('option', { value: valor, texto: rotulo })),
        ]),
      ]),
    ]),

    areaResumo,
    area,
  ]);
}

let temporizador;
