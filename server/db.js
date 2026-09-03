import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Camada de acesso ao banco. Usa o SQLite embutido no Node (>= 22.5),
 * portanto nao precisa de nenhuma dependencia nativa para rodar.
 */

let db = null;

export function abrirBanco(arquivo = process.env.DB_ARQUIVO || './dados/academia.db') {
  if (db) return db;
  if (arquivo !== ':memory:') {
    mkdirSync(dirname(resolve(arquivo)), { recursive: true });
  }
  db = new DatabaseSync(arquivo);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  criarEsquema(db);
  migrar(db);
  return db;
}

export function conexao() {
  if (!db) return abrirBanco();
  return db;
}

export function fecharBanco() {
  if (db) {
    db.close();
    db = null;
  }
}

/** Executa uma consulta que retorna varias linhas. */
export function todos(sql, params = {}) {
  return conexao().prepare(sql).all(params);
}

/** Executa uma consulta que retorna uma linha (ou undefined). */
export function um(sql, params = {}) {
  return conexao().prepare(sql).get(params);
}

/** Executa INSERT/UPDATE/DELETE e devolve { changes, lastInsertRowid }. */
export function executar(sql, params = {}) {
  return conexao().prepare(sql).run(params);
}

/** Roda varias operacoes dentro de uma transacao. */
export function transacao(fn) {
  const banco = conexao();
  banco.exec('BEGIN');
  try {
    const resultado = fn();
    banco.exec('COMMIT');
    return resultado;
  } catch (erro) {
    banco.exec('ROLLBACK');
    throw erro;
  }
}

/** Colunas acrescentadas depois da primeira versão do banco. */
function migrar(banco) {
  const novas = [
    ['horarios', 'rotulo', 'TEXT'],
    ['horarios', 'observacao', 'TEXT'],
    ['modalidades', 'destaque', 'TEXT'],
    ['modalidades', 'ordem', 'INTEGER NOT NULL DEFAULT 0'],
    ['modalidades', 'imagem', 'TEXT'],
    ['modalidades', 'sigla', 'TEXT'],
    ['usuarios', 'foto', 'TEXT'],
    ['usuarios', 'apelido', 'TEXT'],
    ['usuarios', 'bio', 'TEXT'],
    ['usuarios', 'faixa', 'TEXT'],
    ['usuarios', 'instagram', 'TEXT'],
    ['usuarios', 'desde', 'TEXT'],
    ['usuarios', 'ultimo_acesso', 'TEXT'],
    ['usuarios', 'publicar_site', 'INTEGER NOT NULL DEFAULT 1'],
    ['graduacoes', 'cor_ponta', 'TEXT'],
    ['graduacoes', 'graus', 'INTEGER NOT NULL DEFAULT 0'],
    ['graduacoes', 'idade_minima', 'INTEGER'],
    ['graduacoes', 'tempo_minimo', 'INTEGER NOT NULL DEFAULT 0'],
    ['graduacoes', 'descricao', 'TEXT'],
    ['graduacoes', 'faixa_etaria', `TEXT NOT NULL DEFAULT 'adulto'`],
    ['aluno_graduacoes', 'grau', 'INTEGER NOT NULL DEFAULT 0'],
    ['matriculas', 'suspensa_em', 'TEXT'],
    ['matriculas', 'suspensa_motivo', 'TEXT'],
  ];
  for (const [tabela, coluna, tipo] of novas) {
    const existentes = colunasDe(banco, tabela);
    if (existentes.length && !existentes.includes(coluna)) {
      banco.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
    }
  }

  // Bancos antigos nao aceitavam o papel de competicoes nem avisos so para
  // competidores. Trocar um CHECK no SQLite exige recriar a tabela.
  recriarSeFaltar(banco, 'usuarios', "'competicoes'");
  recriarSeFaltar(banco, 'avisos', "'competidores'");
}

function colunasDe(banco, tabela) {
  return banco.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);
}

/**
 * Recria a tabela com o esquema novo quando o texto procurado nao aparece na
 * definicao guardada pelo SQLite. Segue o roteiro oficial de ALTER TABLE:
 * cria a nova, copia as colunas em comum, troca e religa as chaves.
 */
