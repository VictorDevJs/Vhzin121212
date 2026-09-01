import { abrirBanco, todos, um, executar, transacao } from './db.js';
import { gerarHashSenha } from './auth.js';
import { hoje, competenciaAtual, somarMeses } from './util.js';

/** Modalidades e faixas que ja vem prontas na primeira execucao. */
const MODALIDADES = [
  {
    nome: 'Jiu-Jitsu', cor: '#1565c0',
    descricao: 'Arte suave focada em luta de solo, quedas, raspagens e finalizacoes.',
    faixas: ['Branca', 'Cinza', 'Amarela', 'Laranja', 'Verde', 'Azul', 'Roxa', 'Marrom', 'Preta'],
  },
  {
    nome: 'Muay Thai', cor: '#c62828',
    descricao: 'Boxe tailandes: socos, chutes, joelhadas, cotoveladas e clinch.',
    faixas: ['Branca', 'Vermelha', 'Rosa', 'Amarela', 'Laranja', 'Verde', 'Azul', 'Marrom', 'Preta'],
  },
  {
    nome: 'Karate', cor: '#6a1b9a',
    descricao: 'Arte marcial japonesa com katas, golpes tradicionais e disciplina.',
    faixas: ['Branca', 'Amarela', 'Vermelha', 'Laranja', 'Verde', 'Roxa', 'Marrom', 'Preta'],
  },
  {
    nome: 'Kickboxing', cor: '#ef6c00',
    descricao: 'Combinacao de boxe e chutes, muito condicionamento e ritmo.',
    faixas: ['Branca', 'Amarela', 'Laranja', 'Verde', 'Azul', 'Marrom', 'Preta'],
  },
  {
    nome: 'MMA', cor: '#2e7d32',
    descricao: 'Artes marciais mistas: trocacao, quedas e solo em um so treino.',
    faixas: ['Iniciante', 'Intermediario', 'Avancado', 'Competicao'],
  },
];

const PLANOS = [
  { nome: 'Kids Mensal', descricao: 'Aulas infantis (ate 15 anos), 2x por semana.', valor: 120, periodicidade: 'mensal', aulas_semana: 2 },
  { nome: 'Uma Modalidade', descricao: 'Escolha 1 modalidade, treinos livres nos horarios da turma.', valor: 150, periodicidade: 'mensal', aulas_semana: 3 },
  { nome: 'Duas Modalidades', descricao: 'Combine 2 modalidades no mesmo mes.', valor: 210, periodicidade: 'mensal', aulas_semana: 5 },
  { nome: 'Passe Livre', descricao: 'Acesso a todas as modalidades e horarios.', valor: 260, periodicidade: 'mensal', aulas_semana: 0 },
  { nome: 'Passe Livre Anual', descricao: 'Todas as modalidades com desconto no pagamento anual.', valor: 2600, periodicidade: 'anual', aulas_semana: 0 },
];

/** turma: [modalidade, nome, categoria, nivel, horarios [dia, inicio, fim]] */
const TURMAS = [
  ['Jiu-Jitsu', 'Jiu-Jitsu Kids', 'kids', 'todos', [[1, '17:00', '18:00'], [3, '17:00', '18:00'], [5, '17:00', '18:00']]],
  ['Jiu-Jitsu', 'Jiu-Jitsu Adulto Manha', 'adulto', 'todos', [[1, '06:30', '08:00'], [3, '06:30', '08:00'], [5, '06:30', '08:00']]],
  ['Jiu-Jitsu', 'Jiu-Jitsu Adulto Noite', 'adulto', 'todos', [[1, '20:00', '21:30'], [2, '20:00', '21:30'], [4, '20:00', '21:30']]],
  ['Muay Thai', 'Muay Thai Kids', 'kids', 'iniciante', [[2, '17:00', '18:00'], [4, '17:00', '18:00']]],
  ['Muay Thai', 'Muay Thai Adulto', 'adulto', 'todos', [[1, '19:00', '20:00'], [3, '19:00', '20:00'], [5, '19:00', '20:00']]],
  ['Muay Thai', 'Muay Thai Feminino', 'feminino', 'todos', [[2, '09:00', '10:00'], [4, '09:00', '10:00']]],
  ['Karate', 'Karate Kids', 'kids', 'todos', [[2, '16:00', '17:00'], [4, '16:00', '17:00']]],
  ['Karate', 'Karate Adulto', 'adulto', 'todos', [[2, '18:00', '19:00'], [4, '18:00', '19:00']]],
  ['Kickboxing', 'Kickboxing Adulto', 'adulto', 'todos', [[1, '18:00', '19:00'], [3, '18:00', '19:00'], [5, '18:00', '19:00']]],
  ['MMA', 'MMA Iniciante', 'adulto', 'iniciante', [[2, '21:00', '22:00'], [4, '21:00', '22:00']]],
  ['MMA', 'MMA Competicao', 'adulto', 'avancado', [[3, '21:00', '22:30'], [6, '10:00', '12:00']]],
];

