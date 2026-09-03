import { abrirBanco, todos, um, executar, transacao } from './db.js';
import { gerarHashSenha } from './auth.js';
import { hoje, competenciaAtual, somarMeses } from './util.js';
import { aplicarGraduacoes, GRADUACOES_PADRAO } from './graduacoes-padrao.js';

/** Modalidades e faixas que ja vem prontas na primeira execucao. */
const MODALIDADES = [
  {
    nome: 'Jiu-Jitsu', sigla: 'JJ', destaque: 'Kids, adulto e competição · No-Gi e Gi', cor: '#2a78d6',
    descricao: 'Arte suave focada em luta de solo, quedas, raspagens e finalizações.',
  },
  {
    nome: 'Muay Thai', sigla: 'MT', destaque: 'Turmas kids, adulto e feminino', cor: '#eb6834',
    descricao: 'Boxe tailandês: socos, chutes, joelhadas, cotoveladas e clinch.',
  },
  {
    nome: 'Karatê', sigla: 'KA', destaque: 'Kids a partir de 5 anos e adulto', cor: '#1baf7a',
    descricao: 'Arte marcial japonesa com katas, golpes tradicionais e disciplina.',
  },
  {
    nome: 'Judô', sigla: 'JU', destaque: 'Kids, adulto e equipe de competição', cor: '#3c6fd1',
    descricao: 'Quedas, imobilizações e projeções: o caminho suave olímpico.',
  },
  {
    nome: 'Capoeira', sigla: 'CP', destaque: 'Roda, música e movimento para todas as idades', cor: '#c98c1e',
    descricao: 'Luta, dança e cultura brasileira na roda, com berimbau e ginga.',
  },
  {
    nome: 'Kickboxing', sigla: 'KB', destaque: 'Condicionamento e técnica, todos os níveis', cor: '#eda100',
    descricao: 'Combinação de boxe e chutes, muito condicionamento e ritmo.',
  },
  {
    nome: 'Taekwondo', sigla: 'TK', destaque: 'Chutes altos, kids e adulto', cor: '#5b8def',
    descricao: 'Arte marcial coreana de chutes rápidos, altos e precisos.',
  },
  {
    nome: 'Boxe', sigla: 'BX', destaque: 'Base de mãos para iniciantes e avançados', cor: '#4a3aa7',
    descricao: 'Jogo de mãos, esquiva e ritmo: a base da trocação em qualquer luta.',
  },
  {
    nome: 'MMA', sigla: 'MMA', destaque: 'Iniciante e equipe de competição', cor: '#e87ba4',
    descricao: 'Artes marciais mistas: trocação, quedas e solo em um só treino.',
  },
];

/**
 * Um plano por arte marcial: quem entra para o Jiu-Jitsu paga o Jiu-Jitsu.
 * Os combinados existem para quem treina duas artes, e são a única exceção.
 */
