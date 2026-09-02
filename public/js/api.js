/** Comunicacao com a API e sessao do usuario logado. */

const CHAVE_TOKEN = 'academia.token';

export const sessao = {
  token: localStorage.getItem(CHAVE_TOKEN) || null,
  usuario: null,

  salvar(token, usuario) {
    this.token = token;
    this.usuario = usuario;
    localStorage.setItem(CHAVE_TOKEN, token);
  },

  encerrar() {
    this.token = null;
    this.usuario = null;
    localStorage.removeItem(CHAVE_TOKEN);
  },

  get papel() {
    return this.usuario?.papel ?? null;
  },

  ehUm(...papeis) {
    return papeis.includes(this.papel);
  },
};

export class ErroApi extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

async function requisicao(metodo, caminho, corpo) {
  const resposta = await fetch(`/api${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(sessao.token ? { Authorization: `Bearer ${sessao.token}` } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    // Token expirado ou inválido: derruba a sessão e volta para o login.
    if (resposta.status === 401 && sessao.token) {
      sessao.encerrar();
      window.location.hash = '#/entrar';
    }
    throw new ErroApi(dados.erro || 'Não foi possível completar a operação.', resposta.status);
  }
  return dados;
}

export const api = {
  obter: (caminho) => requisicao('GET', caminho),
  criar: (caminho, corpo) => requisicao('POST', caminho, corpo ?? {}),
  atualizar: (caminho, corpo) => requisicao('PUT', caminho, corpo ?? {}),
  remover: (caminho) => requisicao('DELETE', caminho),
};

/** Monta uma query string ignorando valores vazios. */
export function consulta(parametros) {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros || {})) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, valor);
  }
  const texto = busca.toString();
  return texto ? `?${texto}` : '';
}
