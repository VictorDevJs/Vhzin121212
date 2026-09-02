import { api, sessao } from '../api.js';
import {
  el, cartao, botao, etiqueta, vazio, esqueleto, abrirFormulario, aviso, confirmar, DIAS_SEMANA,
} from '../ui.js';
import { topo } from '../app.js';

const ABERTURA_PADRAO = 6 * 60;   // 06:00
const FECHAMENTO_PADRAO = 22 * 60; // 22:00

const CATEGORIAS = [
  { valor: 'adulto', rotulo: 'Adulto' }, { valor: 'kids', rotulo: 'Kids' },
  { valor: 'misto', rotulo: 'Misto' }, { valor: 'feminino', rotulo: 'Feminino' },
];

function minutos(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

function relogio(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Agenda da semana.
 * O dono monta a grade aqui mesmo: clica num espaço vazio para criar a aula,
 * clica num bloco para editar. Cada horário pode ter rótulo próprio - é assim
 * que No-Gi às 19h e Gi às 20h convivem na mesma turma.
 */
export default async function paginaGrade() {
  const podeEditar = sessao.ehUm('dono', 'mestre');
  const [modalidades, turmas, mestres] = await Promise.all([
    api.obter('/modalidades'),
    api.obter('/turmas'),
    sessao.papel === 'aluno' ? Promise.resolve([]) : api.obter('/usuarios/mestres'),
  ]);

  const filtro = { modalidade: '', categoria: '' };
  const area = el('div');
  let aulas = [];

  async function carregar() {
    area.replaceChildren(esqueleto(1, 420));
    const dados = await api.obter('/turmas/grade');
    aulas = dados.aulas;
    desenhar();
  }

  function visiveis() {
    return aulas.filter((aula) => (
      (!filtro.modalidade || aula.modalidade === filtro.modalidade)
      && (!filtro.categoria || aula.categoria === filtro.categoria)
    ));
  }

  function desenhar() {
    const lista = visiveis();
    if (!lista.length) {
      area.replaceChildren(vazio(podeEditar
        ? 'Nenhuma aula nesta seleção. Clique em "Nova aula" para começar a montar a grade.'
        : 'Nenhuma aula com esses filtros.'));
      return;
    }
    area.replaceChildren(el('div', {}, [
      legendaModalidades(lista),
      el('div', { classe: 'rolagem' }, [montarAgenda(lista)]),
      podeEditar
        ? el('p', { classe: 'dica', estilo: 'margin-top:.75rem' },
          ['Clique em um espaço livre para criar uma aula naquele dia e horário, ou em um bloco para editar.'])
        : null,
    ]));
  }

  function legendaModalidades(lista) {
    const usadas = new Map();
    for (const aula of lista) usadas.set(aula.modalidade, aula.modalidade_cor || 'var(--marca-1)');
    return el('div', { classe: 'legenda-agenda' }, [...usadas.entries()].map(([nome, cor]) => el('span', {
      classe: 'chave',
    }, [el('span', { classe: 'quadro', estilo: `background:${cor}` }), nome])));
  }

  /* ------------------------------------------------------ desenho da agenda */

  function montarAgenda(lista) {
    const inicioDia = Math.min(ABERTURA_PADRAO, ...lista.map((a) => minutos(a.hora_inicio)));
    const fimDia = Math.max(FECHAMENTO_PADRAO, ...lista.map((a) => minutos(a.hora_fim)));
    const primeiraHora = Math.floor(inicioDia / 60);
    const ultimaHora = Math.ceil(fimDia / 60);
    const totalHoras = ultimaHora - primeiraHora;
    const alturaHora = 62;
    const alturaPista = totalHoras * alturaHora;
    const posicao = (min) => ((min - primeiraHora * 60) / 60) * alturaHora;

    const eixo = el('div', { classe: 'agenda-coluna' }, [
      el('div', { classe: 'agenda-cabecalho', texto: 'Hora' }),
      el('div', {}, Array.from({ length: totalHoras }, (_, i) => el('div', {
        classe: 'agenda-marca-hora', texto: relogio((primeiraHora + i) * 60),
      }))),
    ]);

    const hoje = new Date().getDay();
    const agora = new Date().getHours() * 60 + new Date().getMinutes();

    const colunas = DIAS_SEMANA.map((dia, indice) => {
      const doDia = lista.filter((aula) => aula.dia_semana === indice)
        .sort((a, b) => minutos(a.hora_inicio) - minutos(b.hora_inicio));
      const pista = el('div', { classe: 'agenda-pista', estilo: `height:${alturaPista}px` }, [
        ...Array.from({ length: totalHoras * 2 }, (_, i) => el('div', {
          classe: `agenda-linha ${i % 2 === 0 ? 'meia' : ''}`,
          estilo: `height:${alturaHora / 2}px`,
        })),
      ]);

      // Camada para criar aula clicando no espaço livre
      if (podeEditar) {
        const camada = el('button', {
          classe: 'agenda-vazio', type: 'button', 'aria-label': `Criar aula na ${dia}`,
          aoClicar: (evento) => {
            const caixa = camada.getBoundingClientRect();
            const minutoBruto = primeiraHora * 60 + ((evento.clientY - caixa.top) / alturaHora) * 60;
            const arredondado = Math.max(primeiraHora * 60, Math.round(minutoBruto / 30) * 30);
            formularioAula(null, { dia_semana: indice, hora_inicio: relogio(arredondado), hora_fim: relogio(arredondado + 60) });
          },
        });
        pista.append(camada);
      }

      for (const [ordem, aula] of distribuir(doDia).entries()) {
        void ordem;
        pista.append(blocoDaAula(aula, posicao));
      }

      if (indice === hoje && agora >= primeiraHora * 60 && agora <= ultimaHora * 60) {
        pista.append(el('div', { classe: 'agenda-agora', estilo: `top:${posicao(agora)}px` }));
      }

      return el('div', { classe: `agenda-coluna ${indice === hoje ? 'hoje' : ''}` }, [
        el('div', { classe: 'agenda-cabecalho' }, [dia, indice === hoje ? etiqueta('hoje', 'marca') : null]),
        pista,
      ]);
    });

    return el('div', { classe: 'agenda', estilo: `--altura-hora:${alturaHora}px` }, [eixo, ...colunas]);
  }

  /** Aulas que se sobrepõem dividem a largura da coluna. */
  function distribuir(doDia) {
    const grupos = [];
    for (const aula of doDia) {
      const inicio = minutos(aula.hora_inicio);
      const fim = minutos(aula.hora_fim);
      const grupo = grupos.find((g) => g.some((outra) => (
        inicio < minutos(outra.hora_fim) && fim > minutos(outra.hora_inicio)
      )));
      if (grupo) grupo.push(aula);
      else grupos.push([aula]);
    }
    for (const grupo of grupos) {
      grupo.forEach((aula, indice) => {
        aula.__colunas = grupo.length;
        aula.__coluna = indice;
      });
    }
    return doDia;
  }

  function blocoDaAula(aula, posicao) {
    const inicio = minutos(aula.hora_inicio);
    const fim = minutos(aula.hora_fim);
    const duracao = fim - inicio;
    const colunas = aula.__colunas || 1;
    const largura = 100 / colunas;
    const esquerda = largura * (aula.__coluna || 0);
    const altura = Math.max(34, posicao(fim) - posicao(inicio) - 3);

    // O bloco mostra só o que cabe: quanto menor a aula, menos linhas.
    const estreito = colunas > 1;
    const baixo = duracao < 75;
    const classes = ['agenda-bloco', estreito ? 'estreito' : '', baixo ? 'baixo' : ''].filter(Boolean).join(' ');

    return el('button', {
      classe: classes, type: 'button',
      estilo: `top:${posicao(inicio)}px;height:${altura}px;`
        + `left:calc(${esquerda}% + 3px);width:calc(${largura}% - 6px);`
        + `--cor-aula:${aula.modalidade_cor || 'var(--marca-1)'}`,
      title: `${aula.hora_inicio} às ${aula.hora_fim} · ${aula.modalidade}`
        + `${aula.rotulo ? ` (${aula.rotulo})` : ''} · ${aula.turma}${aula.mestre ? ` · ${aula.mestre}` : ''}`,
      aoClicar: () => (podeEditar ? formularioAula(aula) : detalhesDaAula(aula)),
    }, [
      el('div', { classe: 'b-hora', texto: estreito ? aula.hora_inicio : `${aula.hora_inicio}–${aula.hora_fim}` }),
      el('div', { classe: 'b-titulo', texto: aula.modalidade }),
      aula.rotulo ? el('span', { classe: 'b-rotulo', texto: aula.rotulo }) : null,
      estreito || baixo ? null : el('div', { classe: 'b-info', texto: aula.turma }),
      estreito || baixo || !aula.mestre ? null : el('div', { classe: 'b-info', texto: aula.mestre }),
    ]);
  }

  function detalhesDaAula(aula) {
    aviso(`${aula.modalidade}${aula.rotulo ? ` · ${aula.rotulo}` : ''} — ${aula.turma}, `
      + `${aula.hora_inicio} às ${aula.hora_fim}${aula.mestre ? `, com ${aula.mestre}` : ''}.`);
  }

  /* ------------------------------------------------------------ edição */

  function formularioAula(aula = null, sugestao = {}) {
    const turmasAtivas = turmas.filter((t) => t.ativo);
    if (!turmasAtivas.length) {
      return aviso('Cadastre uma turma antes de montar a grade.', 'erro');
    }

    abrirFormulario({
      titulo: aula ? 'Editar aula da grade' : 'Nova aula na grade',
      aviso: 'O rótulo separa variações no mesmo horário — por exemplo No-Gi às 19h e Gi às 20h.',
      campos: [
        { nome: 'turma_id', rotulo: 'Turma', tipo: 'select', obrigatorio: true,
          opcoes: turmasAtivas.map((t) => ({ valor: t.id, rotulo: `${t.modalidade} · ${t.nome}` })) },
        { nome: 'rotulo', rotulo: 'Rótulo do horário', placeholder: 'No-Gi, Gi, Iniciantes, Competição…' },
        { nome: 'dia_semana', rotulo: 'Dia da semana', tipo: 'select',
          opcoes: DIAS_SEMANA.map((dia, indice) => ({ valor: indice, rotulo: dia })) },
        { nome: 'hora_inicio', rotulo: 'Começa às', tipo: 'time', obrigatorio: true },
        { nome: 'hora_fim', rotulo: 'Termina às', tipo: 'time', obrigatorio: true },
        { nome: 'observacao', rotulo: 'Observação', placeholder: 'Traga protetor bucal, aula aberta…' },
      ],
      valores: aula
        ? { ...aula, turma_id: aula.turma_id }
        : { hora_inicio: '19:00', hora_fim: '20:00', ...sugestao, turma_id: turmasAtivas[0].id },
      aoSalvar: async (dados) => {
        if (aula) {
          // Mudou de turma: recria o horário na turma nova.
          if (Number(dados.turma_id) !== aula.turma_id) {
            await api.criar(`/turmas/${dados.turma_id}/horarios`, dados);
            await api.remover(`/turmas/${aula.turma_id}/horarios/${aula.horario_id}`);
          } else {
            await api.atualizar(`/turmas/${aula.turma_id}/horarios/${aula.horario_id}`, dados);
          }
          aviso('Aula atualizada na grade.');
        } else {
          await api.criar(`/turmas/${dados.turma_id}/horarios`, dados);
          aviso('Aula incluída na grade.');
        }
        await carregar();
      },
      extras: aula
        ? [botao('Remover da grade', async () => {
          if (!confirmar(`Remover ${aula.modalidade} de ${DIAS_SEMANA[aula.dia_semana]} às ${aula.hora_inicio}?`)) return;
          await api.remover(`/turmas/${aula.turma_id}/horarios/${aula.horario_id}`);
          aviso('Aula removida da grade.');
          await carregar();
          document.querySelector('.fundo-modal')?.remove();
        }, 'botao perigo')]
        : [],
    });
  }

  await carregar();

  return el('div', {}, [
    topo('Grade da semana',
      podeEditar
        ? 'Monte a agenda da academia: clique num espaço livre para criar a aula e num bloco para editar.'
        : 'Agenda completa das aulas da semana',
      podeEditar ? [botao('+ Nova aula', () => formularioAula())] : []),

    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Modalidade' }),
        el('select', { aoMudar: (evento) => { filtro.modalidade = evento.target.value; desenhar(); } }, [
          el('option', { value: '', texto: 'Todas as modalidades' }),
          ...modalidades.map((m) => el('option', { value: m.nome, texto: m.nome })),
        ]),
      ]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Categoria' }),
        el('select', { aoMudar: (evento) => { filtro.categoria = evento.target.value; desenhar(); } }, [
          el('option', { value: '', texto: 'Todas as categorias' }),
          ...CATEGORIAS.map((c) => el('option', { value: c.valor, texto: c.rotulo })),
        ]),
      ]),
      mestres.length
        ? el('span', { classe: 'dica', texto: `${mestres.length} professor(es) na equipe` })
        : null,
    ]),

    cartao(null, area),
  ]);
}
