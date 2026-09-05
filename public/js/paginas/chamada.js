import { api, sessao } from '../api.js';
import {
  el, cartao, botao, etiqueta, etiquetaCor, aviso, vazio, hojeISO, dataBr,
  tabela, celula, abrirFormulario,
} from '../ui.js';
import { icone } from '../icones.js';
import { topo } from '../app.js';

/**
 * Chamada das aulas.
 *
 * É a tela que o mestre abre todo dia, então ela começa pelo trabalho: as
 * aulas de hoje que ainda não têm chamada. Na lista, cada nome vem com o
 * contexto que muda a conversa — quantas aulas seguidas faltou, há quanto
 * tempo não aparece e se a mensalidade está em ordem.
 */
export default async function paginaChamada() {
  const turmas = await api.obter('/turmas?ativo=1');
  // O mestre vê primeiro as turmas dele; se não tiver nenhuma, vê todas.
  const minhas = sessao.papel === 'mestre' ? turmas.filter((t) => t.mestre_id === sessao.usuario.id) : turmas;
  const disponiveis = minhas.length ? minhas : turmas;

  const estado = {
    turmaId: disponiveis[0]?.id ?? null,
    data: hojeISO(),
    marcacoes: new Map(),
    notas: new Map(),
    lista: null,
    salvando: false,
    sujo: false,
  };

  const areaPendentes = el('div');
  const area = el('div');
  const areaResumo = el('div');
  const areaRanking = el('div');
  const areaHistorico = el('div');
  const selo = el('span', { classe: 'estado-chamada' });

  /* ------------------------------------------------ aulas ainda sem chamada */

  async function carregarPendentes() {
    const { aulas, dia_nome: diaNome } = await api.obter('/presencas/pendentes');
    if (!aulas.length) {
      areaPendentes.replaceChildren();
      return;
    }
    areaPendentes.replaceChildren(cartao(
      `Aulas de ${diaNome.toLowerCase()} ainda sem chamada (${aulas.length})`,
      el('div', { classe: 'lista-aulas' }, aulas.map((aula) => el('button', {
        classe: `linha-aula ${aula.encerrada ? 'encerrada' : ''}`, type: 'button',
        estilo: `--cor-aula:${aula.modalidade_cor || 'var(--marca-1)'}`,
        aoClicar: () => {
          estado.turmaId = aula.turma_id;
          estado.data = hojeISO();
          seletorTurma.value = String(aula.turma_id);
          seletorData.value = estado.data;
          recarregar();
          area.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      }, [
        el('span', { classe: 'hora-aula' }, [
          el('strong', { texto: aula.hora_inicio }),
          el('span', { texto: aula.hora_fim }),
        ]),
        el('span', { classe: 'dados-aula' }, [
          el('strong', { texto: `${aula.modalidade} · ${aula.turma}` }),
          el('span', { classe: 'dica', texto: `${aula.matriculados} matriculado(s)`
            + (aula.ja_fizeram_checkin ? ` · ${aula.ja_fizeram_checkin} já fez check-in` : '') }),
        ]),
        aula.encerrada ? etiqueta('já terminou', 'alerta') : etiqueta('ainda vai rolar', 'neutra'),
      ]))),
    ));
  }

  /* ------------------------------------------------------- lista de chamada */

  async function recarregar() {
    if (!estado.turmaId) {
      area.replaceChildren(vazio('Cadastre uma turma ativa antes de fazer a chamada.'));
      return;
    }
    area.replaceChildren(el('div', { classe: 'carregando', texto: 'Carregando lista...' }));
    estado.lista = await api.obter(`/presencas?turma_id=${estado.turmaId}&data=${estado.data}`);
    estado.marcacoes = new Map(estado.lista.alunos.map((a) => [a.id, a.presente === -1 ? null : Number(a.presente)]));
    estado.notas = new Map(estado.lista.alunos.map((a) => [a.id, a.observacao || '']));
    estado.sujo = false;
    marcarEstado(estado.lista.ja_registrada ? 'Chamada já registrada' : 'Sem chamada ainda');
    desenhar();
    desenharHistorico();
  }

  function marcarEstado(texto, tipo = '') {
    selo.className = `estado-chamada ${tipo}`;
    selo.textContent = texto;
  }

  function desenhar() {
    const dados = estado.lista;
    if (!dados) return;
    if (!dados.alunos.length) {
      area.replaceChildren(vazio('Nenhum aluno vinculado a esta turma. Inclua alunos pela ficha do aluno.'));
      return;
    }

    const linhas = dados.alunos.map((aluno) => {
      const marcado = estado.marcacoes.get(aluno.id);
      return [
        celula([
          el('strong', { texto: aluno.nome }),
          el('div', { classe: 'dica', texto: sinaisDoAluno(aluno) }),
        ]),
        celula(alertasDoAluno(aluno, marcado)),
        celula([
          botao('Presente', () => alternar(aluno.id, 1), `botao pequeno ${marcado === 1 ? '' : 'secundario'}`),
          botao('Falta', () => alternar(aluno.id, 0), `botao pequeno ${marcado === 0 ? 'perigo' : 'secundario'}`),
          marcado === 0
            ? botao(estado.notas.get(aluno.id) ? 'Motivo ✓' : 'Motivo',
              () => justificar(aluno), 'botao pequeno secundario')
            : null,
        ].filter(Boolean), 'acoes-celula'),
      ];
    });

    const total = dados.alunos.length;
    const presentes = [...estado.marcacoes.values()].filter((v) => v === 1).length;
    const faltas = [...estado.marcacoes.values()].filter((v) => v === 0).length;
    const semMarcar = total - presentes - faltas;

    area.replaceChildren(el('div', {}, [
      el('div', { classe: 'cabecalho-chamada' }, [
        el('div', {}, [
          el('strong', { texto: `${dados.turma.modalidade} · ${dados.turma.nome}` }),
          el('div', { classe: 'dica', texto: `${dados.dia_nome}, ${dataBr(dados.data)}`
            + (dados.aulas.length
              ? ` · ${dados.aulas.map((a) => `${a.hora_inicio}${a.rotulo ? ` ${a.rotulo}` : ''}`).join(' e ')}`
              : ' · sem aula marcada neste dia') }),
        ]),
        el('div', { classe: 'placar-chamada' }, [
          el('span', { classe: 'presentes', texto: `${presentes} presente(s)` }),
          el('span', { classe: 'faltas', texto: `${faltas} falta(s)` }),
          semMarcar ? el('span', { classe: 'dica', texto: `${semMarcar} sem marcar` }) : null,
        ].filter(Boolean)),
      ]),

      el('div', { classe: 'tabela-texto' }, [tabela(['Aluno', 'Atenção', 'Marcar'], linhas)]),

      el('div', { classe: 'acoes', estilo: 'margin-top:1rem' }, [
        botao('Todos presentes', () => {
          for (const aluno of dados.alunos) estado.marcacoes.set(aluno.id, 1);
          desenhar();
          salvar();
        }, 'botao secundario'),
        botao('Quem não marcou virou falta', () => {
          for (const aluno of dados.alunos) {
            if (estado.marcacoes.get(aluno.id) === null) estado.marcacoes.set(aluno.id, 0);
          }
          desenhar();
          salvar();
        }, 'botao secundario'),
        botao('Limpar', () => {
          for (const aluno of dados.alunos) estado.marcacoes.set(aluno.id, null);
          desenhar();
          salvar();
        }, 'botao secundario'),
      ]),
    ]));
  }

  /** A linha de apoio embaixo do nome: frequência e última vez que apareceu. */
  function sinaisDoAluno(aluno) {
    const partes = [aluno.categoria];
    partes.push(`${aluno.presencas_30d} treino(s) em 30 dias`);
    if (aluno.dias_sem_treinar !== null) {
      partes.push(aluno.dias_sem_treinar === 0 ? 'treinou hoje' : `há ${aluno.dias_sem_treinar} dia(s) sem treinar`);
    } else {
      partes.push('nunca fez check-in');
    }
    return partes.join(' · ');
  }

  /** Só o que muda a conversa com o aluno na hora da chamada. */
  function alertasDoAluno(aluno, marcado) {
    const sinais = [];
    if (aluno.faltas_seguidas >= 2) {
      sinais.push(etiqueta(`${aluno.faltas_seguidas} faltas seguidas`, aluno.faltas_seguidas >= 3 ? 'erro' : 'alerta'));
    }
    if (aluno.pagamento === 'atrasado') {
      sinais.push(etiqueta(aluno.pagamento_bloqueia ? 'atrasado · bloqueado' : 'mensalidade atrasada', 'erro'));
    }
    if (aluno.status !== 'ativo') sinais.push(etiqueta(aluno.status, 'alerta'));
    if (marcado === 1 && aluno.origem === 'checkin') sinais.push(etiqueta('check-in do aluno', 'ok'));
    if (marcado === 0 && estado.notas.get(aluno.id)) {
      sinais.push(el('span', { classe: 'dica', texto: estado.notas.get(aluno.id) }));
    }
    return sinais.length ? sinais : [el('span', { classe: 'dica', texto: '—' })];
  }

  function justificar(aluno) {
    abrirFormulario({
      titulo: `Motivo da falta de ${aluno.nome}`,
      aviso: 'Fica registrado na chamada. Serve para lesão, viagem, prova na escola.',
      campos: [{ nome: 'observacao', rotulo: 'Motivo', tipo: 'textarea' }],
      valores: { observacao: estado.notas.get(aluno.id) || '' },
      aoSalvar: async (dados) => {
        estado.notas.set(aluno.id, dados.observacao || '');
        desenhar();
        await salvar();
      },
    });
  }

  function alternar(alunoId, valor) {
    const atual = estado.marcacoes.get(alunoId);
    estado.marcacoes.set(alunoId, atual === valor ? null : valor);
    if (estado.marcacoes.get(alunoId) !== 0) estado.notas.set(alunoId, '');
    desenhar();
    salvar();
  }

  /* --------------------------------------------------- gravação automática */

  let aguardando = null;

  /** Salva sozinho, com um respiro para agrupar cliques seguidos. */
  function salvar() {
    estado.sujo = true;
    marcarEstado('Salvando...', 'salvando');
    clearTimeout(aguardando);
    aguardando = setTimeout(gravar, 600);
  }

  async function gravar() {
    if (!estado.lista) return;
    const presencas = [...estado.marcacoes.entries()].map(([alunoId, presente]) => ({
      aluno_id: alunoId,
      presente,
      observacao: presente === 0 ? (estado.notas.get(alunoId) || null) : null,
    }));
    try {
      await api.criar('/presencas', { turma_id: estado.turmaId, data: estado.data, presencas });
      estado.sujo = false;
      marcarEstado('Salvo', 'salvo');
      await Promise.all([carregarResumo(), carregarRanking(), carregarPendentes()]);
      desenharHistorico();
    } catch (erro) {
      marcarEstado('Não salvou', 'erro');
      aviso(erro.message || 'Não foi possível salvar a chamada.', 'erro');
    }
  }

  /* -------------------------------------------------------------- apoio */

  function desenharHistorico() {
    const historico = estado.lista?.historico || [];
    if (!historico.length) {
      areaHistorico.replaceChildren(vazio('Esta turma ainda não tem chamada registrada.'));
      return;
    }
    const maior = Math.max(1, ...historico.map((h) => h.presentes + h.faltas));
    areaHistorico.replaceChildren(el('div', {
      classe: 'pulso-semana pulso-historico',
      estilo: `grid-template-columns:repeat(${historico.length}, 1fr)`,
    },
      historico.map((h) => el('div', { classe: 'coluna-pulso' }, [
        el('span', { classe: 'valor-pulso', texto: String(h.presentes) }),
        el('span', {
          classe: 'barra-pulso',
          estilo: `height:${Math.max(4, (h.presentes / maior) * 100)}%`,
          title: `${h.presentes} presente(s) e ${h.faltas} falta(s) em ${dataBr(h.data)}`,
        }),
        el('span', { classe: 'dia-pulso', texto: dataBr(h.data).slice(0, 5) }),
      ]))));
  }

  async function carregarRanking() {
    const { ranking } = await api.obter('/presencas/ranking');
    areaRanking.replaceChildren(ranking.length
      ? el('div', { classe: 'tabela-texto' }, [tabela(['#', 'Aluno', 'Presenças'],
        ranking.map((linha, indice) => [
          celula([indice < 3 ? etiqueta(`${indice + 1}º`, 'bom') : String(indice + 1)]),
          celula([
            el('strong', { texto: linha.nome }),
            el('div', { classe: 'dica', texto: linha.categoria }),
          ]),
          String(linha.presencas),
        ]))])
      : vazio('Ainda não há presenças registradas neste mês.'));
  }

  async function carregarResumo() {
    const { turmas: resumo, periodo } = await api.obter('/presencas/resumo');
    areaResumo.replaceChildren(resumo.length
      ? el('div', { classe: 'tabela-texto' }, [tabela(['Turma', 'Aulas', 'Presenças', 'Frequência'],
        resumo.map((linha) => [
          celula([
            el('strong', { texto: linha.turma }),
            el('div', {}, [etiquetaCor(linha.modalidade, linha.modalidade_cor)]),
          ]),
          String(linha.aulas),
          `${linha.presencas} · ${linha.faltas} falta(s)`,
          celula([linha.aproveitamento === null
            ? el('span', { classe: 'dica', texto: '—' })
            : etiqueta(`${linha.aproveitamento}%`, linha.aproveitamento >= 60 ? 'ok' : 'alerta')]),
        ]))])
      : vazio(`Nenhuma chamada registrada entre ${dataBr(periodo.de)} e ${dataBr(periodo.ate)}.`));
  }

  const seletorTurma = el('select', {
    aoMudar: (evento) => { estado.turmaId = Number(evento.target.value); recarregar(); },
  }, disponiveis.map((t) => el('option', { value: t.id, texto: `${t.modalidade} · ${t.nome}` })));

  const seletorData = el('input', {
    type: 'date', value: estado.data,
    aoMudar: (evento) => { estado.data = evento.target.value || hojeISO(); recarregar(); },
  });

  function andarNaData(dias) {
    const d = new Date(`${estado.data}T12:00:00`);
    d.setDate(d.getDate() + dias);
    estado.data = d.toLocaleDateString('sv-SE');
    seletorData.value = estado.data;
    recarregar();
  }

  await Promise.all([recarregar(), carregarResumo(), carregarRanking(), carregarPendentes()]);

  return el('div', {}, [
    topo('Chamada', 'Registre presenças e faltas de cada aula'),
    el('p', { classe: 'explicacao' }, [
      icone('chamada', 16),
      'O check-in que o aluno faz no celular já entra aqui sozinho — normalmente você só confirma quem faltou. '
      + 'A chamada salva sozinha a cada marcação, e cada nome mostra quantas aulas seguidas a pessoa faltou.',
    ]),

    areaPendentes,

    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [el('label', { texto: 'Turma' }), seletorTurma]),
      el('div', { classe: 'campo' }, [el('label', { texto: 'Data da aula' }), seletorData]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Navegar' }),
        el('div', { classe: 'acoes' }, [
          botao('◀ Anterior', () => andarNaData(-1), 'botao pequeno secundario'),
          botao('Hoje', () => { estado.data = hojeISO(); seletorData.value = estado.data; recarregar(); },
            'botao pequeno secundario'),
          botao('Seguinte ▶', () => andarNaData(1), 'botao pequeno secundario'),
        ]),
      ]),
    ]),

    cartao('Lista de presença', area, selo),

    el('div', { classe: 'grade col-2' }, [
      cartao('Últimas aulas desta turma', areaHistorico),
      cartao('Ranking de presença do mês', areaRanking),
    ]),
    cartao('Frequência por turma no mês', areaResumo),
  ]);
}
