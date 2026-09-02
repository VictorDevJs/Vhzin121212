import { abrirBanco, todos, um, executar, transacao } from './db.js';
import { gerarHashSenha } from './auth.js';
import { hoje, competenciaAtual, somarMeses } from './util.js';

/** Modalidades e faixas que ja vem prontas na primeira execucao. */
const MODALIDADES = [
  {
    nome: 'Jiu-Jitsu', destaque: 'Kids, adulto e competição · No-Gi e Gi', cor: '#2a78d6',
    descricao: 'Arte suave focada em luta de solo, quedas, raspagens e finalizações.',
    faixas: ['Branca', 'Cinza', 'Amarela', 'Laranja', 'Verde', 'Azul', 'Roxa', 'Marrom', 'Preta'],
  },
  {
    nome: 'Muay Thai', destaque: 'Turmas kids, adulto e feminino', cor: '#eb6834',
    descricao: 'Boxe tailandês: socos, chutes, joelhadas, cotoveladas e clinch.',
    faixas: ['Branca', 'Vermelha', 'Rosa', 'Amarela', 'Laranja', 'Verde', 'Azul', 'Marrom', 'Preta'],
  },
  {
    nome: 'Karatê', destaque: 'Kids a partir de 5 anos e adulto', cor: '#1baf7a',
    descricao: 'Arte marcial japonesa com katas, golpes tradicionais e disciplina.',
    faixas: ['Branca', 'Amarela', 'Vermelha', 'Laranja', 'Verde', 'Roxa', 'Marrom', 'Preta'],
  },
  {
    nome: 'Kickboxing', destaque: 'Condicionamento e técnica, todos os níveis', cor: '#eda100',
    descricao: 'Combinação de boxe e chutes, muito condicionamento e ritmo.',
    faixas: ['Branca', 'Amarela', 'Laranja', 'Verde', 'Azul', 'Marrom', 'Preta'],
  },
  {
    nome: 'Boxe', destaque: 'Base de mãos para iniciantes e avançados', cor: '#4a3aa7',
    descricao: 'Jogo de maos, esquiva e ritmo: a base da trocação em qualquer luta.',
    faixas: ['Iniciante', 'Intermediario', 'Avancado', 'Competicao'],
  },
  {
    nome: 'MMA', destaque: 'Iniciante e equipe de competição', cor: '#e87ba4',
    descricao: 'Artes marciais mistas: trocação, quedas e solo em um só treino.',
    faixas: ['Iniciante', 'Intermediario', 'Avancado', 'Competicao'],
  },
];

const PLANOS = [
  { nome: 'Kids Mensal', descricao: 'Aulas infantis (até 15 anos), 2x por semana.', valor: 120, periodicidade: 'mensal', aulas_semana: 2 },
  { nome: 'Uma Modalidade', descricao: 'Escolha 1 modalidade, treinos livres nos horários da turma.', valor: 150, periodicidade: 'mensal', aulas_semana: 3 },
  { nome: 'Duas Modalidades', descricao: 'Combine 2 modalidades no mesmo mês.', valor: 210, periodicidade: 'mensal', aulas_semana: 5 },
  { nome: 'Passe Livre', descricao: 'Acesso a todas as modalidades e horários.', valor: 260, periodicidade: 'mensal', aulas_semana: 0 },
  { nome: 'Passe Livre Anual', descricao: 'Todas as modalidades com desconto no pagamento anual.', valor: 2600, periodicidade: 'anual', aulas_semana: 0 },
];

