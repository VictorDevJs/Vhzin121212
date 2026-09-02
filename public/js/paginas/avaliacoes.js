import { api, sessao } from '../api.js';
import {
  el, cartao, botao, etiqueta, estrelas, abrirFormulario, aviso, confirmar,
  vazio, dataHoraBr, dataBr, esqueleto,
} from '../ui.js';
import { topo } from '../app.js';

const COR_STATUS = { aprovada: 'bom', pendente: 'atencao', recusada: 'critico' };

/**
 * Avaliações com estrelas e comentario.
 * A equipe modera e responde; o aluno envia a dele e acompanha o resultado.
 */
export default async function paginaAvaliacoes() {
  return sessao.papel === 'aluno' ? telaDoAluno() : telaDaEquipe();
}

/* ------------------------------------------------------------- equipe */

async function telaDaEquipe() {
  const podeModerar = sessao.ehUm('dono', 'recepcao');
  const filtro = { status: '' };
  const area = el('div');
  const areaResumo = el('div');
  const modalidades = await api.obter('/modalidades');

  async function carregar() {
    area.replaceChildren(esqueleto(3, 90));
    const dados = await api.obter(`/avaliacoes${filtro.status ? `?status=${filtro.status}` : ''}`);
    desenharResumo(dados.resumo, dados.pendentes);
    area.replaceChildren(dados.avaliacoes.length
      ? el('div', { classe: 'grade col-2' }, dados.avaliacoes.map(cartaoAvaliacao))
      : vazio('Nenhuma avaliação com esse filtro.'));
  }

  function desenharResumo(resumo, pendentes) {
    const maior = Math.max(1, ...resumo.distribuicao.map((d) => d.quantidade));
    areaResumo.replaceChildren(el('div', { classe: 'nota-grande' }, [
      el('div', {}, [
        el('div', { classe: 'media', texto: resumo.media.toFixed(1).replace('.', ',') }),
        estrelas(resumo.media, { tamanho: 18 }),
        el('div', { classe: 'dica', texto: `${resumo.total} avaliacao(oes) publicada(s)` }),
        pendentes ? el('div', { estilo: 'margin-top:.5rem' }, [etiqueta(`${pendentes} aguardando aprovacao`, 'atenção')]) : null,
      ]),
      el('div', { classe: 'distribuicao' }, resumo.distribuicao.map((linha) => el('div', { classe: 'faixa-nota' }, [
        el('span', { texto: `${linha.nota}★`, estilo: 'width:26px' }),
        el('span', { classe: 'barra' }, [el('span', {
          estilo: `width:${(linha.quantidade / maior) * 100}%;background:var(--marca-1)`,
        })]),
        el('span', { texto: String(linha.quantidade), estilo: 'width:24px;text-align:right' }),
      ]))),
    ]));
  }

  function cartaoAvaliacao(item) {
    return el('article', { classe: 'depoimento' }, [
      el('div', { classe: 'acoes', estilo: 'justify-content:space-between;margin-bottom:.5rem' }, [
        estrelas(item.nota),
        el('div', { classe: 'acoes' }, [
          etiqueta(item.status, COR_STATUS[item.status]),
          etiqueta(item.origem === 'aluno' ? 'aluno da casa' : 'site', 'neutra'),
          item.modalidade ? etiqueta(item.modalidade, 'info') : null,
        ]),
      ]),
      item.comentario ? el('p', { classe: 'texto', texto: item.comentario }) : el('p', { classe: 'dica', texto: 'Sem comentário.' }),
      el('div', { classe: 'autor' }, [
        el('strong', { texto: item.autor_nome }),
        el('span', { texto: `· ${dataHoraBr(item.criado_em)}` }),
      ]),
      item.resposta ? el('div', { classe: 'resposta' }, [
        el('strong', { texto: 'Resposta da academia: ' }), item.resposta,
      ]) : null,
      podeModerar ? el('div', { classe: 'acoes', estilo: 'margin-top:.75rem' }, [
        item.status !== 'aprovada' ? botao('Aprovar', () => mudarStatus(item, 'aprovada'), 'botao pequeno') : null,
        item.status !== 'recusada' ? botao('Recusar', () => mudarStatus(item, 'recusada'), 'botao pequeno secundario') : null,
        botao(item.resposta ? 'Editar resposta' : 'Responder', () => responder(item), 'botao pequeno secundario'),
        sessao.papel === 'dono' ? botao('Excluir', () => excluir(item), 'botao pequeno perigo') : null,
      ].filter(Boolean)) : null,
    ]);
  }

  async function mudarStatus(item, status) {
    await api.atualizar(`/avaliacoes/${item.id}`, { status });
    aviso(status === 'aprovada' ? 'Avaliação publicada no site.' : 'Avaliação recusada.');
    await carregar();
  }

  function responder(item) {
    abrirFormulario({
      titulo: `Responder ${item.autor_nome}`,
      aviso: 'A resposta aparece junto do comentário na página pública.',
      campos: [{ nome: 'resposta', rotulo: 'Resposta da academia', tipo: 'textarea', obrigatorio: true }],
      valores: item,
      aoSalvar: async (dados) => {
        await api.atualizar(`/avaliacoes/${item.id}`, dados);
        aviso('Resposta publicada.');
        await carregar();
      },
    });
  }

  async function excluir(item) {
    if (!confirmar('Excluir esta avaliação definitivamente?')) return;
    await api.remover(`/avaliacoes/${item.id}`);
    aviso('Avaliação removida.');
    await carregar();
  }

  await carregar();

  return el('div', {}, [
    topo('Avaliações', 'Estrelas e comentários de alunos e visitantes do site', [
      botao('Deixar minha avaliação', () => formularioInterno(modalidades, carregar), 'botao secundario'),
    ]),
    cartao('Reputação da academia', areaResumo),
    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Situação' }),
        el('select', { aoMudar: (evento) => { filtro.status = evento.target.value; carregar(); } }, [
          el('option', { value: '', texto: 'Todas' }),
          el('option', { value: 'pendente', texto: 'Aguardando aprovacao' }),
          el('option', { value: 'aprovada', texto: 'Publicadas' }),
          el('option', { value: 'recusada', texto: 'Recusadas' }),
        ]),
      ]),
    ]),
    area,
  ]);
}

