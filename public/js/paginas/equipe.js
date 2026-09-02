import { api } from '../api.js';
import { el, cartao, tabela, celula, botao, etiqueta, abrirFormulario, aviso, confirmar } from '../ui.js';
import { definirCorPrincipal, aplicarMarca, logotipo, simbolo } from '../marca.js';
import { topo, traduzirPapel } from '../app.js';

const PAPEIS = [
  { valor: 'mestre', rotulo: 'Mestre / professor' },
  { valor: 'recepcao', rotulo: 'Recepção' },
  { valor: 'dono', rotulo: 'Dono da academia' },
];

/** Equipe da academia e dados institucionais mostrados na pagina publica. */
export default async function paginaEquipe() {
  const areaEquipe = el('div');
  const areaConfig = el('div');

  async function carregarEquipe() {
    const usuarios = await api.obter('/usuarios');
    areaEquipe.replaceChildren(tabela(
      ['Nome', 'Função', 'E-mail', 'Telefone', 'Turmas', 'Situação', 'Ações'],
      usuarios.map((usuario) => [
        usuario.nome,
        celula([etiqueta(traduzirPapel(usuario.papel), usuario.papel === 'dono' ? 'alerta' : 'info')]),
        usuario.email,
        usuario.telefone || '-',
        String(usuario.turmas),
        celula([usuario.ativo ? etiqueta('ativo', 'ok') : etiqueta('inativo', 'neutra')]),
        celula([
          botao('Editar', () => formularioUsuario(usuario), 'botao pequeno secundario'),
          botao('Excluir', async () => {
            if (!confirmar(`Excluir o acesso de ${usuario.nome}?`)) return;
            try {
              await api.remover(`/usuarios/${usuario.id}`);
              aviso('Usuário removido.');
              await carregarEquipe();
            } catch (erro) {
              aviso(erro.message, 'erro');
            }
          }, 'botao pequeno perigo'),
        ], 'acoes-celula'),
      ]),
      'Nenhum membro da equipe cadastrado.',
    ));
  }

  function formularioUsuario(usuario = null) {
    abrirFormulario({
      titulo: usuario ? `Editar ${usuario.nome}` : 'Novo acesso da equipe',
      aviso: usuario ? 'Deixe a senha em branco para manter a atual.' : null,
      campos: [
        { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
        { nome: 'email', rotulo: 'E-mail de acesso', tipo: 'email', obrigatorio: true },
        { nome: 'telefone', rotulo: 'Telefone' },
        { nome: 'papel', rotulo: 'Função', tipo: 'select', opcoes: PAPEIS },
        { nome: 'senha', rotulo: usuario ? 'Nova senha (opcional)' : 'Senha', tipo: 'password',
          obrigatorio: !usuario, dica: 'Mínimo de 6 caracteres.' },
        { nome: 'ativo', rotulo: 'Acesso liberado', tipo: 'checkbox', valor: 1 },
      ],
      valores: usuario || { papel: 'mestre' },
      aoSalvar: async (dados) => {
        if (usuario) {
          if (!dados.senha) delete dados.senha;
          await api.atualizar(`/usuarios/${usuario.id}`, dados);
        } else {
          await api.criar('/usuarios', dados);
        }
        aviso('Equipe atualizada.');
        await carregarEquipe();
      },
    });
  }

  async function carregarConfiguracoes() {
    const config = await api.obter('/configuracoes');
    const corInicial = config.cor_primaria || '#e11d2e';

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

    areaConfig.replaceChildren(
      cartaoDaArte(config),
      form,
    );
  }

  /** Envio da arte oficial: o arquivo passa a valer em todo o sistema. */
  function cartaoDaArte(config) {
    const previa = el('div', {
      estilo: 'display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap;padding:1rem;'
        + 'background:var(--plano-2);border:1px solid var(--borda);border-radius:var(--raio-2)',
    }, [simbolo(64), logotipo(38)]);

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
      el('div', { classe: 'dica' },
        ['Use a arte em alta: o logo horizontal aparece no topo do site e do sistema; o brasão vira o ícone do aplicativo.']),
    ]);
  }

  function campo(nome, rotulo, valor) {
    return el('div', { classe: 'campo' }, [
      el('label', { texto: rotulo }),
      el('input', { name: nome, value: valor || '' }),
    ]);
  }

  await Promise.all([carregarEquipe(), carregarConfiguracoes()]);

  return el('div', {}, [
    topo('Equipe e academia', 'Acessos de mestres e recepção, e os dados que aparecem na página pública',
      [botao('+ Novo acesso', () => formularioUsuario())]),
    cartao('Equipe', areaEquipe),
    cartao('Identidade visual e dados da academia', areaConfig),
  ]);
}