const PLANOS = [
  { nome: 'Jiu-Jitsu Kids', modalidade: 'Jiu-Jitsu', categoria: 'kids', valor: 130, aulas_semana: 3,
    descricao: 'Turmas infantis de Jiu-Jitsu, três vezes por semana.' },
  { nome: 'Jiu-Jitsu Adulto', modalidade: 'Jiu-Jitsu', categoria: 'adulto', valor: 180, aulas_semana: 0,
    descricao: 'Todos os horários de Jiu-Jitsu, manhã e noite, Gi e No-Gi.' },
  { nome: 'Muay Thai Kids', modalidade: 'Muay Thai', categoria: 'kids', valor: 125, aulas_semana: 2,
    descricao: 'Muay Thai infantil, duas vezes por semana.' },
  { nome: 'Muay Thai Adulto', modalidade: 'Muay Thai', categoria: 'adulto', valor: 165, aulas_semana: 0,
    descricao: 'Muay Thai adulto e feminino, todos os horários.' },
  { nome: 'Karatê Kids', modalidade: 'Karatê', categoria: 'kids', valor: 120, aulas_semana: 2,
    descricao: 'Karatê infantil a partir dos cinco anos.' },
  { nome: 'Karatê Adulto', modalidade: 'Karatê', categoria: 'adulto', valor: 150, aulas_semana: 2,
    descricao: 'Karatê adulto, kata e kumite.' },
  { nome: 'Judô Kids', modalidade: 'Judô', categoria: 'kids', valor: 125, aulas_semana: 2,
    descricao: 'Judô infantil, quedas e imobilizações com segurança.' },
  { nome: 'Judô Adulto', modalidade: 'Judô', categoria: 'adulto', valor: 160, aulas_semana: 2,
    descricao: 'Judô adulto, com randori nas quintas.' },
  { nome: 'Capoeira', modalidade: 'Capoeira', categoria: 'misto', valor: 130, aulas_semana: 3,
    descricao: 'Capoeira para todas as idades, com roda aberta no sábado.' },
  { nome: 'Kickboxing', modalidade: 'Kickboxing', categoria: 'adulto', valor: 160, aulas_semana: 3,
    descricao: 'Kickboxing adulto, condicionamento e técnica.' },
  { nome: 'Taekwondo', modalidade: 'Taekwondo', categoria: 'misto', valor: 140, aulas_semana: 2,
    descricao: 'Taekwondo kids e adulto.' },
  { nome: 'Boxe', modalidade: 'Boxe', categoria: 'adulto', valor: 155, aulas_semana: 2,
    descricao: 'Boxe adulto, do primeiro jab ao sparring.' },
  { nome: 'MMA', modalidade: 'MMA', categoria: 'adulto', valor: 190, aulas_semana: 0,
    descricao: 'MMA iniciante e equipe de competição.' },
  { nome: 'Combinado: duas artes', modalidade: null, categoria: 'adulto', valor: 240, aulas_semana: 0,
    descricao: 'Escolha duas modalidades e treine em todos os horários das duas.' },
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
  ['Judô', 'Judô Kids', 'kids', 'todos', [[2, '16:00', '17:00'], [4, '16:00', '17:00']]],
  ['Judô', 'Judô Adulto', 'adulto', 'todos', [[2, '20:00', '21:30'], [4, '20:00', '21:30']]],
  ['Capoeira', 'Capoeira Kids', 'kids', 'todos', [[3, '16:00', '17:00'], [5, '16:00', '17:00']]],
  ['Capoeira', 'Capoeira Roda Aberta', 'misto', 'todos', [[6, '09:00', '11:00', 'Roda']]],
  ['Taekwondo', 'Taekwondo Kids', 'kids', 'todos', [[1, '16:00', '17:00'], [3, '16:00', '17:00']]],
  ['Taekwondo', 'Taekwondo Adulto', 'adulto', 'todos', [[1, '21:00', '22:00'], [3, '21:00', '22:00']]],
];

