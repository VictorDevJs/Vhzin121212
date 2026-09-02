import { api, sessao, consulta } from '../api.js';
import {
  el, cartao, botao, etiqueta, etiquetaCor, dataBr, dataHoraBr,
  abrirFormulario, aviso, confirmar, vazio,
} from '../ui.js';
import { icone } from '../icones.js';
import { topo, marcarAvisosComoLidos } from '../app.js';

const TIPOS = [
  { valor: 'geral', rotulo: 'Aviso geral' },
  { valor: 'campeonato', rotulo: 'Campeonato' },
  { valor: 'evento', rotulo: 'Evento / treino extra' },
  { valor: 'cancelamento', rotulo: 'Aula cancelada' },
  { valor: 'manutencao', rotulo: 'Manutenção' },
  { valor: 'graduacao', rotulo: 'Exame de faixa' },
];

const PUBLICOS = [
  { valor: 'todos', rotulo: 'Todos os alunos' },
  { valor: 'kids', rotulo: 'Somente kids' },
  { valor: 'adultos', rotulo: 'Somente adultos' },
  { valor: 'modalidade', rotulo: 'Uma modalidade' },
  { valor: 'turma', rotulo: 'Uma turma' },
  { valor: 'competidores', rotulo: 'Equipes de competição' },
  { valor: 'equipe', rotulo: 'Somente a equipe da academia' },
];

const COR_TIPO = {
  campeonato: 'alerta', evento: 'info', cancelamento: 'erro', graduacao: 'ok', manutencao: 'neutra', geral: 'neutra',
};

/**
 * Mural de avisos separado por arte marcial. Quem treina Jiu-Jitsu abre a aba
 * do Jiu-Jitsu e vê só o que é dele; a aba "Para todos" guarda os recados
 * que valem para a academia inteira.
 */
