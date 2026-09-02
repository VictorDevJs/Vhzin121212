import { api, sessao, consulta } from '../api.js';
import {
  el, cartao, botao, etiqueta, etiquetaCor, tabela, celula, indicador, dataBr,
  abrirFormulario, abrirModal, aviso, confirmar, vazio, opcoesDe,
} from '../ui.js';
import { icone } from '../icones.js';
import { topo } from '../app.js';

const CATEGORIAS = [
  { valor: 'adulto', rotulo: 'Adulto' },
  { valor: 'kids', rotulo: 'Kids' },
  { valor: 'feminino', rotulo: 'Feminino' },
  { valor: 'misto', rotulo: 'Misto' },
];

const FUNCOES = [
  { valor: 'atleta', rotulo: 'Atleta' },
  { valor: 'capitao', rotulo: 'Capitão da equipe' },
  { valor: 'reserva', rotulo: 'Reserva' },
  { valor: 'tecnico', rotulo: 'Técnico auxiliar' },
];

/**
 * Equipes de competição da academia: cada modalidade monta o seu time,
 * com técnico, atletas, categoria de peso e histórico de pódios.
 */
export default async function paginaCompetidores() {
  const podeGerir = sessao.papel === 'dono' || sessao.papel === 'competicoes'
    || (sessao.usuario?.cargos || []).some((c) => c.cargo === 'competicoes');

  const [modalidades, mestres, alunos, categoriasPeso] = await Promise.all([
    api.obter('/modalidades'),
    sessao.papel === 'aluno' ? Promise.resolve([]) : api.obter('/usuarios/mestres'),
    podeGerir ? api.obter('/alunos?status=ativo') : Promise.resolve([]),
    api.obter('/competicoes/categorias-peso'),
  ]);

  const filtro = { modalidade_id: '' };
  const area = el('div');
  const areaIndicadores = el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' });

  async function carregar() {
    const equipes = await api.obter(`/equipes${consulta(filtro)}`);
    area.replaceChildren(equipes.length
      ? el('div', { classe: 'grade col-3' }, equipes.map(cartaoEquipe))
      : vazio('Nenhuma equipe nesta modalidade ainda.'));

    const totalAtletas = equipes.reduce((soma, e) => soma + e.atletas, 0);
    const totalPodios = equipes.reduce((soma, e) => soma + e.podios, 0);
    const artes = new Set(equipes.map((e) => e.modalidade).filter(Boolean));
    areaIndicadores.replaceChildren(
      indicador({ rotulo: 'Equipes montadas', valor: String(equipes.length),
        detalhe: `${artes.size} arte(s) marcial(is)` }),
      indicador({ rotulo: 'Atletas na competição', valor: String(totalAtletas),
        detalhe: 'Somando todas as equipes', tipo: 'destaque' }),
      indicador({ rotulo: 'Pódios conquistados', valor: String(totalPodios),
        detalhe: 'Ouro, prata e bronze' }),
      indicador({ rotulo: 'Equipes kids', valor: String(equipes.filter((e) => e.categoria === 'kids').length),
        detalhe: 'Times infantis' }),
    );
  }

  function cartaoEquipe(equipe) {
    return el('article', { classe: 'cartao equipe tilt', estilo: `--cor-equipe:${equipe.cor || 'var(--marca-1)'}` }, [
      el('div', { classe: 'faixa-equipe' }),
      el('div', { classe: 'acoes', estilo: 'margin-bottom:.5rem' }, [
        equipe.modalidade ? etiquetaCor(equipe.modalidade, equipe.modalidade_cor) : null,
        etiqueta(CATEGORIAS.find((c) => c.valor === equipe.categoria)?.rotulo || equipe.categoria, 'neutra'),
        equipe.ativo ? null : etiqueta('inativa', 'neutra'),
      ].filter(Boolean)),
      el('h3', { texto: equipe.nome }),
      equipe.descricao ? el('p', { classe: 'legenda', texto: equipe.descricao }) : null,
      el('div', { classe: 'numeros-equipe' }, [
        blocoNumero(equipe.atletas, 'atletas'),
        blocoNumero(equipe.podios, 'pódios'),
      ]),
      el('p', { classe: 'dica', texto: `Técnico: ${equipe.tecnico || 'a definir'}` }),
      el('div', { classe: 'acoes' }, [
        botao('Ver equipe', () => abrirEquipe(equipe.id), 'botao pequeno secundario'),
        podeGerir ? botao('Editar', () => formulario(equipe), 'botao pequeno secundario') : null,
        podeGerir ? botao('Excluir', async () => {
          if (!confirmar(`Excluir a equipe "${equipe.nome}"?`)) return;
          await api.remover(`/equipes/${equipe.id}`);
          aviso('Equipe removida.');
          await carregar();
        }, 'botao pequeno perigo') : null,
      ].filter(Boolean)),
    ]);
  }

  function blocoNumero(valor, rotulo) {
    return el('div', { classe: 'bloco-numero' }, [
      el('strong', { texto: String(valor) }),
      el('span', { texto: rotulo }),
    ]);
  }

  /* ---------------------------------------------------- elenco */

  async function abrirEquipe(id) {
    const equipe = await api.obter(`/equipes/${id}`);
    const corpo = el('div');
    const pesos = categoriasPeso[equipe.modalidade] || [];

    function desenhar() {
      corpo.replaceChildren(
        el('p', { classe: 'explicacao' }, [
          icone('escudo', 16),
          `Equipe de ${equipe.modalidade || 'competição'} comandada por ${equipe.tecnico || 'técnico a definir'}. `
          + `Cada atleta aparece com a graduação atual e a categoria de peso em que costuma lutar.`,
        ]),
        tabela(
          ['Atleta', 'Função', 'Graduação', 'Categoria', 'Peso', 'Desde', 'Ouros', 'Ações'],
          (equipe.membros || []).map((membro) => [
            membro.aluno,
            celula([etiqueta(FUNCOES.find((f) => f.valor === membro.funcao)?.rotulo || membro.funcao,
              membro.funcao === 'capitao' ? 'alerta' : 'neutra')]),
            membro.graduacao ? celula([etiquetaCor(membro.graduacao, membro.graduacao_cor)]) : '-',
            membro.categoria_peso || '-',
            membro.peso ? `${membro.peso} kg` : '-',
            membro.desde ? dataBr(membro.desde) : '-',
            String(membro.ouro || 0),
            celula(podeGerir ? [
              botao('Editar', () => formularioMembro(membro), 'botao pequeno secundario'),
              botao('Remover', async () => {
                if (!confirmar(`Tirar ${membro.aluno} da equipe?`)) return;
                await api.remover(`/equipes/${equipe.id}/membros/${membro.aluno_id}`);
                aviso('Atleta removido da equipe.');
                await recarregar();
              }, 'botao pequeno perigo'),
            ] : [], 'acoes-celula'),
          ]),
          'Esta equipe ainda não tem atletas.',
        ),
        podeGerir
          ? el('div', { classe: 'acoes', estilo: 'margin:.9rem 0' }, [
            botao('+ Incluir atleta', () => formularioMembro()),
          ])
          : null,
        (equipe.competicoes || []).length
          ? cartao('Competições desta equipe', tabela(
            ['Competição', 'Data', 'Situação', 'Atletas'],
            equipe.competicoes.map((c) => [c.nome, dataBr(c.data_inicio), c.status, String(c.inscritos)]),
          ))
          : null,
      );
    }

    async function recarregar() {
      const novo = await api.obter(`/equipes/${equipe.id}`);
      equipe.membros = novo.membros;
      equipe.competicoes = novo.competicoes;
      desenhar();
      await carregar();
    }

    function formularioMembro(membro = null) {
      abrirFormulario({
        titulo: membro ? `Atleta ${membro.aluno}` : `Incluir atleta em ${equipe.nome}`,
        aviso: pesos.length ? `Categorias de ${equipe.modalidade}: ${pesos.join(', ')}.` : null,
        campos: [
          membro ? null : { nome: 'aluno_id', rotulo: 'Aluno', tipo: 'select', obrigatorio: true,
            opcoes: opcoesDe(alunos.filter((a) => (equipe.categoria === 'kids'
              ? a.categoria === 'kids' : a.categoria === 'adulto'))) },
          { nome: 'funcao', rotulo: 'Função na equipe', tipo: 'select', opcoes: FUNCOES },
          { nome: 'categoria_peso', rotulo: 'Categoria de peso', tipo: 'select',
            opcoes: [{ valor: '', rotulo: 'A definir' }, ...pesos.map((p) => ({ valor: p, rotulo: p }))] },
          { nome: 'peso', rotulo: 'Peso atual (kg)', tipo: 'number', passo: '0.1' },
          { nome: 'desde', rotulo: 'Entrou na equipe em', tipo: 'date' },
        ].filter(Boolean),
        valores: membro || { funcao: 'atleta' },
        aoSalvar: async (dados) => {
          if (membro) await api.atualizar(`/equipes/${equipe.id}/membros/${membro.aluno_id}`, dados);
          else await api.criar(`/equipes/${equipe.id}/membros`, dados);
          aviso('Elenco atualizado.');
          await recarregar();
        },
      });
    }

    desenhar();
    abrirModal({ titulo: equipe.nome, conteudo: corpo, largura: '860px' });
  }

  function formulario(equipe = null) {
    abrirFormulario({
      titulo: equipe ? `Editar ${equipe.nome}` : 'Nova equipe de competição',
      aviso: 'A equipe é sempre de uma modalidade. Assim cada arte marcial tem o seu próprio time.',
      campos: [
        { nome: 'nome', rotulo: 'Nome da equipe', obrigatorio: true,
          placeholder: 'Atak Competição Jiu-Jitsu' },
        { nome: 'modalidade_id', rotulo: 'Modalidade', tipo: 'select', opcoes: opcoesDe(modalidades) },
        { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: CATEGORIAS },
        { nome: 'tecnico_id', rotulo: 'Técnico responsável', tipo: 'select',
          opcoes: [{ valor: '', rotulo: 'A definir' }, ...opcoesDe(mestres)] },
        { nome: 'descricao', rotulo: 'Sobre a equipe', tipo: 'textarea',
          placeholder: 'Dias de treino, exigências e objetivo do time.' },
        { nome: 'cor', rotulo: 'Cor da equipe', tipo: 'color', valor: '#f5b301' },
        { nome: 'ativo', rotulo: 'Equipe ativa', tipo: 'checkbox', valor: 1 },
      ],
      valores: equipe || { categoria: 'adulto', ativo: 1, cor: '#f5b301' },
      aoSalvar: async (dados) => {
        if (equipe) await api.atualizar(`/equipes/${equipe.id}`, dados);
        else await api.criar('/equipes', dados);
        aviso('Equipe salva.');
        await carregar();
      },
    });
  }

  await carregar();

  return el('div', {}, [
    topo('Competidores',
      'Equipes de competição por modalidade, com técnico, elenco, categorias de peso e pódios',
      podeGerir ? [botao('+ Nova equipe', () => formulario())] : []),

    el('p', { classe: 'explicacao' }, [
      icone('escudo', 16),
      'Cada arte marcial tem a sua equipe: Jiu-Jitsu, Muay Thai, Karatê, Judô, Boxe e MMA competem separados, '
      + 'com times kids e adulto. Abra uma equipe para ver o elenco e a campanha dela.',
    ]),

    areaIndicadores,

    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Modalidade' }),
        el('select', { aoMudar: (evento) => { filtro.modalidade_id = evento.target.value; carregar(); } }, [
          el('option', { value: '', texto: 'Todas as modalidades' }),
          ...modalidades.map((m) => el('option', { value: m.id, texto: m.nome })),
        ]),
      ]),
    ]),

    area,
  ]);
}
