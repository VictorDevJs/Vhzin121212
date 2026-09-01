import { api, sessao } from '../api.js';
import { el, moeda, dataBr, DIAS_SEMANA, hojeISO, etiqueta } from '../ui.js';
import { logotipo, marca } from '../marca.js';
import { icone } from '../icones.js';
import { alternarTema, ehEscuro } from '../tema.js';
import { iniciar, irPara } from '../app.js';

const ROTULO_PERIODICIDADE = { mensal: 'por mes', trimestral: 'por trimestre', semestral: 'por semestre', anual: 'por ano' };
const ROTULO_TIPO = {
  geral: 'Aviso', campeonato: 'Campeonato', evento: 'Evento',
  cancelamento: 'Sem aula', manutencao: 'Manutencao', graduacao: 'Exame de faixa',
};

/** Vitrine da academia + acesso ao sistema. */
export default async function paginaPublica() {
  const dados = await api.obter('/publico/academia');
  const { academia, modalidades, grade, planos, avisos, numeros } = dados;

  const pagina = el('div', { classe: 'site' }, [
    cabecalho(),
    el('div', { classe: 'envolucro' }, [
      heroi(academia, numeros),
      secaoModalidades(modalidades),
      secaoHorarios(grade, modalidades),
      secaoPlanos(planos),
      avisos.length ? secaoAvisos(avisos) : null,
      rodape(academia),
    ]),
  ]);

  queueMicrotask(() => { revelarAoRolar(pagina); animarNumeros(pagina); });
  return pagina;
}

/* ----------------------------------------------------------- cabecalho */