export default async function paginaAvisos() {
  const podePublicar = sessao.ehUm('dono', 'mestre', 'recepcao', 'competicoes');
  const [modalidadesDoMural, turmas] = await Promise.all([
    api.obter('/avisos/modalidades'),
    podePublicar ? api.obter('/turmas') : Promise.resolve([]),
  ]);
  const modalidades = podePublicar ? await api.obter('/modalidades') : modalidadesDoMural;

  // A aba ativa: '' = tudo, 'gerais' = sem modalidade, ou o id da modalidade.
  const filtro = { aba: '', tipo: '' };
  const area = el('div');
  const abas = el('nav', { classe: 'abas-modalidade', 'aria-label': 'Filtrar avisos por modalidade' });

  function desenharAbas() {
    const opcoes = [
      { chave: '', rotulo: 'Tudo', cor: 'var(--marca-1)' },
      { chave: 'gerais', rotulo: 'Para todos', cor: 'var(--texto-2)' },
      ...modalidadesDoMural.map((m) => ({
        chave: String(m.id), rotulo: m.nome, cor: m.cor, contador: m.avisos,
      })),
    ];
    abas.replaceChildren(...opcoes.map((opcao) => el('button', {
      classe: `aba-modalidade ${filtro.aba === opcao.chave ? 'ativa' : ''}`,
      type: 'button',
      estilo: `--cor-aba:${opcao.cor}`,
      'aria-pressed': filtro.aba === opcao.chave ? 'true' : 'false',
      aoClicar: () => { filtro.aba = opcao.chave; desenharAbas(); carregar(); },
    }, [
      el('span', { classe: 'ponto-aba' }),
      opcao.rotulo,
      opcao.contador ? el('span', { classe: 'contador-aba', texto: String(opcao.contador) }) : null,
    ].filter(Boolean))));
  }

  async function carregar() {
    const parametros = { tipo: filtro.tipo };
    if (filtro.aba && filtro.aba !== 'gerais') parametros.modalidade_id = filtro.aba;
    let lista = await api.obter(`/avisos${consulta(parametros)}`);
    if (filtro.aba === 'gerais') lista = lista.filter((item) => !item.modalidade_id);

    area.replaceChildren(lista.length
      ? el('div', { classe: 'grade col-2' }, lista.map(cartaoAviso))
      : vazio(filtro.aba && filtro.aba !== 'gerais'
        ? 'Nenhum aviso desta modalidade ainda.'
        : 'Nenhum aviso publicado ainda.'));
  }

  function cartaoAviso(item) {
    const meu = item.autor_id === sessao.usuario.id;
    const podeMexer = sessao.ehUm('dono', 'recepcao') || (podePublicar && meu);
    return el('article', {
      classe: 'cartao aviso',
      estilo: `--cor-aviso:${item.modalidade_cor || corDaModalidade(item.modalidade_id)}`,
    }, [
      el('div', { classe: 'acoes', estilo: 'margin-bottom:.5rem' }, [
        item.fixado ? etiqueta('fixado', 'alerta') : null,
        etiqueta(TIPOS.find((t) => t.valor === item.tipo)?.rotulo || item.tipo, COR_TIPO[item.tipo] || 'neutra'),
        item.modalidade
          ? etiquetaCor(item.modalidade, corDaModalidade(item.modalidade_id))
          : etiqueta(destinoDoAviso(item), 'neutra'),
        item.ativo ? null : etiqueta('arquivado', 'neutra'),
      ].filter(Boolean)),
      el('h3', { texto: item.titulo }),
      el('p', { texto: item.mensagem }),
      item.data_evento
        ? el('p', { classe: 'dica' }, [
          icone('calendario', 14),
          ` ${dataBr(item.data_evento)}${item.local_evento ? ` · ${item.local_evento}` : ''}`,
        ])
        : null,
      el('p', { classe: 'dica', texto: `Publicado por ${item.autor || 'sistema'} em ${dataHoraBr(item.criado_em)}` }),
      podeMexer
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

  function corDaModalidade(id) {
    return modalidades.find((m) => m.id === id)?.cor || 'var(--borda)';
  }

  function destinoDoAviso(item) {
    if (item.publico === 'turma') return item.turma || 'turma';
    return PUBLICOS.find((p) => p.valor === item.publico)?.rotulo || item.publico;
  }

  function formulario(item = null) {
    // Ao publicar dentro de uma aba de modalidade, o aviso já nasce daquela arte.
    const modalidadeDaAba = filtro.aba && filtro.aba !== 'gerais' ? Number(filtro.aba) : '';
    abrirFormulario({
      titulo: item ? 'Editar aviso' : 'Novo aviso',
      aviso: 'Escolha "Uma modalidade" para o recado chegar só a quem treina aquela arte marcial.',
      campos: [
        { nome: 'titulo', rotulo: 'Título', obrigatorio: true,
          placeholder: 'Campeonato estadual, sem aula na sexta...' },
        { nome: 'mensagem', rotulo: 'Mensagem', tipo: 'textarea', obrigatorio: true },
        { nome: 'tipo', rotulo: 'Tipo do aviso', tipo: 'select', opcoes: TIPOS },
        { nome: 'publico', rotulo: 'Quem deve ver', tipo: 'select', opcoes: PUBLICOS },
        { nome: 'modalidade_id', rotulo: 'Modalidade (quando o público for uma modalidade)', tipo: 'select',
          opcoes: [{ valor: '', rotulo: '-' }, ...modalidades.map((m) => ({ valor: m.id, rotulo: m.nome }))] },
        { nome: 'turma_id', rotulo: 'Turma (quando o público for uma turma)', tipo: 'select',
          opcoes: [{ valor: '', rotulo: '-' }, ...turmas.map((t) => ({ valor: t.id, rotulo: `${t.modalidade} · ${t.nome}` }))] },
        { nome: 'data_evento', rotulo: 'Data do evento / campeonato', tipo: 'date' },
        { nome: 'local_evento', rotulo: 'Local' },
        { nome: 'fixado', rotulo: 'Fixar no topo do mural', tipo: 'checkbox' },
        { nome: 'publicar_site', rotulo: 'Mostrar na página pública da academia', tipo: 'checkbox', valor: 1 },
      ],
      valores: item || {
        tipo: 'geral',
        publico: modalidadeDaAba ? 'modalidade' : 'todos',
        modalidade_id: modalidadeDaAba,
        publicar_site: 1,
      },
      aoSalvar: async (dados) => {
        if (item) await api.atualizar(`/avisos/${item.id}`, dados);
        else await api.criar('/avisos', dados);
        aviso('Aviso publicado.');
        await carregar();
      },
    });
  }

  desenharAbas();
  await carregar();
  marcarAvisosComoLidos();

  return el('div', {}, [
    topo('Avisos', sessao.papel === 'aluno'
      ? 'Campeonatos, eventos e mudanças nas aulas que você treina'
      : 'Publique campeonatos, cancelamentos e recados para cada arte marcial',
    podePublicar ? [botao('+ Novo aviso', () => formulario())] : []),

    el('p', { classe: 'explicacao' }, [
      icone('megafone', 16),
      sessao.papel === 'aluno'
        ? 'As abas abaixo são as artes marciais que você treina. Você recebe os recados gerais da academia e os avisos específicos da sua modalidade.'
        : 'Cada arte marcial tem a sua aba. Um aviso publicado no Jiu-Jitsu chega só a quem treina Jiu-Jitsu, sem poluir o mural dos outros alunos.',
    ]),

    abas,

    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Tipo do aviso' }),
        el('select', { aoMudar: (evento) => { filtro.tipo = evento.target.value; carregar(); } }, [
          el('option', { value: '', texto: 'Todos os tipos' }),
          ...TIPOS.map((t) => el('option', { value: t.valor, texto: t.rotulo })),
        ]),
      ]),
    ]),

    cartao(null, area),
  ]);
}
