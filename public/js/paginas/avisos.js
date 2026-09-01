import { api, sessao } from '../api.js';
import { el, cartao, botao, etiqueta, dataBr, dataHoraBr, abrirFormulario, aviso, confirmar, vazio } from '../ui.js';
import { topo } from '../app.js';

const TIPOS = [
  { valor: 'geral', rotulo: 'Aviso geral' },
  { valor: 'campeonato', rotulo: 'Campeonato' },
  { valor: 'evento', rotulo: 'Evento / treino extra' },
  { valor: 'cancelamento', rotulo: 'Aula cancelada' },
  { valor: 'manutencao', rotulo: 'Manutencao' },
  { valor: 'graduacao', rotulo: 'Exame de faixa' },
];

const PUBLICOS = [
  { valor: 'todos', rotulo: 'Todos os alunos' },
  { valor: 'kids', rotulo: 'Somente kids' },
  { valor: 'adultos', rotulo: 'Somente adultos' },
  { valor: 'modalidade', rotulo: 'Uma modalidade' },
  { valor: 'turma', rotulo: 'Uma turma' },
  { valor: 'equipe', rotulo: 'Somente a equipe' },
];

const COR_TIPO = {
  campeonato: 'alerta', evento: 'info', cancelamento: 'erro', graduacao: 'ok', manutencao: 'neutra', geral: 'neutra',
};

/** Mural de avisos: campeonatos, cancelamentos, eventos e recados. */
export default async function paginaAvisos() {
  const podePublicar = sessao.ehUm('dono', 'mestre', 'recepcao');
  const [modalidades, turmas] = podePublicar
    ? await Promise.all([api.obter('/modalidades'), api.obter('/turmas')])
    : [[], []];

  const filtro = { tipo: '' };
  const area = el('div');

  async function carregar() {
    const lista = await api.obter(`/avisos${filtro.tipo ? `?tipo=${filtro.tipo}` : ''}`);
    area.replaceChildren(lista.length
      ? el('div', { classe: 'grade col-2' }, lista.map(cartaoAviso))
      : vazio('Nenhum aviso publicado ainda.'));
  }

  function cartaoAviso(item) {
    const meu = item.autor_id === sessao.usuario.id;
    const podeMexer = sessao.papel === 'dono' || sessao.papel === 'recepcao' || (sessao.papel === 'mestre' && meu);
    return el('article', { classe: 'cartao' }, [
      el('div', { classe: 'acoes', estilo: 'margin-bottom:.5rem' }, [
        item.fixado ? etiqueta('fixado', 'alerta') : null,
        etiqueta(TIPOS.find((t) => t.valor === item.tipo)?.rotulo || item.tipo, COR_TIPO[item.tipo] || 'neutra'),
        etiqueta(destinoDoAviso(item), 'neutra'),
        item.ativo ? null : etiqueta('arquivado', 'neutra'),
      ]),
      el('h3', { texto: item.titulo }),
      el('p', { texto: item.mensagem }),
      item.data_evento
        ? el('p', { classe: 'dica', texto: `📅 ${dataBr(item.data_evento)}${item.local_evento ? ` · ${item.local_evento}` : ''}` })
        : null,
      el('p', { classe: 'dica', texto: `Publicado por ${item.autor || 'sistema'} em ${dataHoraBr(item.criado_em)}` }),
      podeMexer && podePublicar
        ? el('div', { classe: 'acoes' }, [
          botao('Editar', () => formulario(item), 'botao pequeno secundario'),
          botao(item.ativo ? 'Arquivar' : 'Reativar', async () => {
            await api.atualizar(`/avisos/${item.id}`, { ativo: item.ativo ? 0 : 1 });
            await carregar();
          }, 'botao pequeno secundario'),
          botao('Excluir', async () => {
            if (!confirmar('Excluir este aviso?')) return;
            await api.remover(`/avisos/${item.id}`);
            aviso('Aviso removido.');
            await carregar();
          }, 'botao pequeno perigo'),
        ])
        : null,
    ]);
  }

  function destinoDoAviso(item) {
    if (item.publico === 'modalidade') return item.modalidade || 'modalidade';
    if (item.publico === 'turma') return item.turma || 'turma';
    return PUBLICOS.find((p) => p.valor === item.publico)?.rotulo || item.publico;
  }

  function formulario(item = null) {
    abrirFormulario({
      titulo: item ? 'Editar aviso' : 'Novo aviso',
      campos: [
        { nome: 'titulo', rotulo: 'Titulo', obrigatorio: true, placeholder: 'Campeonato estadual, sem aula na sexta...' },
        { nome: 'mensagem', rotulo: 'Mensagem', tipo: 'textarea', obrigatorio: true },
        { nome: 'tipo', rotulo: 'Tipo do aviso', tipo: 'select', opcoes: TIPOS },
        { nome: 'publico', rotulo: 'Quem deve ver', tipo: 'select', opcoes: PUBLICOS },
        { nome: 'modalidade_id', rotulo: 'Modalidade (se o publico for modalidade)', tipo: 'select',
          opcoes: [{ valor: '', rotulo: '-' }, ...modalidades.map((m) => ({ valor: m.id, rotulo: m.nome }))] },
        { nome: 'turma_id', rotulo: 'Turma (se o publico for turma)', tipo: 'select',
          opcoes: [{ valor: '', rotulo: '-' }, ...turmas.map((t) => ({ valor: t.id, rotulo: `${t.modalidade} · ${t.nome}` }))] },
        { nome: 'data_evento', rotulo: 'Data do evento / campeonato', tipo: 'date' },
        { nome: 'local_evento', rotulo: 'Local' },
        { nome: 'fixado', rotulo: 'Fixar no topo', tipo: 'checkbox' },
        { nome: 'publicar_site', rotulo: 'Mostrar na pagina publica da academia', tipo: 'checkbox', valor: 1 },
      ],
      valores: item || { tipo: 'geral', publico: 'todos', publicar_site: 1 },
      aoSalvar: async (dados) => {
        if (item) await api.atualizar(`/avisos/${item.id}`, dados);
        else await api.criar('/avisos', dados);
        aviso('Aviso publicado.');
        await carregar();
      },
    });
  }

  await carregar();

  return el('div', {}, [
    topo('Avisos', sessao.papel === 'aluno'
      ? 'Campeonatos, eventos e mudancas nas aulas'
      : 'Publique campeonatos, cancelamentos de aula e recados',
    podePublicar ? [botao('+ Novo aviso', () => formulario())] : []),
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