const CONFIGURACOES = {
  nome_academia: 'CT Atak Pechincha',
  telefone: '(21) 97024-0245',
  whatsapp: '5521970240245',
  endereco: 'Rua Coronel Francisco Lobo, 145 - Pechincha, Rio de Janeiro - RJ, 22740-350',
  instagram: '@ct_atak',
  instagram_url: 'https://www.instagram.com/ct_atak',
  chamada: 'Centro de treinamento de lutas',
  manchete: 'Formando lutador de verdade na Atak.',
  sobre: 'Jiu-Jitsu, Muay Thai, Karatê, Judô, Capoeira, Boxe, Kickboxing, Taekwondo e MMA. Turmas kids, adulto e feminino, do primeiro dia no tatame até a equipe de competição.',
  historia: 'São mais de 15 anos formando atletas e mudando histórias na Pechincha. O que começou como um projeto de bairro virou um centro de treinamento com equipe de competição, turmas kids e professores graduados.',
  horario_funcionamento: 'Segunda a sexta, das 6h às 22h · Sábado, das 9h às 13h',
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
        INSERT INTO modalidades (nome, descricao, cor, destaque, sigla, ordem)
        VALUES (:nome, :descricao, :cor, :destaque, :sigla, :ordem)
      `, {
        nome: modalidade.nome,
        descricao: modalidade.descricao,
        cor: modalidade.cor,
        destaque: modalidade.destaque || null,
        sigla: modalidade.sigla || null,
        ordem,
      });
      // A escala de faixas vem do catalogo oficial de cada arte marcial.
      aplicarGraduacoes(executar, todos, Number(criada.lastInsertRowid), modalidade.nome);
    });

    for (const plano of PLANOS) {
      const criado = executar(`INSERT INTO planos (nome, descricao, valor, periodicidade, aulas_semana)
                VALUES (:nome, :descricao, :valor, 'mensal', :aulas_semana)`, {
        nome: plano.nome,
        descricao: plano.descricao,
        valor: plano.valor,
        aulas_semana: plano.aulas_semana,
      });
      if (plano.modalidade) {
        executar(`INSERT INTO plano_modalidades (plano_id, modalidade_id)
                  SELECT :plano, id FROM modalidades WHERE nome = :modalidade`,
          { plano: Number(criado.lastInsertRowid), modalidade: plano.modalidade });
      }
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
 * Preenche o registro de atividades da demonstração, para o painel de
 * segurança já nascer contando quem fez o quê nas últimas semanas.
 */
function gerarHistorico() {
  const equipe = todos(`SELECT id, nome, papel FROM usuarios WHERE papel != 'aluno'`);
  const ACOES = [
    ['entrou no sistema', 'acesso', null],
    ['registrou pagamento de', 'financeiro', 'Mensalidade do mês'],
    ['publicou o aviso', 'avisos', 'Treino extra de sábado'],
    ['fez a chamada de', 'chamada', 'Turma da noite'],
    ['cadastrou', 'alunos', 'Novo aluno'],
    ['alterou', 'turmas', 'Horário da turma'],
    ['criou', 'competicoes', 'Copa Rio de Jiu-Jitsu'],
    ['incluiu atleta', 'equipes', 'Atak Competição Jiu-Jitsu'],
    ['aplicou a escala oficial', 'graduacoes', 'Jiu-Jitsu'],
    ['registrou venda', 'loja', 'Kimono Atak Trançado'],
  ];

  for (let atras = 29; atras >= 0; atras -= 1) {
    const dia = new Date();
    dia.setDate(dia.getDate() - atras);
    const quantas = 2 + (atras % 4);
    for (let n = 0; n < quantas; n += 1) {
      const pessoa = equipe[(atras * 3 + n) % equipe.length];
      const [acao, area, alvo] = ACOES[(atras * 5 + n) % ACOES.length];
      const hora = `${String(8 + ((atras + n) % 13)).padStart(2, '0')}:${String((n * 17) % 60).padStart(2, '0')}:00`;
      executar(`
        INSERT INTO auditoria (usuario_id, usuario_nome, papel, acao, area, alvo, criado_em)
        VALUES (:id, :nome, :papel, :acao, :area, :alvo, :quando)
      `, {
        id: pessoa.id, nome: pessoa.nome, papel: pessoa.papel, acao, area, alvo,
        quando: `${dia.toLocaleDateString('sv-SE')} ${hora}`,
      });
    }
  }
}

/**
 * Dá a cada aluno a faixa compatível com o tempo de casa e a modalidade que
 * ele treina, para as telas de graduação nascerem com história.
 */
function gerarGraduacoes() {
  const vinculos = todos(`
    SELECT DISTINCT at.aluno_id, t.modalidade_id, a.categoria, a.matriculado_em
    FROM aluno_turmas at
    JOIN turmas t ON t.id = at.turma_id
    JOIN alunos a ON a.id = at.aluno_id
  `);

  for (const vinculo of vinculos) {
    const escala = todos(`
      SELECT id, ordem FROM graduacoes
      WHERE modalidade_id = :m AND faixa_etaria IN (:etaria, 'ambos')
      ORDER BY ordem
    `, { m: vinculo.modalidade_id, etaria: vinculo.categoria });
    if (!escala.length) continue;

    // Quanto mais tempo de casa, mais alto o degrau - com um teto prudente.
    const teto = Math.max(1, Math.ceil(escala.length * 0.45));
    const passo = (vinculo.aluno_id * 5) % teto;
    const alvo = escala[passo];
    executar(`
      INSERT INTO aluno_graduacoes (aluno_id, modalidade_id, graduacao_id, data, grau, observacao)
      VALUES (:aluno, :modalidade, :graduacao, :data, :grau, 'Graduação registrada no exame da academia.')
    `, {
      aluno: vinculo.aluno_id,
      modalidade: vinculo.modalidade_id,
      graduacao: alvo.id,
      data: somarMeses(vinculo.matriculado_em || hoje(), 1),
      grau: (vinculo.aluno_id * 3) % 4,
    });
  }
}

/**
 * Monta as equipes de competição por modalidade, o calendário de campeonatos
 * e o quadro de medalhas dos campeonatos que já aconteceram.
 */
function gerarCompeticoes(idsMestres) {
  const EQUIPES = [
    ['Atak Competição Jiu-Jitsu', 'Jiu-Jitsu', 'adulto', 'Equipe adulta de Gi e No-Gi, treina terça, quinta e sábado.'],
    ['Atak Kids Jiu-Jitsu', 'Jiu-Jitsu', 'kids', 'Time infantil que representa a Atak nos festivais da federação.'],
    ['Atak Muay Thai Fight Team', 'Muay Thai', 'adulto', 'Atletas de ringue com preparação física dedicada.'],
    ['Atak Karatê Kata e Kumite', 'Karatê', 'misto', 'Time de kata e kumite da federação estadual.'],
    ['Atak Judô', 'Judô', 'misto', 'Equipe de judô para torneios estaduais e regionais.'],
    ['Atak Boxe Amador', 'Boxe', 'adulto', 'Atletas de classe C e B em preparação para as seletivas.'],
    ['Atak MMA Pro', 'MMA', 'adulto', 'Time de MMA amador e profissional do CT Atak.'],
    ['Atak Muay Thai Feminino', 'Muay Thai', 'feminino', 'Equipe feminina de Muay Thai, treino às terças e quintas.'],
  ];

  /** Escolhe um professor que realmente ensina aquela arte marcial. */
  function mestreDaModalidade(nomeModalidade, mestres, alternativa) {
    const habilitados = todos(`
      SELECT um.usuario_id FROM usuario_modalidades um
      JOIN modalidades m ON m.id = um.modalidade_id
      WHERE m.nome = :nome ORDER BY um.usuario_id
    `, { nome: nomeModalidade }).map((linha) => linha.usuario_id);
    return habilitados.length
      ? habilitados[alternativa % habilitados.length]
      : mestres[alternativa % mestres.length];
  }

  const idsEquipes = {};
  EQUIPES.forEach(([nome, modalidade, categoria, descricao], indice) => {
    const modalidadeLinha = um('SELECT id, cor FROM modalidades WHERE nome = :nome', { nome: modalidade });
    if (!modalidadeLinha) return;
    const criada = executar(`
      INSERT INTO equipes (nome, modalidade_id, categoria, tecnico_id, descricao, cor)
      VALUES (:nome, :modalidade, :categoria, :tecnico, :descricao, :cor)
    `, {
      nome,
      modalidade: modalidadeLinha.id,
      categoria,
      tecnico: mestreDaModalidade(modalidade, idsMestres, indice),
      descricao,
      cor: modalidadeLinha.cor,
    });
    idsEquipes[nome] = { id: Number(criada.lastInsertRowid), modalidade: modalidadeLinha.id, categoria };
  });

  // Cada equipe puxa atletas que ja treinam a modalidade dela.
  for (const dados of Object.values(idsEquipes)) {
    // Busca já filtrando pela categoria da equipe, para o time kids não ficar vazio.
    const candidatos = todos(`
      SELECT DISTINCT a.id FROM alunos a
      JOIN aluno_turmas at ON at.aluno_id = a.id
      JOIN turmas t ON t.id = at.turma_id
      WHERE t.modalidade_id = :m AND a.status = 'ativo' AND a.categoria = :categoria
      ORDER BY a.id LIMIT 6
    `, { m: dados.modalidade, categoria: dados.categoria === 'kids' ? 'kids' : 'adulto' });
    candidatos
      .forEach((aluno, posicao) => {
        executar(`
          INSERT OR IGNORE INTO equipe_membros (equipe_id, aluno_id, funcao, desde)
          VALUES (:equipe, :aluno, :funcao, :desde)
        `, {
          equipe: dados.id,
          aluno: aluno.id,
          funcao: posicao === 0 ? 'capitao' : 'atleta',
          desde: somarMeses(hoje(), -6),
        });
      });
  }

  const COMPETICOES = [
    ['Copa Rio de Jiu-Jitsu', 'Jiu-Jitsu', 'campeonato', 'estadual', 'Federação de Jiu-Jitsu do Rio de Janeiro',
      1, 'Tijuca Tênis Clube', 'Rio de Janeiro', 120, 'inscricoes'],
    ['Seletiva Estadual de Muay Thai', 'Muay Thai', 'seletiva', 'estadual', 'CBMT Rio',
      1, 'Ginásio do Maracanãzinho', 'Rio de Janeiro', 90, 'inscricoes'],
    ['Festival Kids da Atak', 'Jiu-Jitsu', 'interno', 'interno', 'CT Atak Pechincha',
      2, 'CT Atak Pechincha', 'Rio de Janeiro', 0, 'agendada'],
    ['Campeonato Carioca de Karatê', 'Karatê', 'campeonato', 'estadual', 'Federação de Karatê do Estado do Rio',
      2, 'Vila Olímpica da Mangueira', 'Rio de Janeiro', 100, 'agendada'],
    ['Torneio Regional de Judô', 'Judô', 'campeonato', 'municipal', 'Federação de Judô do Rio de Janeiro',
      3, 'Clube Municipal', 'Rio de Janeiro', 80, 'agendada'],
    ['Copa Brasil de Jiu-Jitsu', 'Jiu-Jitsu', 'campeonato', 'nacional', 'CBJJ',
      -2, 'Ginásio do Ibirapuera', 'São Paulo', 180, 'realizada'],
    ['Desafio de Boxe Amador', 'Boxe', 'amistoso', 'municipal', 'Liga Carioca de Boxe',
      -1, 'CT Atak Pechincha', 'Rio de Janeiro', 0, 'realizada'],
    ['Batizado e Troca de Cordas', 'Capoeira', 'festival', 'interno', 'CT Atak Pechincha',
      -1, 'CT Atak Pechincha', 'Rio de Janeiro', 60, 'realizada'],
  ];

  COMPETICOES.forEach(([nome, modalidade, tipo, nivel, organizador, mesesAFrente, local, cidade, taxa, status], indice) => {
    const dataInicio = somarMeses(hoje(), mesesAFrente);
    const criada = executar(`
      INSERT INTO competicoes (nome, modalidade_id, tipo, nivel, organizador, data_inicio, inscricao_ate,
                               local, cidade, endereco, taxa, vagas, descricao, status, responsavel_id,
                               publicar_site, criado_por)
      VALUES (:nome, (SELECT id FROM modalidades WHERE nome = :modalidade), :tipo, :nivel, :organizador,
              :data_inicio, :inscricao_ate, :local, :cidade, :endereco, :taxa, :vagas, :descricao, :status,
              :responsavel, 1, (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
    `, {
      nome, modalidade, tipo, nivel, organizador,
      data_inicio: dataInicio,
      inscricao_ate: mesesAFrente > 0 ? somarMeses(dataInicio, -1) : null,
      local, cidade,
      endereco: `${local} - ${cidade}`,
      taxa,
      vagas: 0,
      descricao: `Competição de ${modalidade} organizada por ${organizador}. Fale com o responsável para confirmar categoria e peso.`,
      status,
      responsavel: mestreDaModalidade(modalidade, idsMestres, indice),
    });

    const competicaoId = Number(criada.lastInsertRowid);
    // O festival kids leva atletas kids; o resto leva os adultos.
    const categoriaAlvo = /kids/i.test(nome) ? 'kids' : 'adulto';
    const inscritos = todos(`
      SELECT DISTINCT a.id FROM alunos a
      JOIN aluno_turmas at ON at.aluno_id = a.id
      JOIN turmas t ON t.id = at.turma_id
      JOIN modalidades m ON m.id = t.modalidade_id
      WHERE m.nome = :modalidade AND a.status = 'ativo' AND a.categoria = :categoria
      ORDER BY a.id LIMIT 7
    `, { modalidade, categoria: categoriaAlvo });

    const MEDALHAS = ['ouro', 'prata', 'bronze', 'participacao'];
    inscritos.forEach((aluno, posicao) => {
      const inscricao = executar(`
        INSERT INTO competicao_inscricoes (competicao_id, aluno_id, equipe_id, categoria_peso, status, taxa_paga,
                                           criado_por)
        VALUES (:competicao, :aluno,
                (SELECT id FROM equipes WHERE modalidade_id =
                  (SELECT id FROM modalidades WHERE nome = :modalidade) LIMIT 1),
                :peso, :status, :pago, (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
      `, {
        competicao: competicaoId,
        aluno: aluno.id,
        modalidade,
        peso: null,
        status: status === 'realizada' ? 'confirmado' : (posicao % 4 === 3 ? 'interesse' : 'inscrito'),
        pago: status === 'realizada' || posicao % 3 !== 0 ? 1 : 0,
      });

      if (status !== 'realizada' || posicao > 3) return;
      executar(`
        INSERT INTO competicao_resultados (inscricao_id, colocacao, medalha, lutas, vitorias, finalizacoes,
                                           registrado_por)
        VALUES (:inscricao, :colocacao, :medalha, :lutas, :vitorias, :finalizacoes,
                (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
      `, {
        inscricao: Number(inscricao.lastInsertRowid),
        colocacao: posicao + 1,
        medalha: MEDALHAS[posicao],
        lutas: 3 + (posicao % 2),
        vitorias: Math.max(0, 3 - posicao),
        finalizacoes: Math.max(0, 2 - posicao),
      });
    });
  });
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

  // 75 dias de histórico: dá base para comparar o mês atual com o anterior.
  for (let atras = 74; atras >= 0; atras -= 1) {
    const dia = new Date();
    dia.setDate(dia.getDate() - atras);
    const iso = dia.toLocaleDateString('sv-SE');
    const registrados = new Set();

    for (const vinculo of vinculos) {
      if (vinculo.dia_semana !== dia.getDay()) continue;
      const chave = `${vinculo.aluno_id}-${vinculo.turma_id}`;
      if (registrados.has(chave)) continue;
      // Frequência entre 45% e 85%, variando de aluno para aluno.
      const base = 0.45 + ((vinculo.aluno_id * 7) % 40) / 100;
      // Algumas turmas vêm crescendo e outras caindo, para a análise ter o que mostrar.
      const rumo = ((vinculo.turma_id % 3) - 1) * 0.3 * (1 - atras / 74);
      if (Math.random() > Math.min(0.95, Math.max(0.15, base + rumo))) continue;
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
  const TURMAS_KIDS = ['Jiu-Jitsu Kids', 'Muay Thai Kids', 'Karatê Kids', 'Judô Kids', 'Capoeira Kids', 'Taekwondo Kids'];
  const TURMAS_ADULTO = [
    'Jiu-Jitsu Adulto Manhã', 'Jiu-Jitsu Adulto Noite', 'Muay Thai Adulto', 'Muay Thai Feminino',
    'Karatê Adulto', 'Kickboxing Adulto', 'Boxe Adulto', 'MMA Iniciante', 'MMA Competição',
    'Judô Adulto', 'Capoeira Roda Aberta', 'Taekwondo Adulto',
  ];
  const NOMES = [
    'Lucas Ferreira', 'Mariana Costa', 'Rafael Mendes', 'Juliana Rocha', 'Carlos Eduardo Lima',
    'Beatriz Almeida', 'Thiago Barros', 'Camila Duarte', 'Bruno Antunes', 'Larissa Pires',
    'Diego Nascimento', 'Patrícia Gomes', 'Felipe Cardoso', 'Amanda Ribeiro', 'Vinícius Teixeira',
    'Gabriela Moraes', 'Rodrigo Farias', 'Aline Fontes', 'Pedro Henrique Alves', 'Marcela Duarte',
    'Otávio Bezerra', 'Renata Lopes', 'Caio Villar', 'Isabela Prado',
    // Turma infantil: duas crianças por aula kids.
    'Ana Beatriz Souza', 'Sofia Martins', 'Miguel Andrade', 'Helena Vasques', 'Davi Lucca Ramos',
    'Enzo Gabriel Rocha', 'Manuela Freitas', 'Arthur Bonfim', 'Cecília Nunes', 'Bernardo Paiva',
    'Alice Camargo', 'Théo Vasconcelos',
  ];
  // Os 12 últimos são kids; o último da lista fica pendente, esperando a recepção.
  const alunosDemo = NOMES.map((nome, indice) => {
    const ehKids = indice >= NOMES.length - 12;
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
      {
        nome: 'Mestre Ricardo Barbosa', email: 'ricardo@atak.com', apelido: 'Mestre Ricardo',
        faixa: 'Faixa preta 4º grau de Jiu-Jitsu', desde: '2009-03-01',
        modalidades: ['Jiu-Jitsu', 'MMA'],
        bio: 'Faixa preta pela CBJJ desde 2014, formou mais de 30 faixas pretas e comanda a equipe de competição da Atak.',
        cargos: [['competicoes', null], ['graduacao', 'Jiu-Jitsu']],
      },
      {
        nome: 'Mestra Camila Nogueira', email: 'camila@atak.com', apelido: 'Mestra Camila',
        faixa: 'Prajied preto de Muay Thai', desde: '2012-08-01',
        modalidades: ['Muay Thai', 'Kickboxing'],
        bio: 'Kru formada pela CBMT, referência no Muay Thai feminino da Zona Oeste e árbitra estadual.',
        cargos: [['kids', null], ['marketing', null]],
      },
      {
        nome: 'Sensei Paulo Tanaka', email: 'paulo@atak.com', apelido: 'Sensei Paulo',
        faixa: 'Faixa preta 3º dan de Karatê e 2º dan de Judô', desde: '2011-02-01',
        modalidades: ['Karatê', 'Judô'],
        bio: 'Formado pela Federação de Karatê do Rio de Janeiro, treina atletas de kata e kumite desde 2005.',
        cargos: [['graduacao', 'Karatê']],
      },
      {
        nome: 'Contramestre Jorge Alves', email: 'jorge@atak.com', apelido: 'Contramestre Jorge',
        faixa: 'Corda marrom e vermelha de Capoeira', desde: '2015-05-01',
        modalidades: ['Capoeira'],
        bio: 'Contramestre de capoeira contemporânea, toca berimbau desde os 9 anos e conduz a roda de sábado.',
        cargos: [],
      },
      {
        nome: 'Treinador Diego Moura', email: 'diego@atak.com', apelido: 'Treinador Diego',
        faixa: 'Técnico nível A de Boxe pela CBBoxe', desde: '2016-09-01',
        modalidades: ['Boxe', 'Taekwondo'],
        bio: 'Ex-atleta amador com 28 lutas, hoje prepara a equipe de boxe da Atak para as seletivas estaduais.',
        cargos: [['competicoes', 'Boxe']],
      },
    ];
    const idsMestres = mestres.map((mestre) => {
      const criado = executar(`
        INSERT INTO usuarios (nome, email, senha_hash, papel, telefone, apelido, faixa, bio, desde, publicar_site)
        VALUES (:nome, :email, :hash, 'mestre', '(21) 97024-0245', :apelido, :faixa, :bio, :desde, 1)
      `, {
        nome: mestre.nome, email: mestre.email, hash: gerarHashSenha('mestre123'),
        apelido: mestre.apelido, faixa: mestre.faixa, bio: mestre.bio, desde: mestre.desde,
      });
      const id = Number(criado.lastInsertRowid);
      for (const nomeModalidade of mestre.modalidades) {
        executar(`INSERT INTO usuario_modalidades (usuario_id, modalidade_id)
                  SELECT :id, id FROM modalidades WHERE nome = :nome`, { id, nome: nomeModalidade });
      }
      for (const [cargo, modalidade] of mestre.cargos) {
        executar(`INSERT INTO usuario_cargos (usuario_id, cargo, modalidade_id)
                  VALUES (:id, :cargo, (SELECT id FROM modalidades WHERE nome = :modalidade))`,
          { id, cargo, modalidade });
      }
      return id;
    });

    executar(`INSERT INTO usuarios (nome, email, senha_hash, papel, apelido) VALUES (:nome, :email, :hash, 'recepcao', 'Recepção Atak')`,
      { nome: 'Recepção', email: 'recepcao@atak.com', hash: gerarHashSenha('recepcao123') });

    // Cada turma fica com um mestre que realmente ensina aquela arte marcial.
    const turmas = todos('SELECT id, nome, modalidade_id FROM turmas');
    let reserva = 0;
    for (const turma of turmas) {
      const habilitados = todos(`
        SELECT usuario_id FROM usuario_modalidades WHERE modalidade_id = :m ORDER BY usuario_id
      `, { m: turma.modalidade_id }).map((linha) => linha.usuario_id);
      const escolhido = habilitados.length
        ? habilitados[turma.id % habilitados.length]
        : idsMestres[reserva++ % idsMestres.length];
      executar('UPDATE turmas SET mestre_id = :m WHERE id = :id', { m: escolhido, id: turma.id });
    }

    // A demonstração usa apenas planos mensais, para o caixa do mes fazer sentido.
    // Cada aluno entra no plano da arte que ele treina, na categoria dele.
    const planos = todos(`
      SELECT p.*, pm.modalidade_id FROM planos p
      LEFT JOIN plano_modalidades pm ON pm.plano_id = p.id
      WHERE p.ativo = 1 ORDER BY p.valor
    `);
    const planoDaTurma = (nomeTurma, categoriaAluno) => {
      const turma = um(`SELECT modalidade_id FROM turmas WHERE nome = :nome`, { nome: nomeTurma });
      const daArte = planos.filter((p) => p.modalidade_id === turma?.modalidade_id);
      const kids = categoriaAluno === 'kids';
      return daArte.find((p) => (kids ? /Kids/i.test(p.nome) : !/Kids/i.test(p.nome)))
        || daArte[0]
        || planos[0];
    };
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

      const plano = planoDaTurma(nomeTurma, categoria);

      // O aluno entrou em algum momento dos ultimos 6 meses.
      const mesesDeCasa = Math.min(5, indice);
      const entrada = somarMeses(hoje(), -mesesDeCasa);
      // Cada aluno escolhe o dia do vencimento, como acontece na recepção.
      const diaVencimento = [5, 10, 20][indice % 3];
      const matricula = executar(`
        INSERT INTO matriculas (aluno_id, plano_id, inicio, fim, valor, dia_vencimento, status, criado_em)
        VALUES (:a, :p, :inicio, :fim, :valor, :dia, 'ativa', :criado_em)
      `, {
        a: alunoId, p: plano.id, inicio: entrada, fim: somarMeses(entrada, 12), valor: plano.valor,
        dia: diaVencimento, criado_em: `${entrada} 09:00:00`,
      });
      const matriculaId = Number(matricula.lastInsertRowid);

      // Historico de mensalidades desde a entrada ate o mes atual.
      for (let atras = mesesDeCasa; atras >= 0; atras -= 1) {
        const mes = somarMeses(hoje(), -atras).slice(0, 7);
        const mesAtual = mes === competencia;
        // Academia de verdade tem inadimplente: um em cada sete deixa o mês
        // anterior vencer, e parte do mês corrente ainda está em aberto.
        const atrasaOMesPassado = atras === 1 && indice % 7 === 0;
        const pago = atrasaOMesPassado ? false : (!mesAtual || indice % 3 !== 0);
        const vencimento = `${mes}-${String(diaVencimento).padStart(2, '0')}`;
        const pagoEm = mesAtual ? hoje() : `${mes}-0${diaVencimento === 20 ? 8 : 6}`;
        executar(`
          INSERT INTO mensalidades (matricula_id, aluno_id, competencia, vencimento, valor, status, pago_em, forma_pagamento)
          VALUES (:mt, :a, :competencia, :vencimento, :valor, :status, :pago_em, :forma)
        `, {
          mt: matriculaId,
          a: alunoId,
          competencia: mes,
          vencimento,
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
      ['Faixa preta 4º grau de Jiu-Jitsu', 'mestre', 'Mestre Ricardo Barbosa', 'Jiu-Jitsu', 'Confederação Brasileira de Jiu-Jitsu', 'CBJJ-2014-0912'],
      ['Kru — instrutor formado de Muay Thai', 'mestre', 'Mestra Camila Nogueira', 'Muay Thai', 'Confederação Brasileira de Muay Thai', 'CBMT-2017-4471'],
      ['Faixa preta 3º dan de Karatê', 'mestre', 'Sensei Paulo Tanaka', 'Karatê', 'Federação de Karatê do Estado do Rio de Janeiro', 'FKERJ-2013-0330'],
      ['Corda marrom e vermelha de Capoeira', 'mestre', 'Contramestre Jorge Alves', 'Capoeira', 'Grupo de Capoeira Raízes do Brasil', 'GCRB-2019-0077'],
      ['Técnico nível A de Boxe', 'mestre', 'Treinador Diego Moura', 'Boxe', 'Confederação Brasileira de Boxe', 'CBBoxe-2018-2210'],
      ['Faixa preta 1º grau', 'faixa_preta', 'Rafael Mendes', 'Jiu-Jitsu', 'Confederação Brasileira de Jiu-Jitsu', 'CBJJ-2025-1180'],
      ['Registro da academia na federação estadual', 'federacao', 'CT Atak Pechincha', 'Jiu-Jitsu', 'Federação de Jiu-Jitsu do Estado do Rio de Janeiro', 'FJJERJ-2011-0451'],
      ['Curso de primeiros socorros para academias', 'curso', 'Equipe CT Atak', null, 'Cruz Vermelha Brasileira', null],
      ['Curso de arbitragem estadual', 'curso', 'Mestra Camila Nogueira', 'Muay Thai', 'Federação de Muay Thai do Rio de Janeiro', 'FMTERJ-2021-0918'],
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

    // Cada aviso tem um dono: a modalidade certa recebe o recado certo.
    const avisos = [
      ['Sem aula no feriado', 'Na próxima sexta-feira a academia estará fechada. As aulas voltam no sábado no horário normal.', 'cancelamento', 'todos', null, null],
      ['Exame de faixa Kids', 'Alunos kids com frequência acima de 75% já podem se inscrever no próximo exame de faixa.', 'graduacao', 'kids', null, somarMeses(hoje(), 1)],
      ['Seletiva da equipe de competição', 'Quem quiser entrar na equipe de competição precisa participar do treino de sábado.', 'evento', 'competidores', null, null],
      ['Treino de No-Gi reforçado', 'Nas terças o treino das 19h passa a ser todo de No-Gi, com foco em pegadas e raspagens.', 'evento', 'modalidade', 'Jiu-Jitsu', null],
      ['Exame de prajied', 'A troca de prajied do Muay Thai acontece no último sábado do mês. Fale com a Mestra Camila.', 'graduacao', 'modalidade', 'Muay Thai', somarMeses(hoje(), 1)],
      ['Roda de aniversário da Capoeira', 'Roda aberta com berimbau e batizado dos alunos novos. Convide a família.', 'evento', 'modalidade', 'Capoeira', somarMeses(hoje(), 1)],
      ['Kata obrigatório para a graduação', 'Quem vai fazer exame precisa apresentar o Heian Nidan completo. Treinamos nas quintas.', 'graduacao', 'modalidade', 'Karatê', null],
      ['Randori extra no Judô', 'Na quinta o treino termina com 30 minutos de randori. Traga o judogi reserva.', 'evento', 'modalidade', 'Judô', null],
      ['Sparring com equipamento completo', 'A partir desta semana o sparring de Boxe só com capacete, bucal e luva 14oz.', 'geral', 'modalidade', 'Boxe', null],
      ['Preparação para o desafio de MMA', 'Treino de grappling com luva às terças e quintas, das 21h às 22h30.', 'evento', 'modalidade', 'MMA', null],
      ['Aula de chutes altos', 'Sexta teremos aula especial de chutes altos no Taekwondo. Alongue antes.', 'evento', 'modalidade', 'Taekwondo', null],
      ['Novo horário do Kickboxing', 'O treino de quarta passa a começar 18h, meia hora mais cedo.', 'geral', 'modalidade', 'Kickboxing', null],
    ];
    for (const [titulo, mensagem, tipo, publico, modalidade, dataEvento] of avisos) {
      executar(`
        INSERT INTO avisos (titulo, mensagem, tipo, publico, modalidade_id, data_evento, autor_id)
        VALUES (:titulo, :mensagem, :tipo, :publico,
                (SELECT id FROM modalidades WHERE nome = :modalidade), :data_evento,
                (SELECT id FROM usuarios WHERE papel = 'dono' LIMIT 1))
      `, { titulo, mensagem, tipo, publico, modalidade, data_evento: dataEvento });
    }

    gerarGraduacoes();
    gerarCompeticoes(idsMestres);

    gerarCheckins();
    gerarHistorico();
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