function cabecalho() {
  const irParaSecao = (id) => (evento) => {
    evento.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return el('header', { classe: 'site-topo' }, [
    el('div', { classe: 'identidade', estilo: 'padding:0' }, [logotipo(28)]),
    el('nav', {}, [
      el('a', { href: '#modalidades', texto: 'Modalidades', aoClicar: irParaSecao('modalidades') }),
      el('a', { href: '#horarios', texto: 'Horarios', aoClicar: irParaSecao('horarios') }),
      el('a', { href: '#planos', texto: 'Planos', aoClicar: irParaSecao('planos') }),
      el('a', { href: '#avisos', texto: 'Avisos', aoClicar: irParaSecao('avisos') }),
    ]),
    el('div', { classe: 'acoes' }, [
      el('button', {
        classe: 'botao-icone', 'aria-label': 'Alternar tema',
        aoClicar: (evento) => { alternarTema(); evento.currentTarget.replaceChildren(icone(ehEscuro() ? 'sol' : 'lua', 18)); },
      }, [icone(ehEscuro() ? 'sol' : 'lua', 18)]),
      el('button', {
        classe: 'botao', texto: 'Entrar',
        aoClicar: () => document.getElementById('acesso')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      }),
    ]),
  ]);
}

/* ---------------------------------------------------------------- heroi */

function heroi(academia, numeros) {
  return el('section', { classe: 'heroi' }, [
    el('div', { classe: 'heroi-grade' }, [
      el('div', {}, [
        el('span', { classe: 'selo' }, [el('span', { classe: 'ponto', estilo: 'background:var(--marca-1)' }), academia.chamada || 'Artes marciais de verdade']),
        el('h1', {}, [
          'Treine na ',
          el('span', { classe: 'destaque', texto: academia.nome }),
        ]),
        el('p', { classe: 'chamada', texto: academia.sobre || 'Jiu-Jitsu, Muay Thai, Karate, Kickboxing e MMA para todas as idades.' }),
        el('div', { classe: 'acoes', estilo: 'margin-top:1.5rem' }, [
          el('button', {
            classe: 'botao', texto: 'Criar minha conta',
            aoClicar: () => { document.getElementById('acesso')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.getElementById('aba-cadastro')?.click(); },
          }),
          el('button', {
            classe: 'botao secundario', texto: 'Ver horarios',
            aoClicar: () => document.getElementById('horarios')?.scrollIntoView({ behavior: 'smooth' }),
          }),
        ]),
        el('div', { classe: 'numeros' }, [
          numero(numeros.alunos_ativos, 'alunos ativos'),
          numero(numeros.modalidades, 'modalidades'),
          numero(numeros.aulas_semana, 'aulas por semana'),
        ]),
      ]),
      el('div', { id: 'acesso' }, [caixaAcesso()]),
    ]),
  ]);
}

function numero(valor, rotulo) {
  return el('div', {}, [
    el('strong', { 'data-contar': String(valor), texto: '0' }),
    el('span', { texto: rotulo }),
  ]);
}

/* ------------------------------------------------------------- secoes */

function tituloSecao(olho, titulo) {
  return el('div', { classe: 'titulo-secao' }, [
    el('div', { classe: 'olho', texto: olho }),
    el('h2', { texto: titulo }),
  ]);
}

function secaoModalidades(modalidades) {
  return el('section', { classe: 'secao revelar', id: 'modalidades' }, [
    tituloSecao('O que voce treina aqui', 'Modalidades'),
    el('div', { classe: 'grade col-3' }, modalidades.map((modalidade) => el('article', {
      classe: 'cartao-modalidade', estilo: `--cor-modalidade:${modalidade.cor || 'var(--marca-1)'}`,
    }, [
      el('h3', { texto: modalidade.nome }),
      el('p', { classe: 'dica', estilo: 'font-size:.9rem', texto: modalidade.descricao || '' }),
      el('div', { classe: 'acoes' }, [etiqueta(`${modalidade.turmas} turma(s)`, 'neutra')]),
    ]))),
  ]);
}

function secaoHorarios(grade, modalidades) {
  const area = el('div', { classe: 'rolagem' });
  let filtro = '';

  function desenhar() {
    const aulas = filtro ? grade.filter((a) => a.modalidade === filtro) : grade;
    area.replaceChildren(el('div', { classe: 'semana' }, DIAS_SEMANA.map((dia, indice) => {
      const doDia = aulas.filter((aula) => aula.dia_semana === indice);
      return el('div', { classe: `dia ${indice === new Date().getDay() ? 'hoje' : ''}` }, [
        el('h4', { texto: dia }),
        doDia.length
          ? el('div', {}, doDia.map((aula) => el('div', {
            classe: 'aula', estilo: `border-left-color:${aula.modalidade_cor || 'var(--marca-1)'}`,
          }, [
            el('div', { classe: 'hora', texto: `${aula.hora_inicio} - ${aula.hora_fim}` }),
            el('div', { texto: aula.modalidade }),
            el('div', { classe: 'info', texto: aula.turma }),
            el('div', { classe: 'info', texto: [aula.categoria, aula.mestre].filter(Boolean).join(' · ') }),
          ])))
          : el('div', { classe: 'info dica', texto: 'Sem aulas' }),
      ]);
    })));
  }

  const filtros = el('div', { classe: 'acoes', estilo: 'margin-bottom:1rem' }, [
    chip('Todas', true, () => { filtro = ''; marcarChip(filtros, 'Todas'); desenhar(); }),
    ...modalidades.map((m) => chip(m.nome, false, () => { filtro = m.nome; marcarChip(filtros, m.nome); desenhar(); })),
  ]);

  desenhar();
  return el('section', { classe: 'secao revelar', id: 'horarios' }, [
    tituloSecao('Grade da semana', 'Horarios das aulas'),
    filtros,
    area,
  ]);
}

function chip(texto, ativo, aoClicar) {
  return el('button', {
    classe: `botao pequeno ${ativo ? '' : 'secundario'}`, texto, 'data-chip': texto, aoClicar,
  });
}

function marcarChip(container, ativo) {
  container.querySelectorAll('[data-chip]').forEach((botao) => {
    botao.className = `botao pequeno ${botao.dataset.chip === ativo ? '' : 'secundario'}`;
  });
}

function secaoPlanos(planos) {
  const maisCaro = Math.max(...planos.map((p) => p.valor), 0);
  return el('section', { classe: 'secao revelar', id: 'planos' }, [
    tituloSecao('Escolha o seu', 'Planos'),
    el('div', { classe: 'grade col-3' }, planos.map((plano) => el('article', {
      classe: `cartao-plano ${plano.valor === maisCaro && planos.length > 1 ? 'destaque' : ''}`,
    }, [
      plano.valor === maisCaro && planos.length > 1 ? etiqueta('mais completo', 'marca') : null,
      el('h3', { texto: plano.nome }),
      el('div', { classe: 'preco' }, [moeda(plano.valor), el('small', { texto: ` ${ROTULO_PERIODICIDADE[plano.periodicidade] || ''}` })]),
      el('p', { classe: 'dica', estilo: 'font-size:.88rem', texto: plano.descricao || '' }),
      el('div', { classe: 'acoes' }, [
        etiqueta(plano.aulas_semana ? `${plano.aulas_semana}x por semana` : 'treinos livres', 'neutra'),
        ...(plano.modalidades.length
          ? plano.modalidades.map((nome) => etiqueta(nome, 'info'))
          : [etiqueta('todas as modalidades', 'bom')]),
      ]),
    ]))),
  ]);
}

function secaoAvisos(avisos) {
  return el('section', { classe: 'secao revelar', id: 'avisos' }, [
    tituloSecao('Fique por dentro', 'Avisos e campeonatos'),
    el('div', { classe: 'grade col-2' }, avisos.map((item) => el('article', { classe: 'cartao' }, [
      el('div', { classe: 'acoes', estilo: 'margin-bottom:.5rem' }, [
        etiqueta(ROTULO_TIPO[item.tipo] || item.tipo, item.tipo === 'cancelamento' ? 'critico' : 'atencao'),
        item.data_evento ? etiqueta(dataBr(item.data_evento), 'neutra') : null,
      ]),
      el('h3', { texto: item.titulo }),
      el('p', { classe: 'dica', estilo: 'font-size:.9rem', texto: item.mensagem }),
      item.local_evento ? el('p', { classe: 'dica', texto: `Local: ${item.local_evento}` }) : null,
    ]))),
  ]);
}

function rodape(academia) {
  const contatos = [
    academia.endereco && `\u{1F4CD} ${academia.endereco}`,
    academia.telefone && `\u{260E} ${academia.telefone}`,
    academia.instagram && `\u{1F4F7} ${academia.instagram}`,
  ].filter(Boolean);

  return el('footer', { classe: 'rodape-site' }, [
    el('div', { estilo: 'display:flex;gap:1rem;flex-wrap:wrap;align-items:center;justify-content:space-between' }, [
      el('div', { classe: 'identidade', estilo: 'padding:0' }, [logotipo(26)]),
      el('div', {}, contatos.map((linha) => el('div', { texto: linha }))),
    ]),
    el('p', { estilo: 'margin-top:1rem', texto: `© ${new Date().getFullYear()} ${academia.nome} · sistema de gestao da academia` }),
  ]);
}

/* ------------------------------------------------------ login e cadastro */

function caixaAcesso() {
  const conteudo = el('div');
  const abaEntrar = el('button', { classe: 'ativo', texto: 'Entrar', type: 'button', id: 'aba-entrar' });
  const abaCadastrar = el('button', { texto: 'Criar conta', type: 'button', id: 'aba-cadastro' });

  function selecionar(aba) {
    abaEntrar.classList.toggle('ativo', aba === 'entrar');
    abaCadastrar.classList.toggle('ativo', aba === 'cadastrar');
    conteudo.replaceChildren(aba === 'entrar' ? formularioLogin() : formularioCadastro());
  }
  abaEntrar.addEventListener('click', () => selecionar('entrar'));
  abaCadastrar.addEventListener('click', () => selecionar('cadastrar'));
  selecionar('entrar');

  return el('div', { classe: 'painel-acesso' }, [
    el('div', { classe: 'abas' }, [abaEntrar, abaCadastrar]),
    conteudo,
  ]);
}

function campo(rotulo, atributos) {
  return el('div', { classe: 'campo' }, [el('label', { texto: rotulo }), el('input', atributos)]);
}

async function entrarComResposta(dados) {
  sessao.salvar(dados.token, dados.usuario);
  irPara(dados.usuario.papel === 'aluno' ? 'minha-area' : 'painel');
  await iniciar();
}

function envolverEnvio(form, erro, acao) {
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    erro.replaceChildren();
    const enviar = form.querySelector('button[type=submit]');
    enviar.disabled = true;
    enviar.textContent = 'Aguarde...';
    try {
      await acao();
    } catch (falha) {
      erro.replaceChildren(el('div', { classe: 'mensagem-erro' }, [el('span', { texto: '⚠' }), falha.message]));
      enviar.disabled = false;
      enviar.textContent = enviar.dataset.texto;
    }
  });
}

