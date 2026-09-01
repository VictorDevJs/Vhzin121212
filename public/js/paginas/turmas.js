import { api, sessao } from '../api.js';
import {
  el, cartao, tabela, celula, botao, etiqueta, abrirFormulario, abrirModal, aviso, confirmar,
  vazio, DIAS_SEMANA,
} from '../ui.js';
import { topo } from '../app.js';

/** Modalidades, faixas, turmas e horarios - o cadastro base da academia. */
export default async function paginaTurmas() {
  const ehDono = sessao.papel === 'dono';
  const areaModalidades = el('div');
  const areaTurmas = el('div');
  let modalidades = [];
  let mestres = [];

  async function carregar() {
    [modalidades, mestres] = await Promise.all([api.obter('/modalidades'), api.obter('/usuarios/mestres')]);
    const turmas = await api.obter('/turmas');
    desenharModalidades();
    desenharTurmas(turmas);
  }

  // ---------- Modalidades ----------

  function desenharModalidades() {
    areaModalidades.replaceChildren(
      modalidades.length
        ? el('div', { classe: 'grade col-3' }, modalidades.map((modalidade) => el('article', {
          classe: 'cartao-modalidade',
          estilo: `--cor-modalidade:${modalidade.cor || 'var(--marca-1)'}`,
        }, [
          el('h3', {}, [modalidade.nome, ' ', modalidade.ativo ? null : etiqueta('inativa', 'neutra')]),
          el('p', { classe: 'dica', texto: modalidade.descricao || 'Sem descricao.' }),
          el('div', { classe: 'acoes', estilo: 'margin-bottom:.6rem' }, [
            etiqueta(`${modalidade.total_turmas} turma(s)`, 'info'),
            etiqueta(`${modalidade.total_graduacoes} faixa(s)`, 'neutra'),
          ]),
          ehDono
            ? el('div', { classe: 'acoes' }, [
              botao('Editar', () => formularioModalidade(modalidade), 'botao pequeno secundario'),
              botao('Faixas', () => gerenciarFaixas(modalidade), 'botao pequeno secundario'),
              botao('Excluir', () => excluirModalidade(modalidade), 'botao pequeno perigo'),
            ])
            : botao('Ver faixas', () => gerenciarFaixas(modalidade), 'botao pequeno secundario'),
        ])))
        : vazio('Nenhuma modalidade cadastrada.'),
    );
  }

  function formularioModalidade(modalidade = null) {
    abrirFormulario({
      titulo: modalidade ? `Editar ${modalidade.nome}` : 'Nova modalidade',
      campos: [
        { nome: 'nome', rotulo: 'Nome da modalidade', obrigatorio: true, placeholder: 'Jiu-Jitsu, Boxe, Judo...' },
        { nome: 'descricao', rotulo: 'Descricao', tipo: 'textarea' },
        { nome: 'cor', rotulo: 'Cor de identificacao', tipo: 'color', valor: '#c62828' },
        { nome: 'ativo', rotulo: 'Modalidade ativa', tipo: 'checkbox', valor: 1 },
      ],
      valores: modalidade || {},
      aoSalvar: async (dados) => {
        if (modalidade) await api.atualizar(`/modalidades/${modalidade.id}`, dados);
        else await api.criar('/modalidades', dados);
        aviso('Modalidade salva.');
        await carregar();
      },
    });
  }

  async function excluirModalidade(modalidade) {
    if (!confirmar(`Excluir a modalidade ${modalidade.nome}?`)) return;
    try {
      await api.remover(`/modalidades/${modalidade.id}`);
      aviso('Modalidade removida.');
      await carregar();
    } catch (erro) {
      aviso(erro.message, 'erro');
    }
  }

  /** Faixas/graduacoes de uma modalidade, na ordem de evolucao. */
  async function gerenciarFaixas(modalidade) {
    const conteudo = el('div');
    abrirModal({ titulo: `Faixas de ${modalidade.nome}`, conteudo });

    async function desenhar() {
      const faixas = await api.obter(`/modalidades/${modalidade.id}/graduacoes`);
      conteudo.replaceChildren(
        faixas.length
          ? tabela(['Ordem', 'Faixa', ''], faixas.map((faixa) => [
            String(faixa.ordem),
            faixa.nome,
            celula([sessao.ehUm('dono', 'mestre')
              ? botao('Remover', async () => {
                await api.remover(`/modalidades/${modalidade.id}/graduacoes/${faixa.id}`);
                await desenhar();
              }, 'botao pequeno perigo')
              : null]),
          ]))
          : vazio('Nenhuma faixa cadastrada para esta modalidade.'),
        sessao.ehUm('dono', 'mestre')
          ? botao('+ Nova faixa', () => abrirFormulario({
            titulo: `Nova faixa de ${modalidade.nome}`,
            campos: [
              { nome: 'nome', rotulo: 'Nome da faixa', obrigatorio: true, placeholder: 'Branca, Azul, Preta...' },
              { nome: 'ordem', rotulo: 'Ordem', tipo: 'number', valor: 0, dica: 'Menor numero aparece primeiro.' },
            ],
            aoSalvar: async (dados) => {
              await api.criar(`/modalidades/${modalidade.id}/graduacoes`, dados);
              await desenhar();
              await carregar();
            },
          }), 'botao pequeno')
          : null,
      );
    }
    await desenhar();
  }

  // ---------- Turmas ----------

  function desenharTurmas(turmas) {
    areaTurmas.replaceChildren(tabela(
      ['Turma', 'Modalidade', 'Categoria', 'Nivel', 'Mestre', 'Horarios', 'Alunos', 'Acoes'],
      turmas.map((turma) => [
        celula([
          el('strong', { texto: turma.nome }),
          turma.ativo ? null : el('div', {}, [etiqueta('inativa', 'neutra')]),
          turma.local ? el('div', { classe: 'dica', texto: turma.local }) : null,
        ]),
        celula([etiqueta(turma.modalidade, 'info')]),
        turma.categoria,
        turma.nivel,
        turma.mestre || '-',
        celula([turma.horarios.length
          ? el('div', {}, turma.horarios.map((h) => el('div', {
            classe: 'dica', texto: `${DIAS_SEMANA[h.dia_semana]} ${h.hora_inicio}-${h.hora_fim}`,
          })))
          : el('span', { classe: 'dica', texto: 'sem horario' })]),
        `${turma.total_alunos}/${turma.capacidade}`,
        celula([
          botao('Horarios', () => gerenciarHorarios(turma), 'botao pequeno secundario'),
          podeEditar(turma) ? botao('Editar', () => formularioTurma(turma), 'botao pequeno secundario') : null,
          ehDono ? botao('Excluir', () => excluirTurma(turma), 'botao pequeno perigo') : null,
        ].filter(Boolean), 'acoes-celula'),
      ]),
      'Nenhuma turma cadastrada. Comece criando uma turma para cada modalidade.',
    ));
  }

  function podeEditar(turma) {
    return ehDono || (sessao.papel === 'mestre' && turma.mestre_id === sessao.usuario.id);
  }

  function formularioTurma(turma = null) {
    abrirFormulario({
      titulo: turma ? `Editar ${turma.nome}` : 'Nova turma',
      campos: [
        { nome: 'nome', rotulo: 'Nome da turma', obrigatorio: true, placeholder: 'Jiu-Jitsu Kids Tarde' },
        { nome: 'modalidade_id', rotulo: 'Modalidade', tipo: 'select', obrigatorio: true,
          opcoes: modalidades.map((m) => ({ valor: m.id, rotulo: m.nome })) },
        { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: [
          { valor: 'adulto', rotulo: 'Adulto' }, { valor: 'kids', rotulo: 'Kids' },
          { valor: 'misto', rotulo: 'Misto' }, { valor: 'feminino', rotulo: 'Feminino' }] },
        { nome: 'nivel', rotulo: 'Nivel', tipo: 'select', opcoes: [
          { valor: 'todos', rotulo: 'Todos os niveis' }, { valor: 'iniciante', rotulo: 'Iniciante' },
          { valor: 'intermediario', rotulo: 'Intermediario' }, { valor: 'avancado', rotulo: 'Avancado' }] },
        { nome: 'mestre_id', rotulo: 'Mestre responsavel', tipo: 'select',
          opcoes: [{ valor: '', rotulo: 'Sem mestre definido' }, ...mestres.map((m) => ({ valor: m.id, rotulo: m.nome }))] },
        { nome: 'capacidade', rotulo: 'Capacidade (vagas)', tipo: 'number', min: 1, valor: 30 },
        { nome: 'local', rotulo: 'Local / tatame', placeholder: 'Tatame principal' },
        { nome: 'idade_minima', rotulo: 'Idade minima', tipo: 'number', min: 0 },
        { nome: 'idade_maxima', rotulo: 'Idade maxima', tipo: 'number', min: 0 },
        { nome: 'ativo', rotulo: 'Turma ativa', tipo: 'checkbox', valor: 1 },
      ],
      valores: turma || { categoria: 'adulto', nivel: 'todos' },
      aoSalvar: async (dados) => {
        if (turma) await api.atualizar(`/turmas/${turma.id}`, dados);
        else await api.criar('/turmas', dados);
        aviso('Turma salva. Agora cadastre os horarios dela.');
        await carregar();
      },
    });
  }

  async function excluirTurma(turma) {
    if (!confirmar(`Excluir a turma ${turma.nome} com horarios e chamadas?`)) return;
    await api.remover(`/turmas/${turma.id}`);
    aviso('Turma removida.');
    await carregar();
  }

  /** Cadastro dos dias e horarios em que a turma treina. */
  async function gerenciarHorarios(turma) {
    const conteudo = el('div');
    abrirModal({ titulo: `Horarios de ${turma.nome}`, conteudo });

    async function desenhar() {
      const dados = await api.obter(`/turmas/${turma.id}`);
      conteudo.replaceChildren(
        dados.horarios.length
          ? tabela(['Dia', 'Inicio', 'Fim', ''], dados.horarios.map((h) => [
            DIAS_SEMANA[h.dia_semana], h.hora_inicio, h.hora_fim,
            celula([podeEditar(turma)
              ? botao('Remover', async () => {
                await api.remover(`/turmas/${turma.id}/horarios/${h.id}`);
                await desenhar();
                await carregar();
              }, 'botao pequeno perigo')
              : null]),
          ]))
          : vazio('Nenhum horario cadastrado para esta turma.'),
        podeEditar(turma)
          ? botao('+ Novo horario', () => abrirFormulario({
            titulo: 'Novo horario',
            campos: [
              { nome: 'dia_semana', rotulo: 'Dia da semana', tipo: 'select', obrigatorio: true,
                opcoes: DIAS_SEMANA.map((dia, indice) => ({ valor: indice, rotulo: dia })) },
              { nome: 'hora_inicio', rotulo: 'Inicio', tipo: 'time', obrigatorio: true, valor: '19:00' },
              { nome: 'hora_fim', rotulo: 'Fim', tipo: 'time', obrigatorio: true, valor: '20:00' },
            ],
            aoSalvar: async (valores) => {
              await api.criar(`/turmas/${turma.id}/horarios`, valores);
              await desenhar();
              await carregar();
            },
          }), 'botao pequeno')
          : null,
      );
    }
    await desenhar();
  }

  await carregar();

  return el('div', {}, [
    topo('Turmas e modalidades', 'Cadastre cada luta, as faixas, as turmas e os horarios',
      ehDono ? [
        botao('+ Modalidade', () => formularioModalidade(), 'botao secundario'),
        botao('+ Turma', () => formularioTurma()),
      ] : []),
    cartao('Modalidades', areaModalidades),
    cartao('Turmas', areaTurmas),
  ]);
}
