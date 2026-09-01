import { api, sessao } from '../api.js';
import { el, cartao, DIAS_SEMANA, vazio, etiqueta } from '../ui.js';
import { topo } from '../app.js';

/** Grade semanal de aulas, com filtros por modalidade e categoria. */
export default async function paginaGrade() {
  const [{ aulas }, modalidades] = await Promise.all([
    api.obter('/turmas/grade'),
    api.obter('/modalidades'),
  ]);

  const filtros = { modalidade: '', categoria: '' };
  const area = el('div');

  function desenhar() {
    const filtradas = aulas.filter((aula) => (
      (!filtros.modalidade || aula.modalidade === filtros.modalidade)
      && (!filtros.categoria || aula.categoria === filtros.categoria)
    ));
    area.replaceChildren(
      filtradas.length
        ? el('div', { classe: 'tabela-rolagem' }, [
          el('div', { classe: 'grade-semana' }, DIAS_SEMANA.map((dia, indice) => colunaDoDia(dia, indice, filtradas))),
        ])
        : vazio('Nenhuma aula com esses filtros.'),
    );
  }

  const seletorModalidade = el('select', {
    aoMudar: (evento) => { filtros.modalidade = evento.target.value; desenhar(); },
  }, [el('option', { value: '', texto: 'Todas as modalidades' }),
    ...modalidades.map((m) => el('option', { value: m.nome, texto: m.nome }))]);

  const seletorCategoria = el('select', {
    aoMudar: (evento) => { filtros.categoria = evento.target.value; desenhar(); },
  }, [
    el('option', { value: '', texto: 'Todas as categorias' }),
    ...['kids', 'adulto', 'misto', 'feminino'].map((c) => el('option', { value: c, texto: c })),
  ]);

  desenhar();

  return el('div', {}, [
    topo('Horarios das aulas', 'Grade semanal completa da academia'),
    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [el('label', { texto: 'Modalidade' }), seletorModalidade]),
      el('div', { classe: 'campo' }, [el('label', { texto: 'Categoria' }), seletorCategoria]),
      sessao.ehUm('dono')
        ? el('span', { classe: 'dica', texto: 'Para criar ou mudar horarios use a aba Turmas e modalidades.' })
        : null,
    ]),
    cartao(null, area),
  ]);
}

function colunaDoDia(dia, indice, aulas) {
  const hoje = new Date().getDay();
  const doDia = aulas.filter((aula) => aula.dia_semana === indice);
  return el('div', { classe: `coluna-dia ${indice === hoje ? 'hoje' : ''}` }, [
    el('h4', { texto: `${dia}${indice === hoje ? ' (hoje)' : ''}` }),
    doDia.length
      ? el('div', {}, doDia.map((aula) => el('div', {
        classe: 'aula',
        estilo: `border-left-color:${aula.modalidade_cor || '#e03131'}`,
      }, [
        el('div', { classe: 'hora', texto: `${aula.hora_inicio} - ${aula.hora_fim}` }),
        el('div', { classe: 'turma', texto: aula.modalidade }),
        el('div', { classe: 'info', texto: aula.turma }),
        el('div', { classe: 'info' }, [etiqueta(aula.categoria, 'neutra')]),
        aula.mestre ? el('div', { classe: 'info', texto: `Mestre: ${aula.mestre}` }) : null,
        aula.local ? el('div', { classe: 'info', texto: aula.local }) : null,
        el('div', { classe: 'info', texto: `${aula.total_alunos}/${aula.capacidade} alunos` }),
      ])))
      : el('div', { classe: 'info dica', texto: 'Sem aulas' }),
  ]);
}
