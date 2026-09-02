import { api, sessao } from '../api.js';
import {
  el, cartao, botao, etiqueta, etiquetaCor, dataBr,
  abrirFormulario, abrirModal, aviso, confirmar, vazio, opcoesDe,
} from '../ui.js';
import { definirCorPrincipal, aplicarMarca, logotipo, simbolo, iniciais } from '../marca.js';
import { icone } from '../icones.js';
import { topo, traduzirPapel } from '../app.js';

const PAPEIS = [
  { valor: 'mestre', rotulo: 'Mestre / professor' },
  { valor: 'recepcao', rotulo: 'Recepção' },
  { valor: 'competicoes', rotulo: 'Responsável de Competições' },
  { valor: 'dono', rotulo: 'Dono da academia' },
];

const COR_PAPEL = { dono: 'alerta', mestre: 'info', competicoes: 'ok', recepcao: 'neutra' };

/**
 * Equipe da academia: quem ensina, quem atende e quem responde por cada área.
 * Aqui o dono cadastra e remove mestres, define cargos e ajusta a identidade
 * visual que aparece no site, no sistema e no aplicativo.
 */
export default async function paginaEquipe() {
  const ehDono = sessao.papel === 'dono';
  const [modalidades, cargosDisponiveis] = await Promise.all([
    api.obter('/modalidades'),
    api.obter('/usuarios/cargos'),
  ]);

  const areaEquipe = el('div');
  const areaConfig = el('div');
  let equipe = [];

  /* ------------------------------------------------------------- equipe */

  async function carregarEquipe() {
    equipe = await api.obter('/usuarios');
    areaEquipe.replaceChildren(equipe.length
      ? el('div', { classe: 'grade col-3' }, equipe.map(cartaoPessoa))
      : vazio('Nenhum membro da equipe cadastrado.'));
  }

  function cartaoPessoa(pessoa) {
    return el('article', { classe: 'cartao pessoa tilt' }, [
      el('div', { classe: 'cabecalho-pessoa' }, [
        retrato(pessoa),
        el('div', { classe: 'dados-pessoa' }, [
          el('h3', { texto: pessoa.apelido || pessoa.nome }),
          el('span', { classe: 'legenda', texto: pessoa.faixa || pessoa.email }),
        ]),
      ]),

      el('div', { classe: 'acoes', estilo: 'margin:.6rem 0' }, [
        etiqueta(traduzirPapel(pessoa.papel), COR_PAPEL[pessoa.papel] || 'neutra'),
        pessoa.ativo ? null : etiqueta('acesso bloqueado', 'erro'),
        pessoa.publicar_site ? null : etiqueta('fora do site', 'neutra'),
      ].filter(Boolean)),

      pessoa.bio ? el('p', { classe: 'bio', texto: pessoa.bio }) : null,

      (pessoa.modalidades || []).length
        ? el('div', { classe: 'acoes' }, pessoa.modalidades.map((m) => etiquetaCor(m.nome, m.cor)))
        : null,

      (pessoa.cargos || []).length
        ? el('div', { classe: 'acoes' }, pessoa.cargos.map((c) => etiqueta(
          `${rotuloCargo(c.cargo)}${c.modalidade ? ` · ${c.modalidade}` : ''}`, 'ok')))
        : null,

      el('dl', { classe: 'ficha' }, [
        linha('E-mail', pessoa.email),
        linha('Telefone', pessoa.telefone || '-'),
        linha('Turmas', `${pessoa.turmas} turma(s) ativa(s)`),
        pessoa.desde ? linha('Na academia desde', dataBr(pessoa.desde)) : null,
      ].filter(Boolean)),

      el('div', { classe: 'acoes' }, [
        botao('Editar', () => formularioUsuario(pessoa), 'botao pequeno secundario'),
        botao('Cargos', () => gerenciarCargos(pessoa), 'botao pequeno secundario'),
        pessoa.papel === 'dono' ? null : botao('Remover', () => remover(pessoa), 'botao pequeno perigo'),
      ].filter(Boolean)),
    ]);
  }

  function retrato(pessoa) {
    if (pessoa.foto) {
      return el('img', {
        classe: 'retrato', src: pessoa.foto, alt: `Foto de ${pessoa.nome}`, loading: 'lazy',
      });
    }
    return el('span', { classe: 'retrato vazio', texto: iniciais(pessoa.nome) });
  }

  function linha(rotulo, valor) {
    return el('div', { classe: 'linha-ficha' }, [
      el('dt', { texto: rotulo }),
      el('dd', { texto: valor }),
    ]);
  }

  function rotuloCargo(valor) {
    return cargosDisponiveis.find((c) => c.valor === valor)?.rotulo || valor;
  }

  async function remover(pessoa) {
    if (!confirmar(`Remover ${pessoa.nome} da equipe? O acesso dele ao sistema acaba na hora.`)) return;
    try {
      await api.remover(`/usuarios/${pessoa.id}`);
      aviso(`${pessoa.nome} foi removido da equipe.`);
      await carregarEquipe();
    } catch (erro) {
      aviso(erro.message, 'erro');
    }
  }

  function formularioUsuario(pessoa = null) {
    abrirFormulario({
      titulo: pessoa ? `Editar ${pessoa.nome}` : 'Cadastrar mestre ou membro da equipe',
      aviso: pessoa
        ? 'Deixe a senha em branco para manter a atual.'
        : 'O mestre entra no sistema com este e-mail e senha. A foto e a biografia aparecem na página pública.',
      campos: [
        { nome: 'nome', rotulo: 'Nome completo', obrigatorio: true },
        { nome: 'apelido', rotulo: 'Como ele é chamado no tatame', placeholder: 'Mestre Ricardo, Sensei Paulo...' },
        { nome: 'email', rotulo: 'E-mail de acesso', tipo: 'email', obrigatorio: true },
        { nome: 'telefone', rotulo: 'Telefone / WhatsApp' },
        { nome: 'papel', rotulo: 'Função no sistema', tipo: 'select', opcoes: PAPEIS },
        { nome: 'faixa', rotulo: 'Graduação e titulação',
          placeholder: 'Faixa preta 4º grau de Jiu-Jitsu' },
        { nome: 'modalidades', rotulo: 'Artes marciais que ele ensina', tipo: 'multi',
          opcoes: opcoesDe(modalidades),
          valor: (pessoa?.modalidades || []).map((m) => m.id) },
        { nome: 'bio', rotulo: 'Biografia (aparece no site)', tipo: 'textarea',
          placeholder: 'Formação, federação, tempo de tatame e conquistas.' },
        { nome: 'desde', rotulo: 'Na academia desde', tipo: 'date' },
        { nome: 'instagram', rotulo: 'Instagram', placeholder: '@mestrericardo' },
        { nome: 'foto_nova', rotulo: 'Foto do mestre', tipo: 'arquivo', aceita: 'image/*',
          dica: 'JPG, PNG ou WEBP de até 5 MB. Enquadre o rosto no centro.' },
        { nome: 'senha', rotulo: pessoa ? 'Nova senha (opcional)' : 'Senha de acesso', tipo: 'password',
          obrigatorio: !pessoa, dica: 'Mínimo de 6 caracteres.' },
        { nome: 'publicar_site', rotulo: 'Mostrar na página pública da academia', tipo: 'checkbox', valor: 1 },
        { nome: 'ativo', rotulo: 'Acesso liberado', tipo: 'checkbox', valor: 1 },
      ],
      valores: pessoa || { papel: 'mestre', ativo: 1, publicar_site: 1 },
      aoSalvar: async (dados) => {
        if (dados.foto_nova) {
          const enviada = await api.criar('/arquivos', { conteudo: dados.foto_nova });
          dados.foto = enviada.url;
        }
        delete dados.foto_nova;
        if (pessoa && !dados.senha) delete dados.senha;

        if (pessoa) await api.atualizar(`/usuarios/${pessoa.id}`, dados);
        else await api.criar('/usuarios', dados);
        aviso('Equipe atualizada.');
        await carregarEquipe();
      },
    });
  }

  /* -------------------------------------------------------------- cargos */

  function gerenciarCargos(pessoa) {
    const corpo = el('div');

    function desenhar(atual) {
      corpo.replaceChildren(
        el('p', { classe: 'explicacao' }, [
          icone('escudo', 16),
          `Cargos são responsabilidades extras. ${atual.apelido || atual.nome} continua sendo `
          + `${traduzirPapel(atual.papel).toLowerCase()} e ganha acesso à área do cargo. `
          + 'Um cargo pode valer para todas as modalidades ou só para uma.',
        ]),

        (atual.cargos || []).length
          ? el('div', { classe: 'lista-cargos' }, atual.cargos.map((c) => el('div', { classe: 'item-cargo' }, [
            el('div', {}, [
              el('strong', { texto: rotuloCargo(c.cargo) }),
              el('span', { classe: 'dica', texto: c.modalidade ? `Só em ${c.modalidade}` : 'Todas as modalidades' }),
            ]),
            botao('Retirar', async () => {
              if (!confirmar(`Retirar o cargo de ${rotuloCargo(c.cargo)}?`)) return;
              const salvo = await api.remover(`/usuarios/${atual.id}/cargos/${c.id}`);
              aviso('Cargo retirado.');
              desenhar(salvo);
              carregarEquipe();
            }, 'botao pequeno perigo'),
          ])))
          : vazio('Esta pessoa ainda não tem nenhum cargo extra.'),

        el('div', { classe: 'acoes', estilo: 'margin-top:.9rem' }, [
          botao('+ Atribuir cargo', () => atribuir(atual)),
        ]),

        cartao('O que cada cargo libera', el('dl', { classe: 'ficha' },
          cargosDisponiveis.map((c) => el('div', { classe: 'linha-ficha' }, [
            el('dt', { texto: c.rotulo }),
            el('dd', { texto: c.descricao }),
          ])))),
      );
    }

    function atribuir(atual) {
      abrirFormulario({
        titulo: `Atribuir cargo a ${atual.nome}`,
        campos: [
          { nome: 'cargo', rotulo: 'Cargo', tipo: 'select',
            opcoes: cargosDisponiveis.map((c) => ({ valor: c.valor, rotulo: c.rotulo })) },
          { nome: 'modalidade_id', rotulo: 'Vale para qual modalidade', tipo: 'select',
            opcoes: [{ valor: '', rotulo: 'Todas as modalidades' }, ...opcoesDe(modalidades)] },
          { nome: 'observacao', rotulo: 'Observação', placeholder: 'Combinado, prazo, limite...' },
        ],
        valores: { cargo: 'competicoes' },
        aoSalvar: async (dados) => {
          const salvo = await api.criar(`/usuarios/${atual.id}/cargos`, dados);
          aviso('Cargo atribuído.');
          desenhar(salvo);
          await carregarEquipe();
        },
      });
    }

    desenhar(pessoa);
    abrirModal({ titulo: `Cargos de ${pessoa.nome}`, conteudo: corpo, largura: '680px' });
  }

  /* --------------------------------------------------- identidade visual */

  async function carregarConfiguracoes() {
    const config = await api.obter('/configuracoes');
    const corInicial = config.cor_primaria || '#f5b301';

    const entradaCor = el('input', {
      type: 'color', name: 'cor_primaria', value: corInicial,
      aoDigitar: (evento) => definirCorPrincipal(evento.target.value),
    });

    const form = el('form', {}, [
      el('div', { classe: 'linha' }, [
        campo('nome_academia', 'Nome da academia', config.nome_academia),
        campo('chamada', 'Frase de efeito (aparece no topo do site)', config.chamada),
      ]),
      el('div', { classe: 'linha' }, [
        campo('telefone', 'Telefone', config.telefone),
        campo('whatsapp', 'WhatsApp (só números, com DDD)', config.whatsapp),
      ]),
      el('div', { classe: 'linha' }, [
        campo('endereco', 'Endereço', config.endereco),
        campo('instagram', 'Instagram', config.instagram),
      ]),
      el('div', { classe: 'linha' }, [
        campo('ano_fundacao', 'Ano de fundação', config.ano_fundacao),
        campo('horario_funcionamento', 'Horário de funcionamento', config.horario_funcionamento),
      ]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Nossa história (seção da página pública)' }),
        el('textarea', { name: 'historia', value: config.historia || '' }),
      ]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Sobre a academia (texto da página pública)' }),
        el('textarea', { name: 'sobre', value: config.sobre || '' }),
      ]),
      el('div', { classe: 'linha' }, [
        el('div', { classe: 'campo' }, [
          el('label', { texto: 'Cor principal da marca' }),
          entradaCor,
          el('div', { classe: 'dica', texto: 'A tela inteira muda junto enquanto você escolhe.' }),
        ]),
        el('div', { classe: 'campo' }, [
          el('label', { texto: 'Prévia' }),
          el('div', { classe: 'acoes', estilo: 'padding-top:.3rem' }, [
            el('span', { classe: 'botao pequeno', texto: 'Botão' }),
            etiqueta('destaque', 'marca'),
            el('span', { classe: 'avatar', texto: 'A' }),
          ]),
        ]),
      ]),
      el('button', { classe: 'botao', type: 'submit', texto: 'Salvar identidade da academia' }),
    ]);

    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const valores = Object.fromEntries(new FormData(form).entries());
      const salvo = await api.atualizar('/configuracoes', valores);
      aplicarMarca({ nome: salvo.nome_academia, chamada: salvo.chamada, cor_primaria: salvo.cor_primaria });
      aviso('Identidade da academia atualizada.');
    });

    areaConfig.replaceChildren(cartaoDaArte(config), form);
  }

  /** Envio da arte oficial: o arquivo passa a valer em todo o sistema. */
  function cartaoDaArte(config) {
    const previa = el('div', { classe: 'previa-marca' }, [simbolo(64), logotipo(38)]);

    async function enviar(chave, rotuloArquivo) {
      abrirFormulario({
        titulo: `Enviar ${rotuloArquivo}`,
        aviso: 'Aceita SVG, PNG, JPG ou WEBP de até 5 MB. O arquivo passa a ser usado no site, no sistema e no ícone do app.',
        campos: [{ nome: 'arquivo', rotulo: rotuloArquivo, tipo: 'arquivo', aceita: 'image/*', obrigatorio: true }],
        textoConfirmar: 'Enviar',
        aoSalvar: async (dados) => {
          if (!dados.arquivo) throw new Error('Escolha um arquivo.');
          const enviado = await api.criar('/arquivos', { conteudo: dados.arquivo });
          const salvo = await api.atualizar('/configuracoes', { [chave]: enviado.url });
          aplicarMarca({ nome: salvo.nome_academia, logo_url: salvo.logo_url, simbolo_url: salvo.simbolo_url });
          aviso('Arte atualizada. Ela já está valendo em todas as telas.');
          await carregarConfiguracoes();
        },
      });
    }

    return el('div', { classe: 'campo' }, [
      el('label', { texto: 'Arte oficial da academia' }),
      previa,
      el('div', { classe: 'acoes', estilo: 'margin-top:.75rem' }, [
        botao('Enviar logo horizontal', () => enviar('logo_url', 'Logo horizontal'), 'botao secundario'),
        botao('Enviar brasão / ícone', () => enviar('simbolo_url', 'Brasão quadrado'), 'botao secundario'),
        config.logo_url || config.simbolo_url
          ? botao('Voltar para a arte padrão', async () => {
            if (!confirmar('Voltar a usar o desenho padrão do sistema?')) return;
            const salvo = await api.atualizar('/configuracoes', { logo_url: '', simbolo_url: '' });
            aplicarMarca({ nome: salvo.nome_academia, logo_url: '', simbolo_url: '' });
            aviso('Arte padrão restaurada.');
            await carregarConfiguracoes();
          }, 'botao perigo')
          : null,
      ].filter(Boolean)),
      el('div', { classe: 'dica', texto:
        'Envie a arte em alta: o logo horizontal aparece no topo do site e do sistema; '
        + 'o brasão vira o ícone do aplicativo e a marca-d’água das telas.' }),
    ]);
  }

  function campo(nome, rotulo, valor) {
    return el('div', { classe: 'campo' }, [
      el('label', { texto: rotulo }),
      el('input', { name: nome, value: valor || '' }),
    ]);
  }

  await Promise.all([carregarEquipe(), ehDono ? carregarConfiguracoes() : Promise.resolve()]);

  return el('div', {}, [
    topo('Equipe e academia',
      'Cadastro de mestres e da recepção, cargos de responsabilidade e a identidade que aparece no site',
      [botao('+ Cadastrar mestre', () => formularioUsuario())]),

    el('p', { classe: 'explicacao' }, [
      icone('alunos', 16),
      'Cada pessoa da equipe tem uma função no sistema (mestre, recepção, competições) e pode acumular cargos '
      + 'de responsabilidade por área ou por modalidade. A foto e a biografia que você preencher aqui aparecem '
      + 'na página pública da academia.',
    ]),

    cartao('Equipe da academia', areaEquipe),
    ehDono ? cartao('Identidade visual e dados da academia', areaConfig) : null,
  ].filter(Boolean));
}