const CONFIGURACOES = {
  nome_academia: 'Academia de Lutas',
  telefone: '(00) 00000-0000',
  endereco: 'Rua das Artes Marciais, 100 - Centro',
  instagram: '@academiadelutas',
  sobre: 'Treinos de Jiu-Jitsu, Muay Thai, Karate, Kickboxing e MMA para todas as idades, do kids ao competidor.',
};

/**
 * Cria o conteudo inicial apenas quando o banco esta vazio.
 * Rodar de novo nao duplica nada.
 */
export function garantirDadosIniciais() {
  const existeUsuario = um('SELECT COUNT(*) AS total FROM usuarios');
  if (existeUsuario.total > 0) return { criado: false };

  const email = process.env.DONO_EMAIL || 'dono@academia.com';
  const senha = process.env.DONO_SENHA || 'admin123';
  const nome = process.env.DONO_NOME || 'Dono da Academia';

  transacao(() => {
    executar(`INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (:nome, :email, :hash, 'dono')`,
      { nome, email, hash: gerarHashSenha(senha) });

    for (const [chave, valor] of Object.entries(CONFIGURACOES)) {
      executar('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (:chave, :valor)', { chave, valor });
    }

    for (const modalidade of MODALIDADES) {
      const criada = executar('INSERT INTO modalidades (nome, descricao, cor) VALUES (:nome, :descricao, :cor)',
        { nome: modalidade.nome, descricao: modalidade.descricao, cor: modalidade.cor });
      const modalidadeId = Number(criada.lastInsertRowid);
      modalidade.faixas.forEach((faixa, indice) => {
        executar('INSERT INTO graduacoes (modalidade_id, nome, ordem) VALUES (:m, :nome, :ordem)',
          { m: modalidadeId, nome: faixa, ordem: indice });
      });
    }

    for (const plano of PLANOS) {
      executar(`INSERT INTO planos (nome, descricao, valor, periodicidade, aulas_semana)
                VALUES (:nome, :descricao, :valor, :periodicidade, :aulas_semana)`, {
        nome: plano.nome,
        descricao: plano.descricao,
        valor: plano.valor,
        periodicidade: plano.periodicidade,
        aulas_semana: plano.aulas_semana,
      });
    }

    for (const [modalidade, nomeTurma, categoria, nivel, horarios] of TURMAS) {
      const m = um('SELECT id FROM modalidades WHERE nome = :nome', { nome: modalidade });
      const turma = executar(`INSERT INTO turmas (modalidade_id, nome, categoria, nivel, capacidade, local)
                              VALUES (:m, :nome, :categoria, :nivel, 30, 'Tatame principal')`,
        { m: m.id, nome: nomeTurma, categoria, nivel });
      const turmaId = Number(turma.lastInsertRowid);
      for (const [dia, inicio, fim] of horarios) {
        executar(`INSERT INTO horarios (turma_id, dia_semana, hora_inicio, hora_fim)
                  VALUES (:t, :dia, :inicio, :fim)`, { t: turmaId, dia, inicio, fim });
      }
    }

    executar(`
      INSERT INTO avisos (titulo, mensagem, tipo, publico, fixado, autor_id)
      VALUES (:titulo, :mensagem, 'geral', 'todos', 1,
              (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
    `, {
      titulo: 'Bem-vindo ao sistema da academia',
      mensagem: 'Aqui voce acompanha os horarios das aulas, avisos de campeonatos, cancelamentos e a sua mensalidade.',
    });
  });

  return { criado: true, email, senha };
}

