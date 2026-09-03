import { api, sessao, consulta } from '../api.js';
import {
  el, cartao, tabela, celula, botao, etiqueta, etiquetaStatus, moeda, dataBr, competenciaBr,
  abrirFormulario, abrirModal, aviso, confirmar, vazio, idade, hojeISO,
} from '../ui.js';
import { icone } from '../icones.js';
import { linkWhatsapp, mensagemCobranca } from '../whatsapp.js';
import { marca } from '../marca.js';
import { topo } from '../app.js';

/** Cadastro e acompanhamento dos alunos da academia. */
export default async function paginaAlunos() {
  const podeGerir = sessao.ehUm('dono', 'recepcao');
  const [modalidades, planos, turmas] = await Promise.all([
    api.obter('/modalidades?todas=1'),
    api.obter('/planos'),
    api.obter('/turmas'),
  ]);

  const filtros = { busca: '', status: '', categoria: '', inadimplente: '' };
  const area = el('div');

  async function carregar() {
    area.replaceChildren(el('div', { classe: 'carregando', texto: 'Carregando alunos...' }));
    const lista = await api.obter(`/alunos${consulta(filtros)}`);
    area.replaceChildren(cartao(
      `${lista.length} aluno(s)`,
      tabela(
        ['Aluno', 'Situação', 'Plano', 'Contato', 'Pagamento', 'Ações'],
        lista.map((aluno) => [
          // Categoria e idade moram junto do nome: uma coluna a menos na tabela.
          celula([
            el('strong', { texto: aluno.nome }),
            el('div', { classe: 'dica' }, [
              [aluno.categoria, aluno.data_nascimento ? `${idade(aluno.data_nascimento)} anos` : null]
                .filter(Boolean).join(' · '),
            ]),
          ]),
          celula([etiquetaStatus(aluno.status)]),
          aluno.plano || '-',
          aluno.telefone || aluno.email || '-',
          celula([
            aluno.mensalidades_atrasadas
              ? etiqueta(`${aluno.mensalidades_atrasadas} em atraso`, 'erro')
              : etiqueta('em dia', 'ok'),
            aluno.mensalidades_atrasadas && linkWhatsapp(aluno.telefone)
              ? el('a', {
                classe: 'botao pequeno secundario', target: '_blank', rel: 'noopener', texto: 'Cobrar',
                href: linkWhatsapp(aluno.telefone, mensagemCobranca({
                  aluno: aluno.nome,
                  competencia: 'em aberto',
                  valor: 'sua mensalidade',
                  vencimento: 'já',
                  academia: marca.nome,
                })),
              })
              : null,
          ]),
          celula([
            botao('Ficha', () => abrirFicha(aluno.id), 'botao pequeno secundario'),
            podeGerir ? botao('Editar', () => formularioAluno(aluno), 'botao pequeno secundario') : null,
            podeGerir ? botao('Matricular', () => formularioMatricula(aluno), 'botao pequeno secundario') : null,
          ].filter(Boolean), 'acoes-celula'),
        ]),
        'Nenhum aluno encontrado com esses filtros.',
      ),
    ));
  }

  function formularioAluno(aluno = null) {
    abrirFormulario({
      titulo: aluno ? `Editar ${aluno.nome}` : 'Novo aluno',
      campos: [
        { nome: 'nome', rotulo: 'Nome completo', obrigatorio: true },
        { nome: 'email', rotulo: 'E-mail', tipo: 'email' },
        { nome: 'telefone', rotulo: 'Telefone / WhatsApp' },
        { nome: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'date', max: hojeISO() },
        { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: [
          { valor: 'adulto', rotulo: 'Adulto' }, { valor: 'kids', rotulo: 'Kids' }] },
        { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [
          { valor: 'ativo', rotulo: 'Ativo' }, { valor: 'pendente', rotulo: 'Pendente' },
          { valor: 'trancado', rotulo: 'Trancado' }, { valor: 'inativo', rotulo: 'Inativo' }] },
        { nome: 'responsavel_nome', rotulo: 'Responsável (kids)' },
        { nome: 'responsavel_telefone', rotulo: 'Telefone do responsável' },
        { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea' },
        ...(aluno ? [] : [{ nome: 'senha', rotulo: 'Senha de acesso (opcional)', tipo: 'password',
          dica: 'Informe e-mail e senha para já criar o login do aluno.' }]),
      ],
      valores: aluno || { categoria: 'adulto', status: 'ativo' },
      aoSalvar: async (dados) => {
        if (aluno) await api.atualizar(`/alunos/${aluno.id}`, dados);
        else await api.criar('/alunos', dados);
        aviso(aluno ? 'Aluno atualizado.' : 'Aluno cadastrado.');
        await carregar();
      },
    });
  }

  function formularioMatricula(aluno) {
    const ativos = planos.filter((p) => p.ativo);
    if (!ativos.length) return aviso('Cadastre um plano antes de matricular.', 'erro');
    abrirFormulario({
      titulo: `Matricular ${aluno.nome}`,
      aviso: 'A matrícula ativa o aluno, encerra o plano anterior e já gera a primeira mensalidade.',
      campos: [
        { nome: 'plano_id', rotulo: 'Plano', tipo: 'select', obrigatorio: true,
          opcoes: ativos.map((p) => ({ valor: p.id, rotulo: `${p.nome} - ${moeda(p.valor)} (${p.periodicidade})` })) },
        { nome: 'valor', rotulo: 'Valor combinado', tipo: 'number', passo: '0.01',
          dica: 'Deixe em branco para usar o valor do plano.' },
        { nome: 'inicio', rotulo: 'Inicio', tipo: 'date', valor: hojeISO() },
        { nome: 'dia_vencimento', rotulo: 'Dia de vencimento', tipo: 'number', min: 1, max: 28, valor: 10 },
      ],
      aoSalvar: async (dados) => {
        if (!dados.valor) delete dados.valor;
        await api.criar('/matriculas', { ...dados, aluno_id: aluno.id });
        aviso('Matrícula realizada.');
        await carregar();
      },
    });
  }

  async function abrirFicha(alunoId) {
    const aluno = await api.obter(`/alunos/${alunoId}`);
    const conteudo = el('div');
    const { fechar } = abrirModal({ titulo: `Ficha de ${aluno.nome}`, conteudo, largura: '760px' });

    function desenharFicha(dados) {
      conteudo.replaceChildren(
        el('div', { classe: 'grade col-3', estilo: 'margin-bottom:1rem' }, [
          bloco('Situação', etiquetaStatus(dados.status)),
          bloco('Categoria', dados.categoria),
          bloco('Idade', dados.data_nascimento ? `${idade(dados.data_nascimento)} anos` : '-'),
          bloco('Plano atual', dados.plano || 'sem plano'),
          bloco('Matriculado em', dataBr(dados.matriculado_em)),
          bloco('Contato', dados.telefone || dados.email || '-'),
        ]),
        dados.responsavel_nome
          ? el('p', { classe: 'dica', texto: `Responsável: ${dados.responsavel_nome} · ${dados.responsavel_telefone || ''}` })
          : null,
        dados.observacoes ? el('p', { classe: 'dica', texto: `Observações: ${dados.observacoes}` }) : null,

        cartao('Turmas', [
          dados.turmas.length
            ? el('div', { classe: 'acoes', estilo: 'margin-bottom:.6rem' }, dados.turmas.map((t) => el('span', {
              classe: 'etiqueta info',
            }, [`${t.modalidade} · ${t.nome} `, botao('×', async () => {
              await api.remover(`/turmas/${t.id}/alunos/${dados.id}`);
              desenharFicha(await api.obter(`/alunos/${dados.id}`));
            }, 'botao pequeno perigo')])))
            : vazio('Ainda não esta em nenhuma turma.'),
          sessao.ehUm('dono', 'recepcao', 'mestre')
            ? botao('Incluir em uma turma', () => incluirEmTurma(dados), 'botao pequeno')
            : null,
        ]),

        cartao('Graduações', [
          dados.graduacoes.length
            ? tabela(['Data', 'Modalidade', 'Graduação'],
              dados.graduacoes.map((g) => [dataBr(g.data), g.modalidade, g.graduacao]))
            : vazio('Nenhuma graduação registrada.'),
          sessao.ehUm('dono', 'mestre')
            ? botao('Registrar graduação', () => registrarGraduacao(dados), 'botao pequeno')
            : null,
        ]),

        cartao('Mensalidades', dados.mensalidades.length
          ? tabela(['Competência', 'Vencimento', 'Valor', 'Situação'],
            dados.mensalidades.map((m) => [
              competenciaBr(m.competencia), dataBr(m.vencimento), moeda(m.valor),
              celula([m.status === 'pendente' && m.vencimento < hojeISO()
                ? etiqueta('atrasada', 'erro') : etiquetaStatus(m.status)]),
            ]))
          : vazio('Sem mensalidades geradas.')),

        cartao('Últimas presenças', dados.presencas.length
          ? tabela(['Data', 'Turma', 'Presença'],
            dados.presencas.map((p) => [
              dataBr(p.data), `${p.modalidade} · ${p.turma}`,
              celula([p.presente ? etiqueta('presente', 'ok') : etiqueta('falta', 'erro')]),
            ]))
          : vazio('Nenhuma chamada registrada.')),

        sessao.papel === 'dono'
          ? botao('Excluir aluno', async () => {
            if (!confirmar(`Excluir ${dados.nome} e todo o historico? Essa ação não pode ser desfeita.`)) return;
            await api.remover(`/alunos/${dados.id}`);
            aviso('Aluno excluído.');
            fechar();
            await carregar();
          }, 'botao perigo')
          : null,
      );
    }

    function incluirEmTurma(dados) {
      abrirFormulario({
        titulo: 'Incluir em turma',
        campos: [{ nome: 'turma_id', rotulo: 'Turma', tipo: 'select', obrigatorio: true,
          opcoes: turmas.filter((t) => t.ativo).map((t) => ({
            valor: t.id, rotulo: `${t.modalidade} · ${t.nome} (${t.categoria}) - ${t.total_alunos}/${t.capacidade}`,
          })) }],
        aoSalvar: async ({ turma_id }) => {
          await api.criar(`/turmas/${turma_id}/alunos`, { aluno_id: dados.id });
          aviso('Aluno incluído na turma.');
          desenharFicha(await api.obter(`/alunos/${dados.id}`));
        },
      });
    }

    async function registrarGraduacao(dados) {
      abrirFormulario({
        titulo: 'Registrar graduação',
        aviso: 'A lista de faixas segue a modalidade escolhida em Turmas e modalidades.',
        campos: [
          { nome: 'graduacao_id', rotulo: 'Graduação', tipo: 'select', obrigatorio: true,
            opcoes: await opcoesGraduacoes(modalidades) },
          { nome: 'data', rotulo: 'Data', tipo: 'date', valor: hojeISO() },
          { nome: 'observacao', rotulo: 'Observação' },
        ],
        aoSalvar: async (valores) => {
          await api.criar(`/alunos/${dados.id}/graduacoes`, valores);
          aviso('Graduação registrada.');
          desenharFicha(await api.obter(`/alunos/${dados.id}`));
        },
      });
    }

    desenharFicha(aluno);
  }

  const campoBusca = el('input', {
    placeholder: 'Nome, e-mail ou telefone',
    aoDigitar: (evento) => { filtros.busca = evento.target.value; agendarBusca(); },
  });
  let temporizador;
  function agendarBusca() {
    clearTimeout(temporizador);
    temporizador = setTimeout(carregar, 300);
  }

  await carregar();

  return el('div', {}, [
    topo('Alunos', 'Cadastro, matrícula, turmas e histórico de cada aluno',
      sessao.ehUm('dono', 'recepcao') ? [botao('+ Novo aluno', () => formularioAluno())] : []),
    el('p', { classe: 'explicacao' }, [
      icone('alunos', 16),
      'Cada aluno tem ficha completa: plano, turmas, mensalidades, graduações e frequência. Use os filtros para achar quem está devendo, quem sumiu do treino ou quem acabou de chegar.',
    ]),
    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [el('label', { texto: 'Buscar' }), campoBusca]),
      seletor('Situação', ['', 'ativo', 'pendente', 'trancado', 'inativo'], (valor) => { filtros.status = valor; carregar(); }),
      seletor('Categoria', ['', 'kids', 'adulto'], (valor) => { filtros.categoria = valor; carregar(); }),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Pagamento' }),
        el('select', { aoMudar: (evento) => { filtros.inadimplente = evento.target.value; carregar(); } }, [
          el('option', { value: '', texto: 'Todos' }),
          el('option', { value: '1', texto: 'Somente em atraso' }),
        ]),
      ]),
    ]),
    area,
  ]);
}

async function opcoesGraduacoes(modalidades) {
  const opcoes = [];
  for (const modalidade of modalidades) {
    const faixas = await api.obter(`/modalidades/${modalidade.id}/graduacoes`);
    for (const faixa of faixas) {
      opcoes.push({ valor: faixa.id, rotulo: `${modalidade.nome} - ${faixa.nome}` });
    }
  }
  return opcoes;
}

function bloco(rotulo, valor) {
  return el('div', {}, [
    el('div', { classe: 'dica', texto: rotulo }),
    valor instanceof Node ? valor : el('strong', { texto: String(valor ?? '-') }),
  ]);
}

function seletor(rotulo, valores, aoMudar) {
  return el('div', { classe: 'campo' }, [
    el('label', { texto: rotulo }),
    el('select', { aoMudar: (evento) => aoMudar(evento.target.value) },
      valores.map((valor) => el('option', { value: valor, texto: valor || 'Todos' }))),
  ]);
}
