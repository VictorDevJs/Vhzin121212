import { api, sessao } from '../api.js';
import { el, moeda, dataBr, DIAS_SEMANA, hojeISO } from '../ui.js';
import { iniciar, irPara } from '../app.js';

const ROTULO_PERIODICIDADE = { mensal: 'por mes', trimestral: 'por trimestre', semestral: 'por semestre', anual: 'por ano' };
const ROTULO_TIPO_AVISO = {
  geral: 'Aviso', campeonato: 'Campeonato', evento: 'Evento',
  cancelamento: 'Sem aula', manutencao: 'Manutencao', graduacao: 'Graduacao',
};

/** Vitrine da academia + area de login e cadastro do aluno. */
export default async function paginaPublica() {
  const dados = await api.obter('/publico/academia');
  const { academia, modalidades, grade, planos, avisos, numeros } = dados;

  return el('div', { classe: 'publico' }, [
    el('section', { classe: 'heroi' }, [
      el('div', {}, [
        el('h1', {}, [academia.nome, ' ', el('span', { classe: 'destaque', texto: '🥋' })]),
        el('p', { classe: 'chamada', texto: academia.sobre || 'Treine com a gente.' }),
        el('div', { classe: 'numeros' }, [
          bloco(numeros.alunos_ativos, 'alunos ativos'),
          bloco(numeros.modalidades, 'modalidades'),
          bloco(numeros.aulas_semana, 'aulas por semana'),
        ]),
        el('p', { classe: 'dica', estilo: 'margin-top:1rem' }, [
          academia.endereco ? `📍 ${academia.endereco}` : null,
          academia.telefone ? el('span', { texto: `  ☎️ ${academia.telefone}` }) : null,
          academia.instagram ? el('span', { texto: `  📷 ${academia.instagram}` }) : null,
        ]),
      ]),
      caixaAcesso(),
    ]),

    secao('Modalidades', el('div', { classe: 'grade col-3' }, modalidades.map((modalidade) => el('article', {
      classe: 'cartao-modalidade',
      estilo: `border-top-color:${modalidade.cor || '#e03131'}`,
    }, [
      el('h3', { texto: modalidade.nome }),
      el('p', { classe: 'dica', texto: modalidade.descricao || '' }),
      el('span', { classe: 'etiqueta neutra', texto: `${modalidade.turmas} turma(s)` }),
    ])))),

    secao('Grade de horarios', gradeSemanal(grade)),

    secao('Planos', el('div', { classe: 'grade col-3' }, planos.map((plano) => el('article', { classe: 'cartao-plano' }, [
      el('h3', { texto: plano.nome }),
      el('div', { classe: 'preco' }, [moeda(plano.valor), el('small', { texto: ` ${ROTULO_PERIODICIDADE[plano.periodicidade] || ''}` })]),
      el('p', { classe: 'dica', texto: plano.descricao || '' }),
      el('p', { classe: 'dica', texto: plano.aulas_semana ? `${plano.aulas_semana}x por semana` : 'Treinos livres' }),
      plano.modalidades.length
        ? el('div', { classe: 'acoes' }, plano.modalidades.map((nome) => el('span', { classe: 'etiqueta info', texto: nome })))
        : el('span', { classe: 'etiqueta ok', texto: 'Todas as modalidades' }),
    ])))),

    avisos.length
      ? secao('Avisos e campeonatos', el('div', { classe: 'grade col-2' }, avisos.map((item) => el('article', { classe: 'cartao' }, [
        el('div', { classe: 'acoes', estilo: 'margin-bottom:.4rem' }, [
          el('span', { classe: 'etiqueta alerta', texto: ROTULO_TIPO_AVISO[item.tipo] || item.tipo }),
          item.data_evento ? el('span', { classe: 'etiqueta neutra', texto: dataBr(item.data_evento) }) : null,
        ]),
        el('h3', { texto: item.titulo }),
        el('p', { classe: 'dica', texto: item.mensagem }),
        item.local_evento ? el('p', { classe: 'dica', texto: `Local: ${item.local_evento}` }) : null,
      ]))))
      : null,

    el('footer', { classe: 'secao dica', estilo: 'text-align:center' }, [
      `${academia.nome} - sistema de gestao da academia`,
    ]),
  ]);
}

function bloco(valor, rotulo) {
  return el('div', {}, [el('strong', { texto: String(valor) }), el('span', { texto: rotulo })]);
}

function secao(titulo, conteudo) {
  return el('section', { classe: 'secao' }, [el('h2', { texto: titulo }), conteudo]);
}

function gradeSemanal(grade) {
  const hoje = new Date().getDay();
  return el('div', { classe: 'tabela-rolagem' }, [
    el('div', { classe: 'grade-semana' }, DIAS_SEMANA.map((dia, indice) => {
      const aulas = grade.filter((aula) => aula.dia_semana === indice);
      return el('div', { classe: `coluna-dia ${indice === hoje ? 'hoje' : ''}` }, [
        el('h4', { texto: dia }),
        aulas.length
          ? el('div', {}, aulas.map((aula) => el('div', {
            classe: 'aula',
            estilo: `border-left-color:${aula.modalidade_cor || '#e03131'}`,
          }, [
            el('div', { classe: 'hora', texto: `${aula.hora_inicio} - ${aula.hora_fim}` }),
            el('div', { classe: 'turma', texto: aula.modalidade }),
            el('div', { classe: 'info', texto: aula.turma }),
            el('div', { classe: 'info', texto: `${aula.categoria}${aula.mestre ? ` · ${aula.mestre}` : ''}` }),
          ])))
          : el('div', { classe: 'info dica', texto: 'Sem aulas' }),
      ]);
    })),
  ]);
}