/** turma: [modalidade, nome, categoria, nivel, horarios [dia, inicio, fim]] */
const TURMAS = [
  ['Jiu-Jitsu', 'Jiu-Jitsu Kids', 'kids', 'todos', [[1, '17:00', '18:00'], [3, '17:00', '18:00'], [5, '17:00', '18:00']]],
  ['Jiu-Jitsu', 'Jiu-Jitsu Adulto Manhã', 'adulto', 'todos', [[1, '06:30', '08:00'], [3, '06:30', '08:00'], [5, '06:30', '08:00']]],
  ['Jiu-Jitsu', 'Jiu-Jitsu Adulto Noite', 'adulto', 'todos', [
    [1, '19:00', '20:00', 'No-Gi'], [1, '20:00', '21:30', 'Gi'],
    [3, '19:00', '20:00', 'No-Gi'], [3, '20:00', '21:30', 'Gi'],
    [5, '20:00', '21:30', 'Gi'],
  ]],
  ['Muay Thai', 'Muay Thai Kids', 'kids', 'iniciante', [[2, '17:00', '18:00'], [4, '17:00', '18:00']]],
  ['Muay Thai', 'Muay Thai Adulto', 'adulto', 'todos', [[1, '19:00', '20:00'], [3, '19:00', '20:00'], [5, '19:00', '20:00']]],
  ['Muay Thai', 'Muay Thai Feminino', 'feminino', 'todos', [[2, '09:00', '10:00'], [4, '09:00', '10:00']]],
  ['Karatê', 'Karatê Kids', 'kids', 'todos', [[2, '16:00', '17:00'], [4, '16:00', '17:00']]],
  ['Karatê', 'Karatê Adulto', 'adulto', 'todos', [[2, '18:00', '19:00'], [4, '18:00', '19:00']]],
  ['Kickboxing', 'Kickboxing Adulto', 'adulto', 'todos', [[1, '18:00', '19:00'], [3, '18:00', '19:00'], [5, '18:00', '19:00']]],
  ['Boxe', 'Boxe Adulto', 'adulto', 'todos', [[2, '19:00', '20:00'], [4, '19:00', '20:00']]],
  ['MMA', 'MMA Iniciante', 'adulto', 'iniciante', [[2, '21:00', '22:00'], [4, '21:00', '22:00']]],
  ['MMA', 'MMA Competição', 'adulto', 'avancado', [[3, '21:00', '22:30', 'Sparring'], [6, '10:00', '12:00', 'Treino aberto']]],
];

const CONFIGURACOES = {
  nome_academia: 'CT Atak Pechincha',
  telefone: '(21) 97024-0245',
  whatsapp: '5521970240245',
  endereco: 'Rua Coronel Francisco Lobo, 145 - Pechincha, Rio de Janeiro - RJ, 22740-350',
  instagram: '@ctatak',
  chamada: 'Centro de treinamento de lutas',
  sobre: 'O CT Atak Pechincha forma lutadores de Jiu-Jitsu, Muay Thai, Karatê, Kickboxing, Boxe e MMA - do primeiro dia no tatame até o pódio, com turmas kids, adulto e feminino.',
  historia: 'São mais de 15 anos formando atletas e mudando histórias no Pechincha. O que começou como um projeto de bairro virou um centro de treinamento com equipe de competição, turmas kids e professores graduados.',
  horario_funcionamento: 'Segunda a sexta, 06h as 22h · Sábado, 09h as 13h',
  ano_fundacao: String(new Date().getFullYear() - 15),
  cor_primaria: '#f5b301',
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

    MODALIDADES.forEach((modalidade, ordem) => {
      const criada = executar(`
        INSERT INTO modalidades (nome, descricao, cor, destaque, ordem)
        VALUES (:nome, :descricao, :cor, :destaque, :ordem)
      `, {
        nome: modalidade.nome,
        descricao: modalidade.descricao,
        cor: modalidade.cor,
        destaque: modalidade.destaque || null,
        ordem,
      });
      const modalidadeId = Number(criada.lastInsertRowid);
      modalidade.faixas.forEach((faixa, indice) => {
        executar('INSERT INTO graduacoes (modalidade_id, nome, ordem) VALUES (:m, :nome, :ordem)',
          { m: modalidadeId, nome: faixa, ordem: indice });
      });
    });

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
      for (const [dia, inicio, fim, rotulo = null] of horarios) {
        executar(`INSERT INTO horarios (turma_id, dia_semana, hora_inicio, hora_fim, rotulo)
                  VALUES (:t, :dia, :inicio, :fim, :rotulo)`, { t: turmaId, dia, inicio, fim, rotulo });
      }
    }

    executar(`
      INSERT INTO avisos (titulo, mensagem, tipo, publico, fixado, autor_id)
      VALUES (:titulo, :mensagem, 'geral', 'todos', 1,
              (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
    `, {
      titulo: 'Bem-vindo ao sistema da Atak',
      mensagem: 'Aqui você acompanha os horários das aulas, avisos de campeonatos, cancelamentos e a sua mensalidade.',
    });
  });

  return { criado: true, email, senha };
}