function recriarSeFaltar(banco, tabela, trecho) {
  const atual = banco.prepare(
    'SELECT sql FROM sqlite_master WHERE type = :tipo AND name = :nome',
    ).get({ tipo: 'table', nome: tabela });
  if (!atual?.sql || atual.sql.includes(trecho)) return;

  const definicao = DEFINICOES[tabela];
  if (!definicao) return;
  const antigas = colunasDe(banco, tabela);

  banco.exec('PRAGMA foreign_keys = OFF');
  banco.exec('BEGIN');
  try {
    banco.exec(definicao.replace(`CREATE TABLE IF NOT EXISTS ${tabela}`, `CREATE TABLE ${tabela}__novo`));
    const destino = colunasDe(banco, `${tabela}__novo`);
    const comuns = antigas.filter((c) => destino.includes(c)).join(', ');
    banco.exec(`INSERT INTO ${tabela}__novo (${comuns}) SELECT ${comuns} FROM ${tabela}`);
    banco.exec(`DROP TABLE ${tabela}`);
    banco.exec(`ALTER TABLE ${tabela}__novo RENAME TO ${tabela}`);
    banco.exec('COMMIT');
  } catch (erro) {
    banco.exec('ROLLBACK');
    throw erro;
  }
  banco.exec('PRAGMA foreign_keys = ON');
}

