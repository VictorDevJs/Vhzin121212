import { abrirBanco, todos, um, executar, transacao } from './db.js';
import { gerarHashSenha } from './auth.js';
import { hoje, competenciaAtual, somarMeses } from './util.js';

/** Modalidades e faixas que ja vem prontas na primeira execucao. */
const MODALIDADES = [
  {
    nome: 'Jiu-Jitsu', cor: '#2a78d6',
    descricao: 'Arte suave focada em luta de solo, quedas, raspagens e finalizacoes.',
    faixas: ['Branca', 'Cinza', 'Amarela', 'Laranja', 'Verde', 'Azul', 'Roxa', 'Marrom', 'Preta'],
  },
  {
    nome: 'Muay Thai', cor: '#eb6834',
    descricao: 'Boxe tailandes: socos, chutes, joelhadas, cotoveladas e clinch.',
    faixas: ['Branca', 'Vermelha', 'Rosa', 'Amarela', 'Laranja', 'Verde', 'Azul', 'Marrom', 'Preta'],
  },
  {
    nome: 'Karate', cor: '#1baf7a',
    descricao: 'Arte marcial japonesa com katas, golpes tradicionais e disciplina.',
    faixas: ['Branca', 'Amarela', 'Vermelha', 'Laranja', 'Verde', 'Roxa', 'Marrom', 'Preta'],
  },
  {
    nome: 'Kickboxing', cor: '#eda100',
    descricao: 'Combinacao de boxe e chutes, muito condicionamento e ritmo.',
    faixas: ['Branca', 'Amarela', 'Laranja', 'Verde', 'Azul', 'Marrom', 'Preta'],
  },
  {
    nome: 'MMA', cor: '#e87ba4',
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
  nome_academia: 'Atak',
  telefone: '(00) 00000-0000',
  whatsapp: '',
  endereco: 'Rua das Artes Marciais, 100 - Centro',
  instagram: '@atak',
  chamada: 'Treine forte. Evolua sempre.',
  sobre: 'A Atak forma lutadores de Jiu-Jitsu, Muay Thai, Karate, Kickboxing e MMA - do primeiro dia no tatame ate o podio, com turmas kids, adulto e feminino.',
  cor_primaria: '#e11d2e',
};

/**
 * Cria o conteudo inicial apenas quando o banco esta vazio.
 * Rodar de novo nao duplica nada.
 */
export function garantirDadosIniciais() {
  const existeUsuario = um('SELECT COUNT(*) AS total FROM usuarios');
  if (existeUsuario.total > 0) return { criado: false };

  const email = process.env.DONO_EMAIL || 'dono@atak.com';
  const senha = process.env.DONO_SENHA || 'admin123';
  const nome = process.env.DONO_NOME || 'Dono da Atak';

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
      titulo: 'Bem-vindo ao sistema da Atak',
      mensagem: 'Aqui voce acompanha os horarios das aulas, avisos de campeonatos, cancelamentos e a sua mensalidade.',
    });
  });

  return { criado: true, email, senha };
}

