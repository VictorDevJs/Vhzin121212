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
      ['Nome', 'Funcao', 'E-mail', 'Telefone', 'Turmas', 'Situação', 'Ações'],
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
        { nome: 'papel', rotulo: 'Funcao', tipo: 'select', opcoes: PAPEIS },
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
        campo('ano_fundacao', 'Ano de fundacao', config.ano_fundacao),
        campo('horario_funcionamento', 'Horário de funcionamento', config.horario_funcionamento),
      ]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Nossa história (secao da pagina publica)' }),
        el('textarea', { name: 'historia', value: config.historia || '' }),
      ]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Sobre a academia (texto da pagina publica)' }),
        el('textarea', { name: 'sobre', value: config.sobre || '' }),
      ]),
      el('div', { classe: 'linha' }, [
        el('div', { classe: 'campo' }, [
          el('label', { texto: 'Cor principal da marca' }),
          entradaCor,
          el('div', { classe: 'dica', texto: 'A tela inteira muda junto enquanto você escolhe.' }),
        ]),
        el('div', { classe: 'campo' }, [
          el('label', { texto: 'Previa' }),
          el('div', { classe: 'acoes', estilo: 'padding-top:.3rem' }, [
            el('span', { classe: 'botao pequeno', texto: 'Botao' }),
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
      el('div', { classe: 'acoes', estilo: 'margin-bottom:1rem' }, [
        simbolo(46), logotipo(30),
        el('span', { classe: 'dica', texto: 'Troque os arquivos em public/marca/ (logo.svg e simbolo.svg) para usar a arte oficial.' }),
      ]),
      form,
    );
  }

  function campo(nome, rotulo, valor) {
    return el('div', { classe: 'campo' }, [
      el('label', { texto: rotulo }),
      el('input', { name: nome, value: valor || '' }),
    ]);
  }

  await Promise.all([carregarEquipe(), carregarConfiguracoes()]);

  return el('div', {}, [
    topo('Equipe e academia', 'Acessos de mestres e recepção, e os dados que aparecem na pagina publica',
      [botao('+ Novo acesso', () => formularioUsuario())]),
    cartao('Equipe', areaEquipe),
    cartao('Identidade visual e dados da academia', areaConfig),
  ]);
}