/** Dados de demonstracao: alunos, matriculas, mensalidades, caixa, avisos e chamada. */
export function carregarDemonstracao() {
  const alunosDemo = [
    ['Lucas Ferreira', 'adulto', '2001-04-12', 'Jiu-Jitsu Adulto Noite'],
    ['Mariana Costa', 'adulto', '1996-09-30', 'Muay Thai Feminino'],
    ['Pedro Henrique Alves', 'kids', '2015-02-08', 'Jiu-Jitsu Kids'],
    ['Ana Beatriz Souza', 'kids', '2014-11-21', 'Karate Kids'],
    ['Rafael Mendes', 'adulto', '1993-07-03', 'MMA Competicao'],
    ['Juliana Rocha', 'adulto', '1999-01-17', 'Kickboxing Adulto'],
    ['Carlos Eduardo Lima', 'adulto', '1988-05-25', 'Muay Thai Adulto'],
    ['Sofia Martins', 'kids', '2016-08-14', 'Muay Thai Kids'],
  ];

  if (um('SELECT COUNT(*) AS total FROM alunos').total > 0) {
    return { mensagem: 'O banco ja tem alunos cadastrados; a demonstracao nao foi aplicada.' };
  }

  transacao(() => {
    const mestres = [
      ['Mestre Ricardo Barbosa', 'ricardo@academia.com'],
      ['Mestra Camila Nogueira', 'camila@academia.com'],
    ];
    const idsMestres = mestres.map(([nomeMestre, emailMestre]) => {
      const criado = executar(`INSERT INTO usuarios (nome, email, senha_hash, papel, telefone)
                               VALUES (:nome, :email, :hash, 'mestre', '(11) 90000-0000')`,
        { nome: nomeMestre, email: emailMestre, hash: gerarHashSenha('mestre123') });
      return Number(criado.lastInsertRowid);
    });

    executar(`INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (:nome, :email, :hash, 'recepcao')`,
      { nome: 'Recepcao', email: 'recepcao@academia.com', hash: gerarHashSenha('recepcao123') });

    const turmas = todos('SELECT id, nome FROM turmas');
    turmas.forEach((turma, indice) => {
      executar('UPDATE turmas SET mestre_id = :m WHERE id = :id',
        { m: idsMestres[indice % idsMestres.length], id: turma.id });
    });

    const planos = todos('SELECT * FROM planos WHERE ativo = 1 ORDER BY valor');
    const competencia = competenciaAtual();

    alunosDemo.forEach(([nomeAluno, categoria, nascimento, nomeTurma], indice) => {
      const emailAluno = `${nomeAluno.split(' ')[0].toLowerCase()}${indice}@email.com`;
      const usuario = executar(`INSERT INTO usuarios (nome, email, senha_hash, papel, telefone)
                                VALUES (:nome, :email, :hash, 'aluno', '(11) 98888-0000')`,
        { nome: nomeAluno, email: emailAluno, hash: gerarHashSenha('aluno123') });
      const aluno = executar(`
        INSERT INTO alunos (usuario_id, nome, email, telefone, data_nascimento, categoria, status, matriculado_em,
                            responsavel_nome, responsavel_telefone)
        VALUES (:usuario_id, :nome, :email, '(11) 98888-0000', :nascimento, :categoria, :status, :matriculado_em,
                :responsavel, :tel_responsavel)
      `, {
        usuario_id: Number(usuario.lastInsertRowid),
        nome: nomeAluno,
        email: emailAluno,
        nascimento,
        categoria,
        status: indice === alunosDemo.length - 1 ? 'pendente' : 'ativo',
        matriculado_em: somarMeses(hoje(), -indice),
        responsavel: categoria === 'kids' ? 'Responsavel legal' : null,
        tel_responsavel: categoria === 'kids' ? '(11) 97777-0000' : null,
      });
      const alunoId = Number(aluno.lastInsertRowid);

      const turma = um('SELECT id FROM turmas WHERE nome = :nome', { nome: nomeTurma });
      if (turma) executar('INSERT OR IGNORE INTO aluno_turmas (aluno_id, turma_id) VALUES (:a, :t)', { a: alunoId, t: turma.id });

      if (indice === alunosDemo.length - 1) return; // aluno pendente fica sem matricula

      const plano = categoria === 'kids' ? planos[0] : planos[(indice % (planos.length - 1)) + 1];
      const matricula = executar(`
        INSERT INTO matriculas (aluno_id, plano_id, inicio, fim, valor, dia_vencimento, status)
        VALUES (:a, :p, :inicio, :fim, :valor, 10, 'ativa')
      `, {
        a: alunoId, p: plano.id, inicio: somarMeses(hoje(), -3), fim: somarMeses(hoje(), 9), valor: plano.valor,
      });

      const pago = indice % 3 !== 0; // deixa alguns inadimplentes para o painel financeiro
      executar(`
        INSERT INTO mensalidades (matricula_id, aluno_id, competencia, vencimento, valor, status, pago_em, forma_pagamento)
        VALUES (:mt, :a, :competencia, :vencimento, :valor, :status, :pago_em, :forma)
      `, {
        mt: Number(matricula.lastInsertRowid),
        a: alunoId,
        competencia,
        vencimento: `${competencia}-10`,
        valor: plano.valor,
        status: pago ? 'pago' : 'pendente',
        pago_em: pago ? hoje() : null,
        forma: pago ? 'pix' : null,
      });
      if (pago) {
        executar(`
          INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, forma_pagamento, aluno_id, registrado_por)
          VALUES ('receita', 'mensalidade', :descricao, :valor, :data, 'pix', :a,
                  (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
        `, { descricao: `Mensalidade ${competencia} - ${nomeAluno}`, valor: plano.valor, data: hoje(), a: alunoId });
      }
    });

    const despesas = [
      ['aluguel', 'Aluguel do galpao', 3500],
      ['salarios', 'Pagamento dos professores', 4200],
      ['agua/luz/internet', 'Contas do mes', 780],
      ['equipamentos', 'Reposicao de luvas e aparadores', 950],
    ];
    for (const [categoria, descricao, valor] of despesas) {
      executar(`
        INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, forma_pagamento, registrado_por)
        VALUES ('despesa', :categoria, :descricao, :valor, :data, 'transferencia',
                (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
      `, { categoria, descricao, valor, data: `${competenciaAtual()}-05` });
    }

    const avisos = [
      ['Campeonato Estadual de Jiu-Jitsu', 'Inscricoes abertas ate dia 20. Falar com a recepcao para confirmar a categoria e o peso.', 'campeonato', 'todos', somarMeses(hoje(), 1)],
      ['Sem aula no feriado', 'Na proxima sexta-feira a academia estara fechada. As aulas voltam no sabado no horario normal.', 'cancelamento', 'todos', null],
      ['Exame de faixa Kids', 'Alunos kids com frequencia acima de 75% ja podem se inscrever no proximo exame de faixa.', 'graduacao', 'kids', somarMeses(hoje(), 1)],
      ['Treino extra de MMA', 'Sabado teremos treino aberto de MMA das 10h as 12h. Traga protetor bucal.', 'evento', 'adultos', null],
    ];
    for (const [titulo, mensagem, tipo, publico, dataEvento] of avisos) {
      executar(`
        INSERT INTO avisos (titulo, mensagem, tipo, publico, data_evento, autor_id)
        VALUES (:titulo, :mensagem, :tipo, :publico, :data_evento,
                (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
      `, { titulo, mensagem, tipo, publico, data_evento: dataEvento });
    }
  });

  return { mensagem: 'Dados de demonstracao carregados.' };
}

const executadoDireto = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (executadoDireto) {
  abrirBanco();
  const inicial = garantirDadosIniciais();
  if (inicial.criado) {
    console.log(`Dados iniciais criados. Login do dono: ${inicial.email} / ${inicial.senha}`);
  } else {
    console.log('Banco ja inicializado.');
  }
  if (process.argv.includes('--demo')) {
    console.log(carregarDemonstracao().mensagem);
    console.log('Logins de demonstracao: ricardo@academia.com / mestre123 | recepcao@academia.com / recepcao123');
  }
}