function formularioLogin() {
  const erro = el('div');
  const form = el('form', {}, [
    erro,
    campo('E-mail', { type: 'email', name: 'email', required: true, autocomplete: 'email', placeholder: 'voce@email.com' }),
    campo('Senha', { type: 'password', name: 'senha', required: true, autocomplete: 'current-password' }),
    el('button', { classe: 'botao', type: 'submit', texto: 'Entrar no sistema', estilo: 'width:100%', 'data-texto': 'Entrar no sistema' }),
    el('p', { classe: 'dica', estilo: 'margin-top:.75rem', texto: 'Aluno, mestre, recepcao e dono usam o mesmo login.' }),
  ]);

  envolverEnvio(form, erro, async () => {
    const dados = await api.criar('/auth/login', {
      email: form.elements.email.value.trim(),
      senha: form.elements.senha.value,
    });
    await entrarComResposta(dados);
  });
  return form;
}

function formularioCadastro() {
  const erro = el('div');
  const form = el('form', {}, [
    erro,
    el('p', { classe: 'dica', texto: `Crie sua conta na ${marca.nome} para acompanhar horarios, avisos e mensalidades. A recepcao confirma a matricula e libera o plano.` }),
    campo('Nome completo *', { name: 'nome', required: true }),
    el('div', { classe: 'linha' }, [
      campo('E-mail *', { type: 'email', name: 'email', required: true }),
      campo('Telefone / WhatsApp', { name: 'telefone', placeholder: '(00) 00000-0000' }),
    ]),
    el('div', { classe: 'linha' }, [
      campo('Data de nascimento', { type: 'date', name: 'data_nascimento', max: hojeISO() }),
      campo('Senha *', { type: 'password', name: 'senha', required: true, minlength: 6 }),
    ]),
    el('div', { classe: 'linha' }, [
      campo('Responsavel (menor de idade)', { name: 'responsavel_nome' }),
      campo('Telefone do responsavel', { name: 'responsavel_telefone' }),
    ]),
    el('div', { classe: 'campo' }, [
      el('label', { texto: 'Ja treina? Tem alguma lesao? Qual modalidade quer fazer?' }),
      el('textarea', { name: 'observacoes' }),
    ]),
    el('button', { classe: 'botao', type: 'submit', texto: 'Criar minha conta', estilo: 'width:100%', 'data-texto': 'Criar minha conta' }),
  ]);

  envolverEnvio(form, erro, async () => {
    const corpo = Object.fromEntries(new FormData(form).entries());
    const dados = await api.criar('/auth/registrar', corpo);
    await entrarComResposta(dados);
  });
  return form;
}

/* --------------------------------------------------------- animacoes */

function revelarAoRolar(raiz) {
  const alvos = raiz.querySelectorAll('.revelar');
  if (!('IntersectionObserver' in window)) {
    alvos.forEach((alvo) => alvo.classList.add('visivel'));
    return;
  }
  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (entrada.isIntersecting) {
        entrada.target.classList.add('visivel');
        observador.unobserve(entrada.target);
      }
    }
  }, { rootMargin: '0px 0px -80px 0px' });
  alvos.forEach((alvo) => observador.observe(alvo));
  // Se por algum motivo o observador nao disparar, o conteudo aparece do mesmo jeito.
  setTimeout(() => alvos.forEach((alvo) => alvo.classList.add('visivel')), 2500);
}

function animarNumeros(raiz) {
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  raiz.querySelectorAll('[data-contar]').forEach((no) => {
    const alvo = Number(no.dataset.contar) || 0;
    if (reduzido || alvo === 0) { no.textContent = String(alvo); return; }
    const duracao = 900;
    const inicio = performance.now();
    const passo = (agora) => {
      const progresso = Math.min(1, (agora - inicio) / duracao);
      no.textContent = String(Math.round(alvo * (1 - (1 - progresso) ** 3)));
      if (progresso < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}