/** Caixa com as abas de login e de cadastro do aluno. */
function caixaAcesso() {
  const conteudo = el('div', {});
  const abaEntrar = el('button', { classe: 'ativo', texto: 'Entrar', type: 'button' });
  const abaCadastrar = el('button', { texto: 'Criar conta', type: 'button' });

  function selecionar(aba) {
    abaEntrar.classList.toggle('ativo', aba === 'entrar');
    abaCadastrar.classList.toggle('ativo', aba === 'cadastrar');
    conteudo.replaceChildren(aba === 'entrar' ? formularioLogin() : formularioCadastro());
  }
  abaEntrar.addEventListener('click', () => selecionar('entrar'));
  abaCadastrar.addEventListener('click', () => selecionar('cadastrar'));
  selecionar('entrar');

  return el('div', { classe: 'caixa-login' }, [
    el('div', { classe: 'abas' }, [abaEntrar, abaCadastrar]),
    conteudo,
  ]);
}

function mensagem(texto, tipo = 'erro') {
  return el('div', { classe: tipo === 'erro' ? 'mensagem-erro' : 'mensagem-ok', texto });
}

function formularioLogin() {
  const erro = el('div');
  const form = el('form', {}, [
    erro,
    el('div', { classe: 'campo' }, [el('label', { texto: 'E-mail' }), el('input', { type: 'email', name: 'email', required: true, autocomplete: 'email' })]),
    el('div', { classe: 'campo' }, [el('label', { texto: 'Senha' }), el('input', { type: 'password', name: 'senha', required: true, autocomplete: 'current-password' })]),
    el('button', { classe: 'botao', type: 'submit', texto: 'Entrar no sistema', estilo: 'width:100%' }),
    el('p', { classe: 'dica', estilo: 'margin-top:.75rem' , texto: 'Aluno, mestre, recepcao ou dono usam o mesmo login.' }),
  ]);

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    erro.replaceChildren();
    const botaoEnviar = form.querySelector('button[type=submit]');
    botaoEnviar.disabled = true;
    try {
      const dados = await api.criar('/auth/login', {
        email: form.elements.email.value.trim(),
        senha: form.elements.senha.value,
      });
      sessao.salvar(dados.token, dados.usuario);
      irPara(dados.usuario.papel === 'aluno' ? 'minha-area' : 'painel');
      await iniciar();
    } catch (falha) {
      erro.replaceChildren(mensagem(falha.message));
    } finally {
      botaoEnviar.disabled = false;
    }
  });
  return form;
}

function formularioCadastro() {
  const erro = el('div');
  const form = el('form', {}, [
    erro,
    el('p', { classe: 'dica', texto: 'Crie sua conta para acompanhar horarios, avisos e mensalidades. A recepcao confirma sua matricula e libera o plano.' }),
    el('div', { classe: 'campo' }, [el('label', { texto: 'Nome completo *' }), el('input', { name: 'nome', required: true })]),
    el('div', { classe: 'linha' }, [
      el('div', { classe: 'campo' }, [el('label', { texto: 'E-mail *' }), el('input', { type: 'email', name: 'email', required: true })]),
      el('div', { classe: 'campo' }, [el('label', { texto: 'Telefone / WhatsApp' }), el('input', { name: 'telefone' })]),
    ]),
    el('div', { classe: 'linha' }, [
      el('div', { classe: 'campo' }, [el('label', { texto: 'Data de nascimento' }), el('input', { type: 'date', name: 'data_nascimento', max: hojeISO() })]),
      el('div', { classe: 'campo' }, [el('label', { texto: 'Senha *' }), el('input', { type: 'password', name: 'senha', required: true, minlength: 6 })]),
    ]),
    el('div', { classe: 'linha' }, [
      el('div', { classe: 'campo' }, [el('label', { texto: 'Responsavel (menores de idade)' }), el('input', { name: 'responsavel_nome' })]),
      el('div', { classe: 'campo' }, [el('label', { texto: 'Telefone do responsavel' }), el('input', { name: 'responsavel_telefone' })]),
    ]),
    el('div', { classe: 'campo' }, [el('label', { texto: 'Observacoes (lesoes, experiencia, modalidade de interesse)' }), el('textarea', { name: 'observacoes' })]),
    el('button', { classe: 'botao', type: 'submit', texto: 'Criar minha conta', estilo: 'width:100%' }),
  ]);

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    erro.replaceChildren();
    const botaoEnviar = form.querySelector('button[type=submit]');
    botaoEnviar.disabled = true;
    try {
      const corpo = Object.fromEntries(new FormData(form).entries());
      const dados = await api.criar('/auth/registrar', corpo);
      sessao.salvar(dados.token, dados.usuario);
      irPara('minha-area');
      await iniciar();
    } catch (falha) {
      erro.replaceChildren(mensagem(falha.message));
    } finally {
      botaoEnviar.disabled = false;
    }
  });
  return form;
}
