import { api, sessao } from '../api.js';
import {
  el, cartao, botao, etiqueta, abrirFormulario, aviso, confirmar, vazio, dataBr, esqueleto,
} from '../ui.js';
import { topo } from '../app.js';

const TIPOS = [
  { valor: 'faixa_preta', rotulo: 'Faixa preta' },
  { valor: 'graduacao', rotulo: 'Graduacao / troca de faixa' },
  { valor: 'mestre', rotulo: 'Titulacao de mestre' },
  { valor: 'federacao', rotulo: 'Registro em federacao' },
  { valor: 'curso', rotulo: 'Curso / formacao' },
  { valor: 'premiacao', rotulo: 'Premiacao / titulo' },
  { valor: 'outro', rotulo: 'Outro documento' },
];

const ICONE_TIPO = {
  faixa_preta: '\u{1F94B}', graduacao: '\u{1F3C5}', mestre: '\u{1F393}',
  federacao: '\u{1F4DC}', curso: '\u{1F4D8}', premiacao: '\u{1F3C6}', outro: '\u{1F4C4}',
};

/** Certificados e titulacoes da academia - o dono publica, todos consultam. */
export default async function paginaCertificados() {
  const ehDono = sessao.papel === 'dono';
  const [modalidades, equipe] = await Promise.all([
    api.obter('/modalidades'),
    ehDono ? api.obter('/usuarios') : Promise.resolve([]),
  ]);

  const filtro = { tipo: '' };
  const area = el('div');

  async function carregar() {
    area.replaceChildren(esqueleto(3, 88));
    const lista = await api.obter(`/certificados${filtro.tipo ? `?tipo=${filtro.tipo}` : ''}`);
    area.replaceChildren(lista.length
      ? el('div', { classe: 'grade col-2' }, lista.map(cartaoCertificado))
      : vazio('Nenhum certificado publicado ainda.', '\u{1F3C5}'));
  }

  function cartaoCertificado(item) {
    const rotuloTipo = TIPOS.find((t) => t.valor === item.tipo)?.rotulo || item.tipo;
    return el('article', { classe: 'certificado' }, [
      el('div', { classe: 'miniatura' }, [
        item.arquivo && !item.arquivo.endsWith('.pdf')
          ? el('img', { src: item.arquivo, alt: `Certificado de ${item.pessoa_nome}`, loading: 'lazy' })
          : el('span', { texto: ICONE_TIPO[item.tipo] || '\u{1F4C4}' }),
      ]),
      el('div', { estilo: 'min-width:0;flex:1' }, [
        el('div', { classe: 'selo-tipo', texto: rotuloTipo }),
        el('h3', { texto: item.titulo, estilo: 'margin:.1rem 0 .25rem' }),
        el('div', { estilo: 'font-weight:600' }, [item.pessoa_nome]),
        el('div', { classe: 'dica' }, [
          [item.modalidade, item.entidade, item.data_emissao && dataBr(item.data_emissao)]
            .filter(Boolean).join(' · '),
        ]),
        item.registro ? el('div', { classe: 'dica', texto: `Registro: ${item.registro}` }) : null,
        item.descricao ? el('p', { classe: 'dica', estilo: 'margin-top:.4rem', texto: item.descricao }) : null,
        el('div', { classe: 'acoes', estilo: 'margin-top:.6rem' }, [
          item.publicar_site ? etiqueta('no site', 'bom') : etiqueta('interno', 'neutra'),
          item.arquivo ? el('a', {
            classe: 'botao pequeno secundario', href: item.arquivo, target: '_blank',
            rel: 'noopener', texto: 'Abrir documento',
          }) : null,
          ehDono ? botao('Editar', () => formulario(item), 'botao pequeno secundario') : null,
          ehDono ? botao('Excluir', () => excluir(item), 'botao pequeno perigo') : null,
        ].filter(Boolean)),
      ]),
    ]);
  }

  function formulario(item = null) {
    abrirFormulario({
      titulo: item ? 'Editar certificado' : 'Publicar certificado',
      aviso: 'Envie a foto ou o PDF do diploma. Marcado para o site, ele aparece na pagina publica da academia.',
      campos: [
        { nome: 'titulo', rotulo: 'Titulo do documento', obrigatorio: true, placeholder: 'Faixa preta de Jiu-Jitsu' },
        { nome: 'pessoa_nome', rotulo: 'Nome de quem recebeu', obrigatorio: true },
        { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: TIPOS },
        { nome: 'modalidade_id', rotulo: 'Modalidade', tipo: 'select',
          opcoes: [{ valor: '', rotulo: '-' }, ...modalidades.map((m) => ({ valor: m.id, rotulo: m.nome }))] },
        ...(ehDono ? [{ nome: 'usuario_id', rotulo: 'Vincular a um mestre da equipe', tipo: 'select',
          opcoes: [{ valor: '', rotulo: '-' }, ...equipe.filter((u) => u.papel === 'mestre').map((u) => ({ valor: u.id, rotulo: u.nome }))] }] : []),
        { nome: 'entidade', rotulo: 'Federacao / entidade emissora', placeholder: 'CBJJ, CBMT, IBJJF...' },
        { nome: 'registro', rotulo: 'Numero de registro' },
        { nome: 'data_emissao', rotulo: 'Data de emissao', tipo: 'date' },
        { nome: 'descricao', rotulo: 'Observacoes', tipo: 'textarea' },
        { nome: 'arquivo_novo', rotulo: 'Imagem ou PDF do certificado', tipo: 'arquivo',
          dica: 'JPG, PNG, WEBP ou PDF de ate 5 MB.' },
        { nome: 'publicar_site', rotulo: 'Mostrar na pagina publica', tipo: 'checkbox', valor: 1 },
      ],
      valores: item || { tipo: 'faixa_preta', publicar_site: 1 },
      aoSalvar: async (dados) => {
        const { arquivo_novo: conteudo, ...corpo } = dados;
        if (conteudo) {
          const enviado = await api.criar('/arquivos', { conteudo });
          corpo.arquivo = enviado.url;
        } else if (item?.arquivo) {
          corpo.arquivo = item.arquivo;
        }
        if (item) await api.atualizar(`/certificados/${item.id}`, corpo);
        else await api.criar('/certificados', corpo);
        aviso('Certificado salvo.');
        await carregar();
      },
    });
  }

  async function excluir(item) {
    if (!confirmar(`Excluir o certificado "${item.titulo}"?`)) return;
    await api.remover(`/certificados/${item.id}`);
    aviso('Certificado removido.');
    await carregar();
  }

  await carregar();

  return el('div', {}, [
    topo('Certificados e titulacoes',
      'Faixas pretas, titulacoes dos mestres, registros em federacao e cursos da equipe',
      ehDono ? [botao('+ Publicar certificado', () => formulario())] : []),
    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Tipo' }),
        el('select', { aoMudar: (evento) => { filtro.tipo = evento.target.value; carregar(); } }, [
          el('option', { value: '', texto: 'Todos' }),
          ...TIPOS.map((t) => el('option', { value: t.valor, texto: t.rotulo })),
        ]),
      ]),
    ]),
    cartao(null, area),
  ]);
}