/**
 * Gera 30 dias de check-in para a demonstração: cada aluno confirma presença
 * nas aulas da turma dele, com frequência variando de pessoa para pessoa.
 */
function gerarCheckins() {
  const vinculos = todos(`
    SELECT at.aluno_id, h.id AS horario_id, h.dia_semana, h.hora_inicio, t.id AS turma_id
    FROM aluno_turmas at
    JOIN turmas t ON t.id = at.turma_id
    JOIN horarios h ON h.turma_id = t.id
    JOIN alunos a ON a.id = at.aluno_id
    WHERE a.status = 'ativo'
  `);

  for (let atras = 29; atras >= 0; atras -= 1) {
    const dia = new Date();
    dia.setDate(dia.getDate() - atras);
    const iso = dia.toLocaleDateString('sv-SE');
    const registrados = new Set();

    for (const vinculo of vinculos) {
      if (vinculo.dia_semana !== dia.getDay()) continue;
      const chave = `${vinculo.aluno_id}-${vinculo.turma_id}`;
      if (registrados.has(chave)) continue;
      // Frequência entre 45% e 85%, variando de aluno para aluno.
      const propensao = 0.45 + ((vinculo.aluno_id * 7) % 40) / 100;
      if (Math.random() > propensao) continue;
      registrados.add(chave);

      const [h, m] = vinculo.hora_inicio.split(':').map(Number);
      const minuto = h * 60 + m - Math.floor(Math.random() * 12);
      const hora = `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`;

      executar(`
        INSERT OR IGNORE INTO checkins (aluno_id, turma_id, horario_id, data, hora, origem)
        VALUES (:aluno, :turma, :horario, :data, :hora, 'aluno')
      `, { aluno: vinculo.aluno_id, turma: vinculo.turma_id, horario: vinculo.horario_id, data: iso, hora });
      executar(`
        INSERT OR IGNORE INTO presencas (aluno_id, turma_id, data, presente)
        VALUES (:aluno, :turma, :data, 1)
      `, { aluno: vinculo.aluno_id, turma: vinculo.turma_id, data: iso });
    }
  }
}

