import { api, consulta } from '../api.js';
import {
  el, cartao, tabela, celula, botao, etiqueta, etiquetaCor, indicador, moeda, dataBr, dataHoraBr,
  abrirModal, abrirFormulario, aviso, vazio, esqueleto,
} from '../ui.js';
import { linkWhatsapp } from '../whatsapp.js';
import { icone } from '../icones.js';
import { topo, irPara } from '../app.js';

const COR_SITUACAO = {
  'em dia': 'ok',
  'vence em breve': 'alerta',
  atrasado: 'erro',
  'sem plano': 'neutra',
  'mês não gerado': 'alerta',
};

/**
 * Central de contas: todas as fichas de aluno divididas por arte marcial,
 * com a situação de pagamento calculada na hora. É a "Minha área" do aluno
 * vista de fora, por quem administra a academia.
 */
export default async function paginaContas() {
  const filtro = { busca: '', status: '', situacao: '' };
  const area = el('div');
  const areaResumo = el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' });
  const fechados = new Set();

  async function carregar() {
    area.replaceChildren(esqueleto(3, 110));
    const dados = await api.obter(`/contas${consulta({ busca: filtro.busca, status: filtro.status })}`);
    desenharResumo(dados.resumo, dados.total);

    const grupos = dados.grupos
      .map((g) => ({ ...g, alunos: g.alunos.filter((a) => !filtro.situacao || a.pagamento.situacao === filtro.situacao) }))
      .filter((g) => g.alunos.length);

    area.replaceChildren(grupos.length
      ? el('div', {}, grupos.map(grupoDeModalidade))
      : vazio('Nenhum aluno neste filtro.'));
  }

  function desenharResumo(resumo, total) {
    areaResumo.replaceChildren(
      indicador({ rotulo: 'Contas de alunos', valor: String(total),
        detalhe: `${resumo.sem_acesso} sem login criado`, tipo: 'destaque' }),
      indicador({ rotulo: 'Pagamento em dia', valor: String(resumo.em_dia),
        detalhe: 'Sem nada vencido', tipo: 'bom' }),
      indicador({ rotulo: 'Atrasados', valor: String(resumo.atrasados),
        detalhe: resumo.valor_atrasado ? `${moeda(resumo.valor_atrasado)} a receber` : 'Nada em atraso',
        tipo: resumo.atrasados ? 'critico' : 'bom' }),
      indicador({ rotulo: 'Vencendo em 5 dias', valor: String(resumo.vence_em_breve),
        detalhe: resumo.sem_plano ? `${resumo.sem_plano} sem plano ativo` : 'Cobrança preventiva',
        tipo: resumo.vence_em_breve ? 'atencao' : '' }),
    );
  }

  function grupoDeModalidade(grupo) {
    const chave = String(grupo.id ?? 'sem-turma');
    const aberto = !fechados.has(chave);
    const atrasados = grupo.alunos.filter((a) => a.pagamento.situacao === 'atrasado').length;

    return el('section', { classe: 'grupo-contas', estilo: `--cor-grupo:${grupo.cor}` }, [
      el('button', {
        classe: `cabecalho-grupo ${aberto ? 'aberto' : ''}`, type: 'button',
        'aria-expanded': String(aberto),
        aoClicar: () => {
          if (fechados.has(chave)) fechados.delete(chave); else fechados.add(chave);
          carregar();
        },
      }, [
        el('span', { classe: 'ponto-grupo' }),
        el('strong', { texto: grupo.nome }),
        el('span', { classe: 'contagem-grupo', texto: `${grupo.alunos.length} aluno(s)` }),
        atrasados ? etiqueta(`${atrasados} atrasado(s)`, 'erro') : null,
        el('span', { classe: 'seta-grupo', texto: aberto ? '\u2212' : '+' }),
      ].filter(Boolean)),

      aberto
        ? el('div', { classe: 'tabela-texto' }, [tabela(
          ['Aluno', 'Graduação', 'Plano', 'Situação', 'Frequência', 'Ações'],
          grupo.alunos.map((aluno) => [
            celula([
              el('strong', { texto: aluno.nome }),
              el('div', { classe: 'dica' }, [
                `${aluno.categoria}${aluno.telefone ? ` · ${aluno.telefone}` : ''}`
                + `${aluno.usuario_id ? '' : ' · sem login'}`,
              ]),
            ]),
            celula(aluno.graduacoes.length
              ? aluno.graduacoes.map((g) => etiquetaCor(
                `${g.graduacao}${g.grau ? ` ${g.grau}º` : ''}`, g.cor))
              : [el('span', { classe: 'dica', texto: 'sem graduação' })]),
            celula([
              aluno.pagamento.plano || '—',
              aluno.pagamento.valor_plano
                ? el('div', { classe: 'dica', texto: moeda(aluno.pagamento.valor_plano) })
                : null,
            ].filter(Boolean)),
            celula([selo(aluno.pagamento)]),
            celula([
              el('strong', { texto: String(aluno.frequencia_30d) }),
              el('div', { classe: 'dica', texto: 'treinos em 30 dias' }),
            ]),
            celula([
              botao('Abrir ficha', () => abrirFicha(aluno.id), 'botao pequeno secundario'),
              aluno.pagamento.situacao === 'atrasado' && aluno.telefone
                ? cobrarNoWhats(aluno)
                : null,
            ].filter(Boolean), 'acoes-celula'),
          ]),
          'Nenhum aluno nesta modalidade.',
        )])
        : null,
    ]);
  }

  function selo(pagamento) {
    const etiquetaBase = etiqueta(pagamento.situacao, COR_SITUACAO[pagamento.situacao] || 'neutra');
    if (pagamento.situacao === 'atrasado') {
      return el('div', {}, [
        etiquetaBase,
        el('div', { classe: 'dica', texto: `${moeda(pagamento.valor_atrasado)} desde ${dataBr(pagamento.proximo_vencimento)}` }),
      ]);
    }
    if (pagamento.dias_para_vencer !== null && pagamento.dias_para_vencer >= 0) {
      return el('div', {}, [
        etiquetaBase,
        el('div', { classe: 'dica', texto: `vence em ${pagamento.dias_para_vencer} dia(s)` }),
      ]);
    }
    return etiquetaBase;
  }

  function cobrarNoWhats(aluno) {
    const link = linkWhatsapp(aluno.telefone,
      `Olá, ${aluno.nome.split(' ')[0]}! Aqui é da Atak. Sua mensalidade de `
      + `${moeda(aluno.pagamento.valor_atrasado)} venceu em ${dataBr(aluno.pagamento.proximo_vencimento)}. `
      + 'Podemos acertar?');
    if (!link) return null;
    return el('a', { classe: 'botao pequeno', href: link, target: '_blank', rel: 'noopener' },
      [icone('zap', 14), ' Cobrar']);
  }

  /* ------------------------------------------------ ficha do aluno */

  async function abrirFicha(id) {
    const corpo = el('div', {}, [esqueleto(3, 110)]);
    const janela = abrirModal({ titulo: 'Ficha do aluno', conteudo: corpo, largura: '940px' });
    const f = await api.obter(`/contas/${id}`);

    corpo.replaceChildren(
      el('div', { classe: 'cabecalho-ficha' }, [
        el('div', {}, [
          el('h3', { texto: f.aluno.nome, estilo: 'margin:0 0 .2rem' }),
          el('div', { classe: 'dica' }, [
            [f.aluno.email, f.aluno.telefone, f.aluno.categoria].filter(Boolean).join(' · '),
          ]),
          f.aluno.responsavel_nome
            ? el('div', { classe: 'dica', texto: `Responsável: ${f.aluno.responsavel_nome} ${f.aluno.responsavel_telefone || ''}` })
            : null,
        ].filter(Boolean)),
        el('div', { classe: 'acoes' }, [
          selo(f.pagamento),
          botao('Editar cadastro', () => editarAluno(f.aluno, janela), 'botao pequeno secundario'),
          botao('Ver na tela de alunos', () => { janela.fechar(); irPara('alunos'); }, 'botao pequeno secundario'),
        ]),
      ]),

      el('div', { classe: 'grade-ficha' }, [
        indicador({ rotulo: 'Plano', valor: f.pagamento.plano || '—',
          detalhe: f.pagamento.valor_plano ? moeda(f.pagamento.valor_plano) : 'sem matrícula ativa' }),
        indicador({ rotulo: 'Treinos no total', valor: String(f.frequencia.total),
          detalhe: `${f.frequencia.mes} nos últimos 30 dias`, tipo: 'destaque' }),
        indicador({ rotulo: 'Nesta semana', valor: String(f.frequencia.semana), detalhe: 'check-ins' }),
        indicador({ rotulo: 'Acesso ao app', valor: f.aluno.usuario_id ? 'sim' : 'não',
          detalhe: f.aluno.ultimo_acesso ? `último em ${dataHoraBr(f.aluno.ultimo_acesso)}` : 'nunca entrou',
          tipo: f.aluno.usuario_id ? 'bom' : 'atencao' }),
      ]),

      el('div', { classe: 'grade col-2' }, [
        cartao('Turmas e horários', f.horarios.length
          ? el('div', {}, f.horarios.map((h) => el('div', { classe: 'linha-horario' }, [
            etiquetaCor(h.modalidade, h.modalidade_cor),
            el('strong', { texto: `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][h.dia_semana]} ${h.hora_inicio}` }),
            el('span', { classe: 'dica', texto: `${h.turma}${h.rotulo ? ` · ${h.rotulo}` : ''}` }),
          ])))
          : vazio('Sem turma definida.')),

        cartao('Graduação atual', f.graduacoes.length
          ? el('ol', { classe: 'escala' }, f.graduacoes.slice(0, 4).map((g) => el('li', { classe: 'degrau' }, [
            el('span', { classe: 'ordem-degrau' }, [
              el('span', { classe: 'ponto', estilo: `background:${g.modalidade_cor};display:inline-block;width:9px;height:9px;border-radius:50%` }),
            ]),
            el('span', {
              classe: 'faixa-visual', 'aria-hidden': 'true',
              estilo: `--cor-faixa:${g.cor || '#888'};--cor-ponta:${g.cor_ponta || g.cor || '#888'}`,
            }, [
              el('span', { classe: 'ponta-faixa' }),
              ...Array.from({ length: Math.min(g.grau || 0, 6) }, () => el('span', { classe: 'grau-faixa' })),
            ]),
            el('div', { classe: 'dados-degrau' }, [
              el('strong', { texto: `${g.modalidade} — ${g.graduacao}` }),
              el('span', { classe: 'dica', texto: `desde ${dataBr(g.data)}` }),
            ]),
          ])))
          : vazio('Nenhuma graduação registrada.')),
      ]),

      cartao('Mensalidades', el('div', { classe: 'tabela-texto' }, [tabela(
        ['Competência', 'Vencimento', 'Valor', 'Situação', 'Pagamento'],
        f.mensalidades.map((m) => [
          m.competencia,
          dataBr(m.vencimento),
          moeda(m.valor),
          celula([m.atrasada ? etiqueta('atrasada', 'erro') : etiqueta(m.status, m.status === 'pago' ? 'ok' : 'alerta')]),
          m.pago_em ? `${dataBr(m.pago_em)}${m.forma_pagamento ? ` · ${m.forma_pagamento}` : ''}` : '—',
        ]),
        'Nenhuma mensalidade gerada.',
      )])),

      f.competicoes.length
        ? cartao('Competições', el('div', { classe: 'tabela-texto' }, [tabela(
          ['Competição', 'Arte', 'Data', 'Situação', 'Resultado'],
          f.competicoes.map((c) => [
            c.competicao,
            c.modalidade ? celula([etiquetaCor(c.modalidade, c.modalidade_cor)]) : '—',
            dataBr(c.data_inicio),
            c.inscricao,
            c.medalha ? `${c.medalha}${c.colocacao ? ` · ${c.colocacao}º` : ''}` : '—',
          ]),
        )]))
        : null,

      f.checkins.length
        ? cartao('Últimos treinos', el('div', { classe: 'tabela-texto' }, [tabela(
          ['Data', 'Hora', 'Modalidade', 'Turma'],
          f.checkins.map((c) => [dataBr(c.data), c.hora, c.modalidade, c.turma]),
        )]))
        : null,
    );
  }

  function editarAluno(aluno, janela) {
    abrirFormulario({
      titulo: `Editar ${aluno.nome}`,
      campos: [
        { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
        { nome: 'email', rotulo: 'E-mail', tipo: 'email' },
        { nome: 'telefone', rotulo: 'Telefone' },
        { nome: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'date' },
        { nome: 'categoria', rotulo: 'Categoria', tipo: 'select',
          opcoes: [{ valor: 'adulto', rotulo: 'Adulto' }, { valor: 'kids', rotulo: 'Kids' }] },
        { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [
          { valor: 'ativo', rotulo: 'Ativo' }, { valor: 'pendente', rotulo: 'Pendente' },
          { valor: 'trancado', rotulo: 'Trancado' }, { valor: 'inativo', rotulo: 'Inativo' },
        ] },
        { nome: 'responsavel_nome', rotulo: 'Responsável (kids)' },
        { nome: 'responsavel_telefone', rotulo: 'Telefone do responsável' },
        { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea' },
      ],
      valores: aluno,
      aoSalvar: async (dados) => {
        await api.atualizar(`/alunos/${aluno.id}`, dados);
        aviso('Cadastro atualizado.');
        janela.fechar();
        await carregar();
      },
    });
  }

  await carregar();

  return el('div', {}, [
    topo('Contas dos alunos',
      'Todas as fichas divididas por arte marcial, com plano, graduação, frequência e pagamento',
      [botao('+ Novo aluno', () => irPara('alunos'))]),

    el('p', { classe: 'explicacao' }, [
      icone('alunos', 16),
      'É a área do aluno vista por dentro: quem treina o quê, qual faixa está, se o plano está em dia e há '
      + 'quanto tempo não aparece. A situação de pagamento é calculada na hora, pelo vencimento de cada mensalidade.',
    ]),

    areaResumo,

    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Buscar' }),
        el('input', { type: 'search', placeholder: 'Nome, e-mail ou telefone',
          aoDigitar: (evento) => { filtro.busca = evento.target.value; clearTimeout(filtro.t);
            filtro.t = setTimeout(carregar, 300); } }),
      ]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Situação do pagamento' }),
        el('select', { aoMudar: (evento) => { filtro.situacao = evento.target.value; carregar(); } }, [
          el('option', { value: '', texto: 'Todas' }),
          ...['em dia', 'vence em breve', 'atrasado', 'sem plano', 'mês não gerado']
            .map((s) => el('option', { value: s, texto: s })),
        ]),
      ]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Matrícula' }),
        el('select', { aoMudar: (evento) => { filtro.status = evento.target.value; carregar(); } }, [
          el('option', { value: '', texto: 'Ativos e pendentes' }),
          el('option', { value: 'ativo', texto: 'Somente ativos' }),
          el('option', { value: 'pendente', texto: 'Somente pendentes' }),
          el('option', { value: 'trancado', texto: 'Trancados' }),
        ]),
      ]),
    ]),

    area,
  ]);
}