/** Dados de demonstracao: alunos, matriculas, mensalidades, caixa, avisos e chamada. */
export function carregarDemonstracao() {
  // Turma de cada aluno define a categoria (kids ou adulto) e onde ele aparece na chamada.
  const TURMAS_KIDS = ['Jiu-Jitsu Kids', 'Muay Thai Kids', 'Karate Kids'];
  const TURMAS_ADULTO = [
    'Jiu-Jitsu Adulto Manha', 'Jiu-Jitsu Adulto Noite', 'Muay Thai Adulto', 'Muay Thai Feminino',
    'Karate Adulto', 'Kickboxing Adulto', 'MMA Iniciante', 'MMA Competicao',
  ];
  const NOMES = [
    'Lucas Ferreira', 'Mariana Costa', 'Rafael Mendes', 'Juliana Rocha', 'Carlos Eduardo Lima',
    'Beatriz Almeida', 'Thiago Barros', 'Camila Duarte', 'Bruno Antunes', 'Larissa Pires',
    'Diego Nascimento', 'Patricia Gomes', 'Felipe Cardoso', 'Amanda Ribeiro', 'Vinicius Teixeira',
    'Gabriela Moraes', 'Rodrigo Farias', 'Aline Fontes', 'Pedro Henrique Alves', 'Ana Beatriz Souza',
    'Sofia Martins', 'Miguel Andrade', 'Helena Vasques', 'Davi Lucca Ramos',
  ];
  // Os 5 ultimos sao kids; o ultimo da lista fica pendente, esperando a recepcao.
  const alunosDemo = NOMES.map((nome, indice) => {
    const ehKids = indice >= NOMES.length - 5;
    const anoNascimento = ehKids ? 2013 + (indice % 5) : 1985 + (indice % 18);
    return [
      nome,
      ehKids ? 'kids' : 'adulto',
      `${anoNascimento}-${String((indice % 12) + 1).padStart(2, '0')}-${String((indice % 27) + 1).padStart(2, '0')}`,
      ehKids ? TURMAS_KIDS[indice % TURMAS_KIDS.length] : TURMAS_ADULTO[indice % TURMAS_ADULTO.length],
    ];
  });

  if (um('SELECT COUNT(*) AS total FROM alunos').total > 0) {
    return { mensagem: 'O banco ja tem alunos cadastrados; a demonstracao nao foi aplicada.' };
  }

  transacao(() => {
    const mestres = [
      ['Mestre Ricardo Barbosa', 'ricardo@atak.com'],
      ['Mestra Camila Nogueira', 'camila@atak.com'],
    ];
    const idsMestres = mestres.map(([nomeMestre, emailMestre]) => {
      const criado = executar(`INSERT INTO usuarios (nome, email, senha_hash, papel, telefone)
                               VALUES (:nome, :email, :hash, 'mestre', '(11) 90000-0000')`,
        { nome: nomeMestre, email: emailMestre, hash: gerarHashSenha('mestre123') });
      return Number(criado.lastInsertRowid);
    });

    executar(`INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (:nome, :email, :hash, 'recepcao')`,
      { nome: 'Recepcao', email: 'recepcao@atak.com', hash: gerarHashSenha('recepcao123') });

    const turmas = todos('SELECT id, nome FROM turmas');
    turmas.forEach((turma, indice) => {
      executar('UPDATE turmas SET mestre_id = :m WHERE id = :id',
        { m: idsMestres[indice % idsMestres.length], id: turma.id });
    });

    // A demonstracao usa apenas planos mensais, para o caixa do mes fazer sentido.
    const planos = todos(`SELECT * FROM planos WHERE ativo = 1 AND periodicidade = 'mensal' ORDER BY valor`);
    const competencia = competenciaAtual();

    alunosDemo.forEach(([nomeAluno, categoria, nascimento, nomeTurma], indice) => {
      const emailAluno = `${nomeAluno.split(' ')[0].toLowerCase()}${indice}@email.com`;
      const usuario = executar(`INSERT INTO usuarios (nome, email, senha_hash, papel, telefone)
                                VALUES (:nome, :email, :hash, 'aluno', :telefone)`,
        {
          nome: nomeAluno,
          email: emailAluno,
          hash: gerarHashSenha('aluno123'),
          telefone: `(11) 9${String(8000 + indice).slice(0, 4)}-${String(1000 + indice * 7).slice(0, 4)}`,
        });
      const aluno = executar(`
        INSERT INTO alunos (usuario_id, nome, email, telefone, data_nascimento, categoria, status, matriculado_em,
                            responsavel_nome, responsavel_telefone)
        VALUES (:usuario_id, :nome, :email, :telefone, :nascimento, :categoria, :status, :matriculado_em,
                :responsavel, :tel_responsavel)
      `, {
        usuario_id: Number(usuario.lastInsertRowid),
        nome: nomeAluno,
        email: emailAluno,
        telefone: `(11) 9${String(8000 + indice).slice(0, 4)}-${String(1000 + indice * 7).slice(0, 4)}`,
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

      // O aluno entrou em algum momento dos ultimos 6 meses.
      const mesesDeCasa = Math.min(5, indice);
      const entrada = somarMeses(hoje(), -mesesDeCasa);
      const matricula = executar(`
        INSERT INTO matriculas (aluno_id, plano_id, inicio, fim, valor, dia_vencimento, status, criado_em)
        VALUES (:a, :p, :inicio, :fim, :valor, 10, 'ativa', :criado_em)
      `, {
        a: alunoId, p: plano.id, inicio: entrada, fim: somarMeses(entrada, 12), valor: plano.valor,
        criado_em: `${entrada} 09:00:00`,
      });
      const matriculaId = Number(matricula.lastInsertRowid);

      // Historico de mensalidades desde a entrada ate o mes atual.
      for (let atras = mesesDeCasa; atras >= 0; atras -= 1) {
        const mes = somarMeses(hoje(), -atras).slice(0, 7);
        const mesAtual = mes === competencia;
        // No mes corrente parte dos alunos ainda esta em aberto; o passado esta pago.
        const pago = !mesAtual || indice % 3 !== 0;
        const pagoEm = mesAtual ? hoje() : `${mes}-08`;
        executar(`
          INSERT INTO mensalidades (matricula_id, aluno_id, competencia, vencimento, valor, status, pago_em, forma_pagamento)
          VALUES (:mt, :a, :competencia, :vencimento, :valor, :status, :pago_em, :forma)
        `, {
          mt: matriculaId,
          a: alunoId,
          competencia: mes,
          vencimento: `${mes}-10`,
          valor: plano.valor,
          status: pago ? 'pago' : 'pendente',
          pago_em: pago ? pagoEm : null,
          forma: pago ? 'pix' : null,
        });
        if (pago) {
          executar(`
            INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, forma_pagamento, aluno_id, registrado_por)
            VALUES ('receita', 'mensalidade', :descricao, :valor, :data, 'pix', :a,
                    (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
          `, { descricao: `Mensalidade ${mes} - ${nomeAluno}`, valor: plano.valor, data: pagoEm, a: alunoId });
        }
      }
    });

    const despesasFixas = [
      ['aluguel', 'Aluguel do galpao', 1500],
      ['salarios', 'Pagamento dos professores', 1600],
      ['agua/luz/internet', 'Contas do mes', 320],
    ];
    for (let atras = 5; atras >= 0; atras -= 1) {
      const mes = somarMeses(hoje(), -atras).slice(0, 7);
      for (const [categoria, descricao, valor] of despesasFixas) {
        executar(`
          INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, forma_pagamento, registrado_por)
          VALUES ('despesa', :categoria, :descricao, :valor, :data, 'transferencia',
                  (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
        `, { categoria, descricao, valor, data: `${mes}-05` });
      }
      if (atras % 2 === 0) {
        executar(`
          INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, forma_pagamento, registrado_por)
          VALUES ('despesa', 'equipamentos', 'Reposicao de material de treino', :valor, :data, 'credito',
                  (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
        `, { valor: 420 + atras * 30, data: `${mes}-18` });
      }
      executar(`
        INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, forma_pagamento, registrado_por)
        VALUES ('receita', 'produtos', 'Venda de kimonos e camisetas', :valor, :data, 'pix',
                (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
      `, { valor: 260 + atras * 45, data: `${mes}-20` });
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
    console.log('Logins de demonstracao: ricardo@atak.com / mestre123 | recepcao@atak.com / recepcao123');
  }
}