/** Dados de demonstração: alunos, matrículas, mensalidades, caixa, avisos e chamada. */
export function carregarDemonstracao() {
  // Turma de cada aluno define a categoria (kids ou adulto) e onde ele aparece na chamada.
  const TURMAS_KIDS = ['Jiu-Jitsu Kids', 'Muay Thai Kids', 'Karatê Kids'];
  const TURMAS_ADULTO = [
    'Jiu-Jitsu Adulto Manhã', 'Jiu-Jitsu Adulto Noite', 'Muay Thai Adulto', 'Muay Thai Feminino',
    'Karatê Adulto', 'Kickboxing Adulto', 'Boxe Adulto', 'MMA Iniciante', 'MMA Competição',
  ];
  const NOMES = [
    'Lucas Ferreira', 'Mariana Costa', 'Rafael Mendes', 'Juliana Rocha', 'Carlos Eduardo Lima',
    'Beatriz Almeida', 'Thiago Barros', 'Camila Duarte', 'Bruno Antunes', 'Larissa Pires',
    'Diego Nascimento', 'Patricia Gomes', 'Felipe Cardoso', 'Amanda Ribeiro', 'Vinicius Teixeira',
    'Gabriela Moraes', 'Rodrigo Farias', 'Aline Fontes', 'Pedro Henrique Alves', 'Ana Beatriz Souza',
    'Sofia Martins', 'Miguel Andrade', 'Helena Vasques', 'Davi Lucca Ramos',
  ];
  // Os 5 últimos são kids; o último da lista fica pendente, esperando a recepção.
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
    return { mensagem: 'O banco já tem alunos cadastrados; a demonstração não foi aplicada.' };
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
      { nome: 'Recepção', email: 'recepcao@atak.com', hash: gerarHashSenha('recepcao123') });

    const turmas = todos('SELECT id, nome FROM turmas');
    turmas.forEach((turma, indice) => {
      executar('UPDATE turmas SET mestre_id = :m WHERE id = :id',
        { m: idsMestres[indice % idsMestres.length], id: turma.id });
    });

    // A demonstração usa apenas planos mensais, para o caixa do mes fazer sentido.
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
        responsavel: categoria === 'kids' ? 'Responsável legal' : null,
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
      ['agua/luz/internet', 'Contas do mês', 320],
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
          VALUES ('despesa', 'equipamentos', 'Reposição de material de treino', :valor, :data, 'credito',
                  (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
        `, { valor: 420 + atras * 30, data: `${mes}-18` });
      }
      executar(`
        INSERT INTO lancamentos (tipo, categoria, descricao, valor, data, forma_pagamento, registrado_por)
        VALUES ('receita', 'produtos', 'Venda de kimonos e camisetas', :valor, :data, 'pix',
                (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
      `, { valor: 260 + atras * 45, data: `${mes}-20` });
    }

    const avaliacoesDemo = [
      ['Lucas Ferreira', 5, 'Melhor CT da regiao. Professores atenciosos e turma unida. Entrei sem saber nada de Jiu-Jitsu e hoje compito.', 'aprovada', 'aluno'],
      ['Mariana Costa', 5, 'As aulas de Muay Thai feminino são maravilhosas, me sinto segura e evoluindo todo mês.', 'aprovada', 'aluno'],
      ['Rodrigo Farias', 4, 'Estrutura muito boa e horários que cabem no meu trabalho. Só sinto falta de mais turmas de sábado.', 'aprovada', 'site'],
      ['Patricia Gomes', 5, 'Coloquei meu filho no kids e a mudanca na disciplina dele foi visível. Recomendo demais.', 'aprovada', 'site'],
      ['Visitante', 5, 'Fiz aula experimental e fui muito bem recebido pela equipe.', 'pendente', 'site'],
    ];
    for (const [autor, nota, comentario, status, origem] of avaliacoesDemo) {
      executar(`
        INSERT INTO avaliacoes (autor_nome, nota, comentario, status, origem, aluno_id)
        VALUES (:autor, :nota, :comentario, :status, :origem,
                (SELECT id FROM alunos WHERE nome = :autor LIMIT 1))
      `, { autor, nota, comentario, status, origem });
    }

    const certificadosDemo = [
      ['Faixa preta de Jiu-Jitsu', 'mestre', 'Mestre Ricardo Barbosa', 'Jiu-Jitsu', 'Confederacao Brasileira de Jiu-Jitsu', 'CBJJ-2014-0912'],
      ['Instrutor certificado de Muay Thai', 'mestre', 'Mestra Camila Nogueira', 'Muay Thai', 'Confederacao Brasileira de Muay Thai', 'CBMT-2017-4471'],
      ['Faixa preta 1o grau', 'faixa_preta', 'Rafael Mendes', 'Jiu-Jitsu', 'Confederacao Brasileira de Jiu-Jitsu', 'CBJJ-2025-1180'],
      ['Curso de primeiros socorros para academias', 'curso', 'Equipe CT Atak', null, 'Cruz Vermelha Brasileira', null],
    ];
    for (const [titulo, tipo, pessoa, modalidade, entidade, registro] of certificadosDemo) {
      executar(`
        INSERT INTO certificados (titulo, tipo, pessoa_nome, modalidade_id, entidade, registro, data_emissao,
                                  publicar_site, usuario_id, criado_por)
        VALUES (:titulo, :tipo, :pessoa,
                (SELECT id FROM modalidades WHERE nome = :modalidade),
                :entidade, :registro, :data, 1,
                (SELECT id FROM usuarios WHERE nome = :pessoa),
                (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
      `, { titulo, tipo, pessoa, modalidade, entidade, registro, data: somarMeses(hoje(), -12) });
    }

    // Loja: uma linha por luta e os acessórios que servem para todo mundo.
    const produtosDemo = [
      ['Kimono Atak Trançado', 'Jiu-Jitsu', 'kimono', 549.9, 320, 8, 'A1, A2, A3, A4'],
      ['Faixa oficial de Jiu-Jitsu', 'Jiu-Jitsu', 'faixa', 89.9, 42, 24, 'A1, A2, A3, A4'],
      ['Rashguard Atak manga longa', 'Jiu-Jitsu', 'rashguard', 179.9, 92, 14, 'P, M, G, GG'],
      ['Short de Muay Thai Atak', 'Muay Thai', 'short', 129.9, 62, 18, 'P, M, G, GG'],
      ['Luva de Muay Thai 14oz', 'Muay Thai', 'luva', 289.9, 165, 10, '12oz, 14oz, 16oz'],
      ['Caneleira profissional', 'Muay Thai', 'caneleira', 219.9, 128, 9, 'M, G'],
      ['Kimono de Karatê Atak', 'Karatê', 'kimono', 329.9, 190, 6, '1, 2, 3, 4'],
      ['Faixa de Karatê', 'Karatê', 'faixa', 69.9, 28, 20, 'Único'],
      ['Luva de Boxe 12oz', 'Boxe', 'luva', 259.9, 148, 8, '10oz, 12oz, 14oz'],
      ['Bandagem elástica 3m', 'Boxe', 'acessorio', 39.9, 14, 40, 'Único'],
      ['Luva de Kickboxing', 'Kickboxing', 'luva', 269.9, 152, 7, '12oz, 14oz'],
      ['Luva de MMA 4oz', 'MMA', 'luva', 199.9, 110, 12, 'P, M, G'],
      ['Camisa de treino Atak', null, 'camisa', 89.9, 38, 30, 'P, M, G, GG'],
      ['Casaco moletom Atak', null, 'casaco', 199.9, 105, 15, 'P, M, G, GG'],
      ['Protetor bucal moldável', null, 'protetor', 49.9, 18, 35, 'Único'],
      ['Mochila Atak', null, 'mochila', 159.9, 86, 12, 'Único'],
      ['Garrafa térmica Atak 1L', null, 'acessorio', 79.9, 34, 22, 'Único'],
    ];
    for (const [nomeProduto, modalidade, categoria, preco, custo, estoque, tamanhos] of produtosDemo) {
      executar(`
        INSERT INTO produtos (nome, categoria, modalidade_id, preco, custo, estoque, tamanhos, descricao)
        VALUES (:nome, :categoria,
                (SELECT id FROM modalidades WHERE nome = :modalidade),
                :preco, :custo, :estoque, :tamanhos, :descricao)
      `, {
        nome: nomeProduto,
        categoria,
        modalidade,
        preco,
        custo,
        estoque,
        tamanhos,
        descricao: modalidade
          ? `Equipamento de ${modalidade} com a marca da Atak.`
          : 'Item da linha Atak, serve para qualquer modalidade.',
      });
    }

    const avisos = [
      ['Campeonato Estadual de Jiu-Jitsu', 'Inscrições abertas até dia 20. Falar com a recepção para confirmar a categoria e o peso.', 'campeonato', 'todos', somarMeses(hoje(), 1)],
      ['Sem aula no feriado', 'Na próxima sexta-feira a academia estará fechada. As aulas voltam no sábado no horário normal.', 'cancelamento', 'todos', null],
      ['Exame de faixa Kids', 'Alunos kids com frequência acima de 75% já podem se inscrever no próximo exame de faixa.', 'graduacao', 'kids', somarMeses(hoje(), 1)],
      ['Treino extra de MMA', 'Sábado teremos treino aberto de MMA das 10h as 12h. Traga protetor bucal.', 'evento', 'adultos', null],
    ];
    for (const [titulo, mensagem, tipo, publico, dataEvento] of avisos) {
      executar(`
        INSERT INTO avisos (titulo, mensagem, tipo, publico, data_evento, autor_id)
        VALUES (:titulo, :mensagem, :tipo, :publico, :data_evento,
                (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
      `, { titulo, mensagem, tipo, publico, data_evento: dataEvento });
    }

    gerarCheckins();
  });

  return { mensagem: 'Dados de demonstração carregados.' };
}

const executadoDireto = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (executadoDireto) {
  abrirBanco();
  const inicial = garantirDadosIniciais();
  if (inicial.criado) {
    console.log(`Dados iniciais criados. Login do dono: ${inicial.email} / ${inicial.senha}`);
  } else {
    console.log('Banco já inicializado.');
  }
  if (process.argv.includes('--demo')) {
    console.log(carregarDemonstracao().mensagem);
    console.log('Logins de demonstração: ricardo@atak.com / mestre123 | recepcao@atak.com / recepcao123');
  }
}