function formularioInterno(modalidades, aoTerminar) {
  abrirFormulario({
    titulo: 'Deixar uma avaliação',
    aviso: 'Ela entra na fila de aprovacao antes de aparecer no site.',
    campos: [
      { nome: 'nota', rotulo: 'Nota', tipo: 'estrelas', valor: 5 },
      { nome: 'comentario', rotulo: 'Comentário', tipo: 'textarea' },
      { nome: 'modalidade_id', rotulo: 'Sobre qual modalidade? (opcional)', tipo: 'select',
        opcoes: [{ valor: '', rotulo: 'A academia em geral' }, ...modalidades.map((m) => ({ valor: m.id, rotulo: m.nome }))] },
    ],
    aoSalvar: async (dados) => {
      const resposta = await api.criar('/avaliacoes', dados);
      aviso(resposta.mensagem);
      if (aoTerminar) await aoTerminar();
    },
  });
}

/* -------------------------------------------------------------- aluno */

async function telaDoAluno() {
  const [modalidades, minhas] = await Promise.all([
    api.obter('/modalidades'),
    api.obter('/avaliacoes/minhas'),
  ]);
  const area = el('div');

  function desenhar(lista) {
    area.replaceChildren(lista.length
      ? el('div', { classe: 'grade col-2' }, lista.map((item) => el('article', { classe: 'depoimento' }, [
        el('div', { classe: 'acoes', estilo: 'justify-content:space-between;margin-bottom:.5rem' }, [
          estrelas(item.nota),
          etiqueta(item.status === 'aprovada' ? 'publicada no site' : item.status, COR_STATUS[item.status]),
        ]),
        item.comentario ? el('p', { classe: 'texto', texto: item.comentario }) : null,
        el('div', { classe: 'autor', texto: dataBr(item.criado_em) }),
        item.resposta ? el('div', { classe: 'resposta' }, [
          el('strong', { texto: 'Resposta da academia: ' }), item.resposta,
        ]) : null,
      ])))
      : vazio('Você ainda não avaliou a academia. Sua opiniao ajuda muito!'));
  }

  desenhar(minhas);

  return el('div', {}, [
    topo('Minhas avaliações', 'Conte como esta sendo treinar no CT Atak', [
      botao('Avaliar a academia', () => formularioInterno(modalidades, async () => {
        desenhar(await api.obter('/avaliacoes/minhas'));
      })),
    ]),
    area,
  ]);
}