/** Texto completo do esquema. Serve para criar e para recriar tabelas. */
const ESQUEMA = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nome        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
      senha_hash  TEXT NOT NULL,
      papel       TEXT NOT NULL CHECK (papel IN ('dono','mestre','recepcao','competicoes','aluno')),
      telefone    TEXT,
      ativo       INTEGER NOT NULL DEFAULT 1,
      criado_em   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS modalidades (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nome       TEXT NOT NULL UNIQUE COLLATE NOCASE,
      descricao  TEXT,
      cor        TEXT DEFAULT '#2a78d6',
      destaque   TEXT,
      ordem      INTEGER NOT NULL DEFAULT 0,
      imagem     TEXT,
      ativo      INTEGER NOT NULL DEFAULT 1,
      criado_em  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- Faixas / graduacoes de cada modalidade (ex.: Jiu-Jitsu: branca, azul, roxa...)
    CREATE TABLE IF NOT EXISTS graduacoes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      modalidade_id INTEGER NOT NULL REFERENCES modalidades(id) ON DELETE CASCADE,
      nome          TEXT NOT NULL,
      ordem         INTEGER NOT NULL DEFAULT 0,
      cor           TEXT DEFAULT '#888888',
      cor_ponta     TEXT,
      graus         INTEGER NOT NULL DEFAULT 0,
      faixa_etaria  TEXT NOT NULL DEFAULT 'adulto'
                    CHECK (faixa_etaria IN ('kids','adulto','ambos')),
      idade_minima  INTEGER,
      tempo_minimo  INTEGER NOT NULL DEFAULT 0,
      descricao     TEXT,
      UNIQUE (modalidade_id, nome)
    );

    CREATE TABLE IF NOT EXISTS alunos (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id           INTEGER UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL,
      nome                 TEXT NOT NULL,
      email                TEXT COLLATE NOCASE,
      telefone             TEXT,
      data_nascimento      TEXT,
      categoria            TEXT NOT NULL DEFAULT 'adulto' CHECK (categoria IN ('kids','adulto')),
      responsavel_nome     TEXT,
      responsavel_telefone TEXT,
      observacoes          TEXT,
      status               TEXT NOT NULL DEFAULT 'pendente'
                           CHECK (status IN ('pendente','ativo','inativo','trancado')),
      matriculado_em       TEXT,
      criado_em            TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS turmas (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      modalidade_id INTEGER NOT NULL REFERENCES modalidades(id) ON DELETE CASCADE,
      nome          TEXT NOT NULL,
      categoria     TEXT NOT NULL DEFAULT 'adulto' CHECK (categoria IN ('kids','adulto','misto','feminino')),
      nivel         TEXT NOT NULL DEFAULT 'todos' CHECK (nivel IN ('iniciante','intermediario','avancado','todos')),
      mestre_id     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      capacidade    INTEGER NOT NULL DEFAULT 30,
      local         TEXT,
      idade_minima  INTEGER,
      idade_maxima  INTEGER,
      ativo         INTEGER NOT NULL DEFAULT 1,
      criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS horarios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      turma_id    INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
      dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
      hora_inicio TEXT NOT NULL,
      hora_fim    TEXT NOT NULL,
      rotulo      TEXT,
      observacao  TEXT,
      ativo       INTEGER NOT NULL DEFAULT 1,
      UNIQUE (turma_id, dia_semana, hora_inicio)
    );

    CREATE TABLE IF NOT EXISTS planos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nome          TEXT NOT NULL,
      descricao     TEXT,
      valor         REAL NOT NULL DEFAULT 0,
      periodicidade TEXT NOT NULL DEFAULT 'mensal'
                    CHECK (periodicidade IN ('mensal','trimestral','semestral','anual')),
      aulas_semana  INTEGER NOT NULL DEFAULT 0, -- 0 = ilimitado
      ativo         INTEGER NOT NULL DEFAULT 1,
      criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- Modalidades incluidas no plano. Sem linhas = plano livre (todas).
    CREATE TABLE IF NOT EXISTS plano_modalidades (
      plano_id      INTEGER NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
      modalidade_id INTEGER NOT NULL REFERENCES modalidades(id) ON DELETE CASCADE,
      PRIMARY KEY (plano_id, modalidade_id)
    );

    CREATE TABLE IF NOT EXISTS matriculas (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id       INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
      plano_id       INTEGER NOT NULL REFERENCES planos(id),
      inicio         TEXT NOT NULL,
      fim            TEXT,
      valor          REAL NOT NULL,
      dia_vencimento INTEGER NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 28),
      status         TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','suspensa','encerrada')),
      suspensa_em    TEXT,                        -- quando a cobranca automatica suspendeu
      suspensa_motivo TEXT,                       -- 'inadimplencia' quando foi o sistema
      criado_em      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- Alunos vinculados a cada turma (usado na chamada e no controle de vagas)
    CREATE TABLE IF NOT EXISTS aluno_turmas (
      aluno_id  INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
      turma_id  INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (aluno_id, turma_id)
    );

    CREATE TABLE IF NOT EXISTS mensalidades (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      matricula_id    INTEGER REFERENCES matriculas(id) ON DELETE SET NULL,
      aluno_id        INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
      competencia     TEXT NOT NULL,               -- AAAA-MM
      vencimento      TEXT NOT NULL,
      valor           REAL NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','pago','cancelado')),
      pago_em         TEXT,
      forma_pagamento TEXT,
      observacao      TEXT,
      criado_em       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (aluno_id, competencia)
    );

    -- Todo dinheiro que entra ou sai da academia
    CREATE TABLE IF NOT EXISTS lancamentos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo            TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
      categoria       TEXT NOT NULL,
      descricao       TEXT NOT NULL,
      valor           REAL NOT NULL CHECK (valor >= 0),
      data            TEXT NOT NULL,
      forma_pagamento TEXT,
      aluno_id        INTEGER REFERENCES alunos(id) ON DELETE SET NULL,
      mensalidade_id  INTEGER REFERENCES mensalidades(id) ON DELETE SET NULL,
      registrado_por  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS avisos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo        TEXT NOT NULL,
      mensagem      TEXT NOT NULL,
      tipo          TEXT NOT NULL DEFAULT 'geral'
                    CHECK (tipo IN ('geral','campeonato','evento','cancelamento','manutencao','graduacao')),
      publico       TEXT NOT NULL DEFAULT 'todos'
                    CHECK (publico IN ('todos','kids','adultos','equipe','modalidade','turma','competidores')),
      modalidade_id INTEGER REFERENCES modalidades(id) ON DELETE CASCADE,
      turma_id      INTEGER REFERENCES turmas(id) ON DELETE CASCADE,
      data_evento   TEXT,
      local_evento  TEXT,
      fixado        INTEGER NOT NULL DEFAULT 0,
      publicar_site INTEGER NOT NULL DEFAULT 1,
      ativo         INTEGER NOT NULL DEFAULT 1,
      autor_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS presencas (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id       INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
      turma_id       INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
      data           TEXT NOT NULL,
      presente       INTEGER NOT NULL DEFAULT 1,
      registrado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (aluno_id, turma_id, data)
    );

    CREATE TABLE IF NOT EXISTS aluno_graduacoes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id       INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
      modalidade_id  INTEGER NOT NULL REFERENCES modalidades(id) ON DELETE CASCADE,
      graduacao_id   INTEGER NOT NULL REFERENCES graduacoes(id) ON DELETE CASCADE,
      data           TEXT NOT NULL,
      grau           INTEGER NOT NULL DEFAULT 0,
      observacao     TEXT,
      registrado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
    );

    -- Avaliacoes com estrela e comentario (aluno logado ou visitante do site)
    CREATE TABLE IF NOT EXISTS avaliacoes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id      INTEGER REFERENCES alunos(id) ON DELETE SET NULL,
      autor_nome    TEXT NOT NULL,
      autor_contato TEXT,
      nota          INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
      comentario    TEXT,
      modalidade_id INTEGER REFERENCES modalidades(id) ON DELETE SET NULL,
      mestre_id     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      status        TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','aprovada','recusada')),
      resposta      TEXT,
      respondido_em TEXT,
      origem        TEXT NOT NULL DEFAULT 'site' CHECK (origem IN ('site','aluno')),
      criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- Certificados e titulacoes (faixas pretas, mestres, federacoes, cursos)
    -- Galeria da academia: as fotos que o dono publica no site.
    -- Cada foto pode pertencer a uma arte marcial ou valer para a casa toda.
    CREATE TABLE IF NOT EXISTS fotos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      arquivo       TEXT NOT NULL,
      legenda       TEXT,
      categoria     TEXT NOT NULL DEFAULT 'treino'
                    CHECK (categoria IN ('treino','turma','estrutura','competicao','evento','graduacao','equipe')),
      modalidade_id INTEGER REFERENCES modalidades(id) ON DELETE SET NULL,
      ordem         INTEGER NOT NULL DEFAULT 0,
      destaque      INTEGER NOT NULL DEFAULT 0,
      publicar_site INTEGER NOT NULL DEFAULT 1,
      criado_por    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS certificados (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo        TEXT NOT NULL,
      tipo          TEXT NOT NULL DEFAULT 'faixa_preta'
                    CHECK (tipo IN ('faixa_preta','graduacao','mestre','federacao','curso','premiacao','outro')),
      pessoa_nome   TEXT NOT NULL,
      aluno_id      INTEGER REFERENCES alunos(id) ON DELETE SET NULL,
      usuario_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      modalidade_id INTEGER REFERENCES modalidades(id) ON DELETE SET NULL,
      entidade      TEXT,
      registro      TEXT,
      data_emissao  TEXT,
      descricao     TEXT,
      arquivo       TEXT,
      publicar_site INTEGER NOT NULL DEFAULT 1,
      criado_por    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- Check-in do treino: o aluno confirma presenca na janela da aula
    CREATE TABLE IF NOT EXISTS checkins (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id   INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
      turma_id   INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
      horario_id INTEGER REFERENCES horarios(id) ON DELETE SET NULL,
      data       TEXT NOT NULL,
      hora       TEXT NOT NULL,
      origem     TEXT NOT NULL DEFAULT 'aluno' CHECK (origem IN ('aluno','recepcao','mestre')),
      criado_em  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (aluno_id, turma_id, data)
    );

    -- Loja: produtos por modalidade e acessorios
    CREATE TABLE IF NOT EXISTS produtos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nome          TEXT NOT NULL,
      descricao     TEXT,
      categoria     TEXT NOT NULL DEFAULT 'acessorio',
      modalidade_id INTEGER REFERENCES modalidades(id) ON DELETE SET NULL,
      preco         REAL NOT NULL DEFAULT 0,
      custo         REAL NOT NULL DEFAULT 0,
      estoque       INTEGER NOT NULL DEFAULT 0,
      tamanhos      TEXT,
      imagem        TEXT,
      ativo         INTEGER NOT NULL DEFAULT 1,
      publicar_site INTEGER NOT NULL DEFAULT 1,
      criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS vendas (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id        INTEGER REFERENCES alunos(id) ON DELETE SET NULL,
      cliente_nome    TEXT,
      total           REAL NOT NULL,
      forma_pagamento TEXT,
      data            TEXT NOT NULL,
      observacao      TEXT,
      lancamento_id   INTEGER REFERENCES lancamentos(id) ON DELETE SET NULL,
      registrado_por  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS venda_itens (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id       INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
      produto_id     INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
      nome           TEXT NOT NULL,
      tamanho        TEXT,
      quantidade     INTEGER NOT NULL DEFAULT 1,
      preco_unitario REAL NOT NULL
    );

    -- Dados institucionais mostrados na pagina publica da academia
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );

    -- Cargos extras: um mestre pode ser tambem responsavel de competicoes,
    -- e o cargo pode valer so para uma modalidade.
    CREATE TABLE IF NOT EXISTS usuario_cargos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      cargo         TEXT NOT NULL,
      modalidade_id INTEGER REFERENCES modalidades(id) ON DELETE CASCADE,
      observacao    TEXT,
      criado_por    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (usuario_id, cargo, modalidade_id)
    );

    -- Modalidades que cada mestre ensina (aparece no site e nos filtros)
    CREATE TABLE IF NOT EXISTS usuario_modalidades (
      usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      modalidade_id INTEGER NOT NULL REFERENCES modalidades(id) ON DELETE CASCADE,
      PRIMARY KEY (usuario_id, modalidade_id)
    );

    -- Equipes de competicao, sempre ligadas a uma modalidade
    CREATE TABLE IF NOT EXISTS equipes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nome          TEXT NOT NULL,
      modalidade_id INTEGER REFERENCES modalidades(id) ON DELETE SET NULL,
      categoria     TEXT NOT NULL DEFAULT 'adulto'
                    CHECK (categoria IN ('kids','adulto','misto','feminino')),
      tecnico_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      descricao     TEXT,
      cor           TEXT DEFAULT '#f5b301',
      imagem        TEXT,
      ativo         INTEGER NOT NULL DEFAULT 1,
      criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (nome, modalidade_id)
    );

    CREATE TABLE IF NOT EXISTS equipe_membros (
      equipe_id  INTEGER NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
      aluno_id   INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
      funcao     TEXT NOT NULL DEFAULT 'atleta'
                 CHECK (funcao IN ('atleta','capitao','reserva','tecnico')),
      peso       REAL,
      categoria_peso TEXT,
      desde      TEXT,
      criado_em  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (equipe_id, aluno_id)
    );

    -- Calendario de competicoes (campeonatos, seletivas, festivais)
    CREATE TABLE IF NOT EXISTS competicoes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      nome           TEXT NOT NULL,
      modalidade_id  INTEGER REFERENCES modalidades(id) ON DELETE SET NULL,
      tipo           TEXT NOT NULL DEFAULT 'campeonato'
                     CHECK (tipo IN ('campeonato','seletiva','festival','interno','amistoso','graduacao')),
      nivel          TEXT NOT NULL DEFAULT 'estadual'
                     CHECK (nivel IN ('interno','municipal','estadual','nacional','internacional')),
      organizador    TEXT,
      data_inicio    TEXT NOT NULL,
      data_fim       TEXT,
      inscricao_ate  TEXT,
      local          TEXT,
      cidade         TEXT,
      endereco       TEXT,
      taxa           REAL NOT NULL DEFAULT 0,
      vagas          INTEGER NOT NULL DEFAULT 0,
      descricao      TEXT,
      regulamento    TEXT,
      cartaz         TEXT,
      link           TEXT,
      responsavel_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      status         TEXT NOT NULL DEFAULT 'agendada'
                     CHECK (status IN ('agendada','inscricoes','encerrada','realizada','cancelada')),
      publicar_site  INTEGER NOT NULL DEFAULT 1,
      criado_por     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS competicao_inscricoes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      competicao_id  INTEGER NOT NULL REFERENCES competicoes(id) ON DELETE CASCADE,
      aluno_id       INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
      equipe_id      INTEGER REFERENCES equipes(id) ON DELETE SET NULL,
      graduacao_id   INTEGER REFERENCES graduacoes(id) ON DELETE SET NULL,
      categoria_peso TEXT,
      peso           REAL,
      categoria_idade TEXT,
      status         TEXT NOT NULL DEFAULT 'inscrito'
                     CHECK (status IN ('interesse','inscrito','confirmado','desistiu')),
      taxa_paga      INTEGER NOT NULL DEFAULT 0,
      observacao     TEXT,
      criado_por     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (competicao_id, aluno_id)
    );

    CREATE TABLE IF NOT EXISTS competicao_resultados (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      inscricao_id  INTEGER NOT NULL REFERENCES competicao_inscricoes(id) ON DELETE CASCADE,
      colocacao     INTEGER,
      medalha       TEXT CHECK (medalha IN ('ouro','prata','bronze','participacao')),
      lutas         INTEGER NOT NULL DEFAULT 0,
      vitorias      INTEGER NOT NULL DEFAULT 0,
      finalizacoes  INTEGER NOT NULL DEFAULT 0,
      observacao    TEXT,
      registrado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (inscricao_id)
    );

    -- Registro de atividades: quem mexeu em que parte do sistema
    CREATE TABLE IF NOT EXISTS auditoria (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      usuario_nome TEXT,
      papel       TEXT,
      acao        TEXT NOT NULL,
      area        TEXT NOT NULL,
      alvo        TEXT,
      alvo_id     INTEGER,
      detalhe     TEXT,
      criado_em   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_horarios_dia ON horarios(dia_semana);
    CREATE INDEX IF NOT EXISTS idx_turmas_modalidade ON turmas(modalidade_id);
    CREATE INDEX IF NOT EXISTS idx_mensalidades_status ON mensalidades(status, vencimento);
    CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos(data);
    CREATE INDEX IF NOT EXISTS idx_presencas_data ON presencas(data);
    CREATE INDEX IF NOT EXISTS idx_avisos_criado ON avisos(criado_em DESC);
    CREATE INDEX IF NOT EXISTS idx_avaliacoes_status ON avaliacoes(status, criado_em DESC);
    CREATE INDEX IF NOT EXISTS idx_certificados_tipo ON certificados(tipo, data_emissao DESC);
    CREATE INDEX IF NOT EXISTS idx_checkins_data ON checkins(data DESC);
    CREATE INDEX IF NOT EXISTS idx_checkins_turma ON checkins(turma_id, data);
    CREATE INDEX IF NOT EXISTS idx_produtos_modalidade ON produtos(modalidade_id, ativo);
    CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data DESC);
    CREATE INDEX IF NOT EXISTS idx_competicoes_data ON competicoes(data_inicio DESC);
    CREATE INDEX IF NOT EXISTS idx_inscricoes_comp ON competicao_inscricoes(competicao_id);
    CREATE INDEX IF NOT EXISTS idx_inscricoes_aluno ON competicao_inscricoes(aluno_id);
    CREATE INDEX IF NOT EXISTS idx_equipe_membros ON equipe_membros(aluno_id);
    CREATE INDEX IF NOT EXISTS idx_auditoria_data ON auditoria(criado_em DESC);
    CREATE INDEX IF NOT EXISTS idx_cargos_usuario ON usuario_cargos(usuario_id);
  `;

/** Cada CREATE TABLE isolado, usado quando uma tabela precisa ser refeita. */
const DEFINICOES = Object.fromEntries(
  [...ESQUEMA.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n {4}\);/g)]
    .map((achado) => [achado[1], `${achado[0]}`]),
);

function criarEsquema(banco) {
  banco.exec(ESQUEMA);
}
