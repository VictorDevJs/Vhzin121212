import { api, sessao, consulta } from '../api.js';
import {
  el, cartao, botao, etiqueta, etiquetaCor, vazio, esqueleto, aviso, confirmar,
  abrirFormulario, abrirModal, dataBr, opcoesDe,
} from '../ui.js';
import { icone } from '../icones.js';
import { topo } from '../app.js';

const CATEGORIAS = [
  { valor: 'treino', rotulo: 'Treino' },
  { valor: 'turma', rotulo: 'Turma' },
  { valor: 'estrutura', rotulo: 'Estrutura da academia' },
  { valor: 'competicao', rotulo: 'Competição' },
  { valor: 'evento', rotulo: 'Evento' },
  { valor: 'graduacao', rotulo: 'Graduação' },
  { valor: 'equipe', rotulo: 'Equipe' },
];

const NOME_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.rotulo]));

/**
 * Galeria da academia: as fotos que aparecem no site.
 *
 * Cada foto pertence a uma arte marcial ou à casa toda, e o mestre só mexe
 * nas da arte dele — o mesmo recorte do resto do sistema.
 */
export default async function paginaFotos() {
  const podeEditar = sessao.ehUm('dono', 'mestre', 'recepcao', 'competicoes');
  const ehGestao = sessao.ehUm('dono', 'recepcao');
  const filtro = { modalidade_id: '', categoria: '' };
  const area = el('div', {}, [esqueleto(2, 180)]);
  const modalidades = await api.obter('/modalidades');

  async function carregar() {
    const fotos = await api.obter(`/fotos${consulta(filtro)}`);
    desenhar(fotos);
  }

  function desenhar(fotos) {
    if (!fotos.length) {
      area.replaceChildren(vazio(podeEditar
        ? 'Nenhuma foto ainda. Envie a primeira e ela aparece no site na hora.'
        : 'A academia ainda não publicou fotos.'));
      return;
    }

    // Agrupa por arte marcial, como o resto do sistema.
    const grupos = new Map();
    for (const foto of fotos) {
      const chave = foto.modalidade || 'A academia toda';
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(foto);
    }

    area.replaceChildren(el('div', {}, [...grupos.entries()].map(([nome, lista]) => cartao(
      `${nome} · ${lista.length} foto(s)`,
      el('div', { classe: 'galeria' }, lista.map(quadro)),
    ))));
  }

  function quadro(foto) {
    return el('figure', { classe: `quadro-foto ${foto.destaque ? 'destaque' : ''}` }, [
      el('button', {
        classe: 'abrir-foto', type: 'button', 'aria-label': foto.legenda || 'Ampliar foto',
        aoClicar: () => ampliar(foto),
      }, [
        el('img', { src: foto.arquivo, alt: foto.legenda || 'Foto da academia', loading: 'lazy' }),
      ]),
      el('figcaption', {}, [
        el('div', { classe: 'acoes' }, [
          foto.modalidade ? etiquetaCor(foto.modalidade, foto.modalidade_cor) : etiqueta('geral', 'neutra'),
          etiqueta(NOME_CATEGORIA[foto.categoria] || foto.categoria, 'neutra'),
          foto.publicar_site ? null : etiqueta('fora do site', 'alerta'),
          foto.destaque ? etiqueta('destaque', 'marca') : null,
        ].filter(Boolean)),
        foto.legenda ? el('p', { classe: 'legenda-foto', texto: foto.legenda }) : null,
        el('div', { classe: 'dica', texto: `${foto.enviada_por || 'academia'} · ${dataBr(foto.criado_em)}` }),
        podeEditar
          ? el('div', { classe: 'acoes' }, [
            botao('Editar', () => editar(foto), 'botao pequeno secundario'),
            botao('Remover', () => remover(foto), 'botao pequeno perigo'),
          ])
          : null,
      ].filter(Boolean)),
    ]);
  }

  function ampliar(foto) {
    abrirModal({
      titulo: foto.legenda || 'Foto da academia',
      largura: '900px',
      conteudo: el('div', {}, [
        el('img', { classe: 'foto-ampliada', src: foto.arquivo, alt: foto.legenda || 'Foto da academia' }),
        el('div', { classe: 'acoes', estilo: 'margin-top:.8rem' }, [
          foto.modalidade ? etiquetaCor(foto.modalidade, foto.modalidade_cor) : etiqueta('geral', 'neutra'),
          etiqueta(NOME_CATEGORIA[foto.categoria] || foto.categoria, 'neutra'),
        ]),
      ]),
    });
  }

  function camposDaFoto(comArquivo) {
    return [
      comArquivo
        ? { nome: 'arquivo', rotulo: 'Foto', tipo: 'arquivo', aceita: 'image/*', obrigatorio: true }
        : null,
      { nome: 'legenda', rotulo: 'Legenda', placeholder: 'Ex.: treino de No-Gi na terça à noite' },
      { nome: 'categoria', rotulo: 'O que a foto mostra', tipo: 'select', opcoes: CATEGORIAS },
      { nome: 'modalidade_id', rotulo: 'Arte marcial', tipo: 'select',
        opcoes: [
          ...(ehGestao ? [{ valor: '', rotulo: 'A academia toda' }] : []),
          ...opcoesDe(modalidades),
        ] },
      { nome: 'destaque', rotulo: 'Colocar entre as primeiras da galeria', tipo: 'checkbox' },
      { nome: 'publicar_site', rotulo: 'Mostrar no site público', tipo: 'checkbox' },
    ].filter(Boolean);
  }

  function enviar() {
    abrirFormulario({
      titulo: 'Nova foto da academia',
      aviso: 'Foto deitada (paisagem) fica melhor na galeria. Até 5 MB, em JPG, PNG ou WEBP.',
      campos: camposDaFoto(true),
      valores: { categoria: 'treino', publicar_site: 1, destaque: 0 },
      textoConfirmar: 'Publicar foto',
      aoSalvar: async (dados) => {
        if (!dados.arquivo) throw new Error('Escolha uma foto.');
        const enviada = await api.criar('/arquivos', { conteudo: dados.arquivo });
        await api.criar('/fotos', { ...dados, arquivo: enviada.url });
        aviso('Foto publicada na galeria.');
        await carregar();
      },
    });
  }

  function editar(foto) {
    abrirFormulario({
      titulo: 'Editar foto',
      campos: camposDaFoto(false),
      valores: { ...foto, modalidade_id: foto.modalidade_id ?? '' },
      aoSalvar: async (dados) => {
        await api.atualizar(`/fotos/${foto.id}`, dados);
        aviso('Foto atualizada.');
        await carregar();
      },
    });
  }

  async function remover(foto) {
    if (!confirmar('Remover esta foto da galeria? Ela sai do site na hora.')) return;
    await api.remover(`/fotos/${foto.id}`);
    aviso('Foto removida.');
    await carregar();
  }

  await carregar();

  return el('div', {}, [
    topo('Galeria da academia', 'As fotos que aparecem no site, divididas por arte marcial',
      podeEditar ? [botao('+ Nova foto', enviar)] : []),

    el('p', { classe: 'explicacao' }, [
      icone('camera', 16),
      'É o que o visitante vê antes de entrar: o tatame, a turma, a estrutura e os campeonatos. '
      + 'Cada foto pode ser de uma arte marcial ou da academia inteira — e você escolhe quais vão para o site.',
    ]),

    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Arte marcial' }),
        el('select', { aoMudar: (evento) => { filtro.modalidade_id = evento.target.value; carregar(); } }, [
          el('option', { value: '', texto: 'Todas' }),
          ...modalidades.map((m) => el('option', { value: m.id, texto: m.nome })),
        ]),
      ]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'O que mostra' }),
        el('select', { aoMudar: (evento) => { filtro.categoria = evento.target.value; carregar(); } }, [
          el('option', { value: '', texto: 'Tudo' }),
          ...CATEGORIAS.map((c) => el('option', { value: c.valor, texto: c.rotulo })),
        ]),
      ]),
    ]),

    area,
  ]);
}
