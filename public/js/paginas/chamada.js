import { api, sessao } from '../api.js';
import { el, cartao, botao, etiqueta, aviso, vazio, hojeISO, dataBr, tabela, celula } from '../ui.js';
import { topo } from '../app.js';

/** Chamada das aulas: marca presenca e falta de cada aluno da turma. */
export default async function paginaChamada() {
  const turmas = await api.obter('/turmas?ativo=1');
  // O mestre ve primeiro as turmas dele; se nao tiver nenhuma, ve todas.
  const minhas = sessao.papel === 'mestre' ? turmas.filter((t) => t.mestre_id === sessao.usuario.id) : turmas;
  const disponiveis = minhas.length ? minhas : turmas;

  const estado = { turmaId: disponiveis[0]?.id ?? null, data: hojeISO(), marcacoes: new Map(), lista: null };
  const area = el('div');
  const areaResumo = el('div');
  const areaRanking = el('div');

  async function recarregar() {
    if (!estado.turmaId) {
      area.replaceChildren(vazio('Cadastre uma turma ativa antes de fazer a chamada.'));
      return;
    }
    area.replaceChildren(el('div', { classe: 'carregando', texto: 'Carregando lista...' }));
    estado.lista = await api.obter(`/presencas?turma_id=${estado.turmaId}&data=${estado.data}`);
    estado.marcacoes = new Map(estado.lista.alunos.map((a) => [a.id, a.presente === -1 ? null : Number(a.presente)]));
    desenhar();
  }

  function desenhar() {
    const dados = estado.lista;
    if (!dados) return;
    if (!dados.alunos.length) {
      area.replaceChildren(vazio('Nenhum aluno vinculado a esta turma. Inclua alunos pela ficha do aluno.'));
      return;
    }

    const linhas = dados.alunos.map((matriculado) => {
      const marcado = estado.marcacoes.get(matriculado.id);
      return [
        celula([
          el('strong', { texto: matriculado.nome }),
          matriculado.status !== 'ativo' ? el('div', {}, [etiqueta(matriculado.status, 'alerta')]) : null,
        ]),
        matriculado.categoria,
        celula([marcado === null
          ? etiqueta('sem marcacao', 'neutra')
          : marcado ? etiqueta('presente', 'ok') : etiqueta('falta', 'erro')]),
        celula([
          botao('Presente', () => alternar(matriculado.id, 1), `botao pequeno ${marcado === 1 ? '' : 'secundario'}`),
          botao('Falta', () => alternar(matriculado.id, 0), `botao pequeno ${marcado === 0 ? 'perigo' : 'secundario'}`),
        ], 'acoes-celula'),
      ];
    });

    const total = dados.alunos.length;
    const presentes = [...estado.marcacoes.values()].filter((v) => v === 1).length;

    area.replaceChildren(el('div', {}, [
      el('p', { classe: 'dica', texto: `${dados.turma.modalidade} · ${dados.turma.nome} · ${dataBr(dados.data)} · ${presentes}/${total} presentes` }),
      tabela(['Aluno', 'Categoria', 'Situacao', 'Marcar'], linhas),
      el('div', { classe: 'acoes', estilo: 'margin-top:1rem' }, [
        botao('Marcar todos presentes', () => {
          for (const matriculado of dados.alunos) estado.marcacoes.set(matriculado.id, 1);
          desenhar();
        }, 'botao secundario'),
        botao('Limpar marcacoes', () => {
          for (const matriculado of dados.alunos) estado.marcacoes.set(matriculado.id, null);
          desenhar();
        }, 'botao secundario'),
        botao('Salvar chamada', salvar),
      ]),
    ]));
  }

  function alternar(alunoId, valor) {
    const atual = estado.marcacoes.get(alunoId);
    estado.marcacoes.set(alunoId, atual === valor ? null : valor);
    desenhar();
  }

  async function salvar() {
    const presencas = [...estado.marcacoes.entries()]
      .filter(([, valor]) => valor !== null)
      .map(([aluno_id, presente]) => ({ aluno_id, presente }));
    if (!presencas.length) return aviso('Marque pelo menos um aluno.', 'erro');
    await api.criar('/presencas', { turma_id: estado.turmaId, data: estado.data, presencas });
    aviso('Chamada salva.');
    await carregarResumo();
    await carregarRanking();
  }

  async function carregarRanking() {
    const { ranking } = await api.obter('/presencas/ranking');
    areaRanking.replaceChildren(ranking.length
      ? tabela(['#', 'Aluno', 'Categoria', 'Presencas'], ranking.map((linha, indice) => [
        celula([indice < 3 ? etiqueta(['1o', '2o', '3o'][indice], 'bom') : String(indice + 1)]),
        linha.nome,
        linha.categoria,
        String(linha.presencas),
      ]))
      : vazio('Ainda nao ha presencas registradas neste mes.', '\u{1F3C6}'));
  }

  async function carregarResumo() {
    const { turmas: resumo, periodo } = await api.obter('/presencas/resumo');
    areaResumo.replaceChildren(resumo.length
      ? tabela(['Turma', 'Modalidade', 'Aulas', 'Presencas', 'Faltas', 'Frequencia'],
        resumo.map((linha) => [
          linha.turma, linha.modalidade, String(linha.aulas), String(linha.presencas), String(linha.faltas),
          celula([etiqueta(
            `${Math.round((linha.presencas / Math.max(1, linha.presencas + linha.faltas)) * 100)}%`,
            linha.presencas >= linha.faltas ? 'ok' : 'alerta',
          )]),
        ]))
      : vazio(`Nenhuma chamada registrada entre ${dataBr(periodo.de)} e ${dataBr(periodo.ate)}.`));
  }

  const seletorTurma = el('select', {
    aoMudar: (evento) => { estado.turmaId = Number(evento.target.value); recarregar(); },
  }, disponiveis.map((t) => el('option', { value: t.id, texto: `${t.modalidade} · ${t.nome}` })));

  const seletorData = el('input', {
    type: 'date', value: estado.data,
    aoMudar: (evento) => { estado.data = evento.target.value || hojeISO(); recarregar(); },
  });

  await recarregar();
  await carregarResumo();
  await carregarRanking();

  return el('div', {}, [
    topo('Chamada', 'Registre presencas e faltas de cada aula'),
    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [el('label', { texto: 'Turma' }), seletorTurma]),
      el('div', { classe: 'campo' }, [el('label', { texto: 'Data da aula' }), seletorData]),
    ]),
    cartao('Lista de presenca', area),
    el('div', { classe: 'grade col-2' }, [
      cartao('Frequencia por turma no mes', areaResumo),
      cartao('Ranking de presenca do mes', areaRanking),
    ]),
  ]);
}
