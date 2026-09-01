import { api } from '../api.js';
import { el, cartao, tabela, celula, botao, etiqueta, abrirFormulario, aviso, confirmar, dataHoraBr } from '../ui.js';
import { topo, traduzirPapel } from '../app.js';

const PAPEIS = [
  { valor: 'mestre', rotulo: 'Mestre / professor' },
  { valor: 'recepcao', rotulo: 'Recepcao' },
  { valor: 'dono', rotulo: 'Dono da academia' },
];

/** Equipe da academia e dados institucionais mostrados na pagina publica. */
export default async function paginaEquipe() {
  const areaEquipe = el('div');
  const areaConfig = el('div');

  async function carregarEquipe() {
    const usuarios = await api.obter('/usuarios');
    areaEquipe.replaceChildren(tabela(
      ['Nome', 'Funcao', 'E-mail', 'Telefone', 'Turmas', 'Situacao', 'Acoes'],
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
              aviso('Usuario removido.');
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
          obrigatorio: !usuario, dica: 'Minimo de 6 caracteres.' },
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
    const form = el('form', {}, [
      el('div', { classe: 'linha' }, [
        campo('nome_academia', 'Nome da academia', config.nome_academia),
        campo('telefone', 'Telefone / WhatsApp', config.telefone),
      ]),
      el('div', { classe: 'linha' }, [
        campo('endereco', 'Endereco', config.endereco),
        campo('instagram', 'Instagram', config.instagram),
      ]),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Sobre a academia (aparece na pagina publica)' }),
        el('textarea', { name: 'sobre', value: config.sobre || '' }),
      ]),
      el('button', { classe: 'botao', type: 'submit', texto: 'Salvar dados da academia' }),
    ]);

    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      await api.atualizar('/configuracoes', Object.fromEntries(new FormData(form).entries()));
      aviso('Dados da academia atualizados.');
    });
    areaConfig.replaceChildren(form);
  }

  function campo(nome, rotulo, valor) {
    return el('div', { classe: 'campo' }, [
      el('label', { texto: rotulo }),
      el('input', { name: nome, value: valor || '' }),
    ]);
  }

  await Promise.all([carregarEquipe(), carregarConfiguracoes()]);

  return el('div', {}, [
    topo('Equipe e academia', 'Acessos de mestres e recepcao, e os dados que aparecem na pagina publica',
      [botao('+ Novo acesso', () => formularioUsuario())]),
    cartao('Equipe', areaEquipe),
    cartao('Dados da academia', areaConfig),
    el('p', { classe: 'dica', texto: `Ultima atualizacao desta tela: ${dataHoraBr(new Date().toLocaleString('sv-SE'))}` }),
  ]);
}
