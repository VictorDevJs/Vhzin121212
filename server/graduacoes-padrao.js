/**
 * Catálogo oficial de graduações. Cada modalidade traz a escala completa de
 * faixas, cordas ou níveis que a academia usa para promover os alunos.
 *
 * Campos de cada degrau:
 *   nome        rótulo da faixa como ela é chamada no tatame
 *   cor         cor principal da faixa (usada nos gráficos e nas etiquetas)
 *   ponta       cor da ponta / ponteira, quando a faixa tem duas cores
 *   graus       quantidade de graus (pontas brancas) que cabem na faixa
 *   etaria      'kids', 'adulto' ou 'ambos'
 *   idade       idade mínima sugerida pela federação
 *   meses       tempo mínimo sugerido de permanência, em meses
 *   nota        explicação curta que aparece na tela
 */

const BRANCA = '#f2f2f2';
const PRETA = '#141414';

export const GRADUACOES_PADRAO = {
  'Jiu-Jitsu': {
    federacao: 'IBJJF / CBJJ',
    resumo: 'Faixas infantis dos 4 aos 15 anos e faixas adultas a partir dos 16, cada uma com até 4 graus.',
    degraus: [
      // --- infantil (4 a 15 anos) ---
      { nome: 'Branca', cor: BRANCA, graus: 4, etaria: 'ambos', idade: 4, meses: 0, nota: 'Início da caminhada. Base, postura e as primeiras posições.' },
      { nome: 'Cinza e Branca', cor: '#9aa0a6', ponta: BRANCA, graus: 4, etaria: 'kids', idade: 4, meses: 6, nota: 'Primeira graduação infantil, a partir dos 4 anos.' },
      { nome: 'Cinza', cor: '#9aa0a6', graus: 4, etaria: 'kids', idade: 4, meses: 6 },
      { nome: 'Cinza e Preta', cor: '#9aa0a6', ponta: PRETA, graus: 4, etaria: 'kids', idade: 4, meses: 6 },
      { nome: 'Amarela e Branca', cor: '#f2c94c', ponta: BRANCA, graus: 4, etaria: 'kids', idade: 7, meses: 6, nota: 'A partir dos 7 anos.' },
      { nome: 'Amarela', cor: '#f2c94c', graus: 4, etaria: 'kids', idade: 7, meses: 6 },
      { nome: 'Amarela e Preta', cor: '#f2c94c', ponta: PRETA, graus: 4, etaria: 'kids', idade: 7, meses: 6 },
      { nome: 'Laranja e Branca', cor: '#ec7a26', ponta: BRANCA, graus: 4, etaria: 'kids', idade: 10, meses: 6, nota: 'A partir dos 10 anos.' },
      { nome: 'Laranja', cor: '#ec7a26', graus: 4, etaria: 'kids', idade: 10, meses: 6 },
      { nome: 'Laranja e Preta', cor: '#ec7a26', ponta: PRETA, graus: 4, etaria: 'kids', idade: 10, meses: 6 },
      { nome: 'Verde e Branca', cor: '#1baf7a', ponta: BRANCA, graus: 4, etaria: 'kids', idade: 13, meses: 6, nota: 'A partir dos 13 anos.' },
      { nome: 'Verde', cor: '#1baf7a', graus: 4, etaria: 'kids', idade: 13, meses: 6 },
      { nome: 'Verde e Preta', cor: '#1baf7a', ponta: PRETA, graus: 4, etaria: 'kids', idade: 13, meses: 6, nota: 'Última faixa infantil antes da azul.' },
      // --- adulto (16 anos em diante) ---
      { nome: 'Azul', cor: '#2a78d6', graus: 4, etaria: 'adulto', idade: 16, meses: 24, nota: 'Primeira faixa adulta. Mínimo de 16 anos.' },
      { nome: 'Roxa', cor: '#7b4fc4', graus: 4, etaria: 'adulto', idade: 16, meses: 18, nota: 'Mínimo de 2 anos de azul e 16 anos de idade.' },
      { nome: 'Marrom', cor: '#7a4a24', graus: 4, etaria: 'adulto', idade: 18, meses: 12, nota: 'Mínimo de 1 ano e meio de roxa e 18 anos de idade.' },
      { nome: 'Preta', cor: PRETA, graus: 6, etaria: 'adulto', idade: 19, meses: 12, nota: 'Mínimo de 1 ano de marrom e 19 anos de idade. Vai até o 6º grau.' },
      { nome: 'Coral (preta e vermelha)', cor: '#c0392b', ponta: PRETA, graus: 0, etaria: 'adulto', idade: 50, meses: 0, nota: '7º grau: mestre com 31 anos de faixa preta.' },
      { nome: 'Coral (branca e vermelha)', cor: '#c0392b', ponta: BRANCA, graus: 0, etaria: 'adulto', idade: 57, meses: 0, nota: '8º grau, após 7 anos de coral preta e vermelha.' },
      { nome: 'Vermelha', cor: '#c0392b', graus: 0, etaria: 'adulto', idade: 67, meses: 0, nota: '9º e 10º graus: grão-mestre, a honraria máxima da arte.' },
    ],
  },

  'Muay Thai': {
    federacao: 'CBMT — sistema de Prajied (khan)',
    resumo: 'A graduação vem no prajied, a faixa amarrada no braço. São 13 degraus até o dourado.',
    degraus: [
      { nome: 'Branco', cor: BRANCA, graus: 0, etaria: 'ambos', meses: 0, nota: 'Iniciante: base, guarda e o wai kru.' },
      { nome: 'Vermelho', cor: '#e02020', graus: 0, etaria: 'ambos', meses: 4 },
      { nome: 'Rosa', cor: '#f08ab0', graus: 0, etaria: 'ambos', meses: 4 },
      { nome: 'Laranja', cor: '#ec7a26', graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Amarelo', cor: '#f2c94c', graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Verde', cor: '#1baf7a', graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Azul-claro', cor: '#5aa9e6', graus: 0, etaria: 'ambos', meses: 8 },
      { nome: 'Azul-escuro', cor: '#2a4fb0', graus: 0, etaria: 'ambos', meses: 8 },
      { nome: 'Marrom-claro', cor: '#a97142', graus: 0, etaria: 'adulto', meses: 10 },
      { nome: 'Marrom-escuro', cor: '#6b3d1c', graus: 0, etaria: 'adulto', meses: 10 },
      { nome: 'Preto', cor: PRETA, graus: 5, etaria: 'adulto', meses: 12, nota: 'Instrutor formado, com graus por tempo e por titulação.' },
      { nome: 'Prata', cor: '#b9bec6', graus: 0, etaria: 'adulto', meses: 24, nota: 'Kruang Sang: professor com formação avançada.' },
      { nome: 'Dourado', cor: '#f5b301', graus: 0, etaria: 'adulto', meses: 36, nota: 'Kru / Ajarn: mestre da arte.' },
    ],
  },

  'Karatê': {
    federacao: 'FIK / CBK — Shotokan',
    resumo: 'Nove kyus (faixas coloridas) até a faixa preta, que vai do 1º ao 10º dan.',
    degraus: [
      { nome: 'Branca (9º kyu)', cor: BRANCA, graus: 0, etaria: 'ambos', meses: 0, nota: 'Kihon: base, postura e respiração.' },
      { nome: 'Amarela (8º kyu)', cor: '#f2c94c', graus: 0, etaria: 'ambos', meses: 3 },
      { nome: 'Vermelha (7º kyu)', cor: '#e02020', graus: 0, etaria: 'ambos', meses: 4 },
      { nome: 'Laranja (6º kyu)', cor: '#ec7a26', graus: 0, etaria: 'ambos', meses: 4 },
      { nome: 'Verde (5º kyu)', cor: '#1baf7a', graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Roxa (4º kyu)', cor: '#7b4fc4', graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Marrom 3º kyu', cor: '#7a4a24', graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Marrom 2º kyu', cor: '#7a4a24', graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Marrom 1º kyu', cor: '#7a4a24', graus: 0, etaria: 'ambos', meses: 6, nota: 'Último kyu antes do exame de faixa preta.' },
      { nome: 'Preta (dan)', cor: PRETA, graus: 10, etaria: 'adulto', idade: 16, meses: 12, nota: 'Do 1º ao 10º dan. Cada dan exige tempo e exame próprios.' },
    ],
  },

  'Judô': {
    federacao: 'CBJ — Confederação Brasileira de Judô',
    resumo: 'Faixas infantis com cinza, azul e roxa; a partir dos 15 anos entra a escala adulta até a faixa vermelha.',
    degraus: [
      { nome: 'Branca', cor: BRANCA, graus: 0, etaria: 'ambos', meses: 0, nota: 'Ukemi: a arte de cair sem se machucar.' },
      { nome: 'Cinza', cor: '#9aa0a6', graus: 0, etaria: 'kids', idade: 7, meses: 6, nota: 'Faixa infantil, dos 7 aos 9 anos.' },
      { nome: 'Azul-clara', cor: '#5aa9e6', graus: 0, etaria: 'kids', idade: 7, meses: 6 },
      { nome: 'Amarela', cor: '#f2c94c', graus: 0, etaria: 'ambos', idade: 10, meses: 6 },
      { nome: 'Laranja', cor: '#ec7a26', graus: 0, etaria: 'ambos', idade: 10, meses: 6 },
      { nome: 'Verde', cor: '#1baf7a', graus: 0, etaria: 'ambos', idade: 12, meses: 8 },
      { nome: 'Roxa', cor: '#7b4fc4', graus: 0, etaria: 'kids', idade: 13, meses: 8, nota: 'Faixa de transição, dos 13 aos 14 anos.' },
      { nome: 'Marrom', cor: '#7a4a24', graus: 0, etaria: 'adulto', idade: 15, meses: 12 },
      { nome: 'Preta (1º ao 5º dan)', cor: PRETA, graus: 5, etaria: 'adulto', idade: 18, meses: 24, nota: 'Sho-dan a Go-dan, com exame técnico e tempo mínimo.' },
      { nome: 'Coral (6º ao 8º dan)', cor: '#c0392b', ponta: BRANCA, graus: 3, etaria: 'adulto', idade: 50, meses: 0, nota: 'Mestres com longa dedicação ao judô.' },
      { nome: 'Vermelha (9º e 10º dan)', cor: '#c0392b', graus: 2, etaria: 'adulto', idade: 65, meses: 0, nota: 'A mais alta honraria do judô.' },
    ],
  },

  'Capoeira': {
    federacao: 'Sistema de cordas — capoeira contemporânea',
    resumo: 'A graduação é a corda amarrada na cintura. Cada corda vem junto com um título dentro do grupo.',
    degraus: [
      { nome: 'Corda Crua', cor: '#e6ddc4', graus: 0, etaria: 'ambos', meses: 0, nota: 'Aluno iniciante: ginga, esquiva e a roda.' },
      { nome: 'Crua e Amarela', cor: '#e6ddc4', ponta: '#f2c94c', graus: 0, etaria: 'ambos', meses: 6, nota: 'Aluno.' },
      { nome: 'Amarela', cor: '#f2c94c', graus: 0, etaria: 'ambos', meses: 8, nota: 'Aluno graduado.' },
      { nome: 'Amarela e Azul', cor: '#f2c94c', ponta: '#2a78d6', graus: 0, etaria: 'ambos', meses: 8 },
      { nome: 'Azul', cor: '#2a78d6', graus: 0, etaria: 'ambos', meses: 10, nota: 'Estagiário.' },
      { nome: 'Azul e Verde', cor: '#2a78d6', ponta: '#1baf7a', graus: 0, etaria: 'ambos', meses: 10 },
      { nome: 'Verde', cor: '#1baf7a', graus: 0, etaria: 'ambos', meses: 12, nota: 'Monitor: já ajuda a conduzir a roda.' },
      { nome: 'Verde e Roxa', cor: '#1baf7a', ponta: '#7b4fc4', graus: 0, etaria: 'adulto', meses: 12 },
      { nome: 'Roxa', cor: '#7b4fc4', graus: 0, etaria: 'adulto', meses: 18, nota: 'Instrutor.' },
      { nome: 'Roxa e Marrom', cor: '#7b4fc4', ponta: '#7a4a24', graus: 0, etaria: 'adulto', meses: 18 },
      { nome: 'Marrom', cor: '#7a4a24', graus: 0, etaria: 'adulto', meses: 24, nota: 'Professor.' },
      { nome: 'Marrom e Vermelha', cor: '#7a4a24', ponta: '#c0392b', graus: 0, etaria: 'adulto', meses: 24, nota: 'Contramestre.' },
      { nome: 'Vermelha', cor: '#c0392b', graus: 0, etaria: 'adulto', meses: 36, nota: 'Mestre.' },
      { nome: 'Vermelha e Branca', cor: '#c0392b', ponta: BRANCA, graus: 0, etaria: 'adulto', meses: 48, nota: 'Grão-mestre do grupo.' },
    ],
  },

  'Taekwondo': {
    federacao: 'World Taekwondo / CBTKD',
    resumo: 'Dez gups até a faixa preta. As faixas com ponta marcam a metade do caminho para a cor seguinte.',
    degraus: [
      { nome: 'Branca (10º gup)', cor: BRANCA, graus: 0, etaria: 'ambos', meses: 0 },
      { nome: 'Branca ponta amarela (9º gup)', cor: BRANCA, ponta: '#f2c94c', graus: 0, etaria: 'ambos', meses: 3 },
      { nome: 'Amarela (8º gup)', cor: '#f2c94c', graus: 0, etaria: 'ambos', meses: 3 },
      { nome: 'Amarela ponta verde (7º gup)', cor: '#f2c94c', ponta: '#1baf7a', graus: 0, etaria: 'ambos', meses: 4 },
      { nome: 'Verde (6º gup)', cor: '#1baf7a', graus: 0, etaria: 'ambos', meses: 4 },
      { nome: 'Verde ponta azul (5º gup)', cor: '#1baf7a', ponta: '#2a78d6', graus: 0, etaria: 'ambos', meses: 5 },
      { nome: 'Azul (4º gup)', cor: '#2a78d6', graus: 0, etaria: 'ambos', meses: 5 },
      { nome: 'Azul ponta vermelha (3º gup)', cor: '#2a78d6', ponta: '#e02020', graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Vermelha (2º gup)', cor: '#e02020', graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Vermelha ponta preta (1º gup)', cor: '#e02020', ponta: PRETA, graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Poom (preta e vermelha)', cor: PRETA, ponta: '#e02020', graus: 3, etaria: 'kids', idade: 8, meses: 12, nota: 'Faixa preta infantil, até os 15 anos.' },
      { nome: 'Preta (dan)', cor: PRETA, graus: 9, etaria: 'adulto', idade: 15, meses: 12, nota: 'Do 1º ao 9º dan.' },
    ],
  },

  'Kickboxing': {
    federacao: 'WAKO Brasil',
    resumo: 'Doze faixas até a preta, alternando cor cheia e cor com ponta.',
    degraus: [
      { nome: 'Branca', cor: BRANCA, graus: 0, etaria: 'ambos', meses: 0 },
      { nome: 'Branca ponta amarela', cor: BRANCA, ponta: '#f2c94c', graus: 0, etaria: 'ambos', meses: 3 },
      { nome: 'Amarela', cor: '#f2c94c', graus: 0, etaria: 'ambos', meses: 3 },
      { nome: 'Amarela ponta laranja', cor: '#f2c94c', ponta: '#ec7a26', graus: 0, etaria: 'ambos', meses: 4 },
      { nome: 'Laranja', cor: '#ec7a26', graus: 0, etaria: 'ambos', meses: 4 },
      { nome: 'Laranja ponta verde', cor: '#ec7a26', ponta: '#1baf7a', graus: 0, etaria: 'ambos', meses: 5 },
      { nome: 'Verde', cor: '#1baf7a', graus: 0, etaria: 'ambos', meses: 5 },
      { nome: 'Verde ponta azul', cor: '#1baf7a', ponta: '#2a78d6', graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Azul', cor: '#2a78d6', graus: 0, etaria: 'ambos', meses: 6 },
      { nome: 'Azul ponta marrom', cor: '#2a78d6', ponta: '#7a4a24', graus: 0, etaria: 'ambos', meses: 8 },
      { nome: 'Marrom', cor: '#7a4a24', graus: 0, etaria: 'adulto', meses: 8 },
      { nome: 'Marrom ponta preta', cor: '#7a4a24', ponta: PRETA, graus: 0, etaria: 'adulto', meses: 10 },
      { nome: 'Preta (dan)', cor: PRETA, graus: 10, etaria: 'adulto', idade: 16, meses: 12, nota: 'Instrutor formado, do 1º ao 10º dan.' },
    ],
  },

  'Boxe': {
    federacao: 'CBBoxe — níveis técnicos',
    resumo: 'O boxe não usa faixa. A academia acompanha o atleta por nível técnico e classe amadora.',
    degraus: [
      { nome: 'Iniciante', cor: '#9aa0a6', graus: 0, etaria: 'ambos', meses: 0, nota: 'Base de pernas, guarda, jab e direto.' },
      { nome: 'Intermediário', cor: '#5aa9e6', graus: 0, etaria: 'ambos', meses: 6, nota: 'Combinações, esquiva e sparring leve.' },
      { nome: 'Avançado', cor: '#2a4fb0', graus: 0, etaria: 'ambos', meses: 12, nota: 'Sparring completo e leitura de luta.' },
      { nome: 'Amador classe C', cor: '#f2c94c', graus: 0, etaria: 'adulto', meses: 12, nota: 'Primeiras lutas registradas na federação.' },
      { nome: 'Amador classe B', cor: '#ec7a26', graus: 0, etaria: 'adulto', meses: 18 },
      { nome: 'Amador classe A', cor: '#e02020', graus: 0, etaria: 'adulto', meses: 24, nota: 'Atleta de seletiva estadual e nacional.' },
      { nome: 'Elite / profissional', cor: PRETA, graus: 0, etaria: 'adulto', meses: 36 },
    ],
  },

  'MMA': {
    federacao: 'Níveis técnicos da equipe',
    resumo: 'No MMA a evolução é medida por nível técnico e pela participação na equipe de competição.',
    degraus: [
      { nome: 'Iniciante', cor: '#9aa0a6', graus: 0, etaria: 'ambos', meses: 0, nota: 'Fundamentos de trocação, queda e solo.' },
      { nome: 'Intermediário', cor: '#5aa9e6', graus: 0, etaria: 'ambos', meses: 8, nota: 'Transições entre as três distâncias.' },
      { nome: 'Avançado', cor: '#2a4fb0', graus: 0, etaria: 'adulto', meses: 14, nota: 'Sparring completo com regras oficiais.' },
      { nome: 'Equipe de competição', cor: '#f5b301', graus: 0, etaria: 'adulto', meses: 18, nota: 'Atleta em preparação para eventos amadores.' },
      { nome: 'Atleta profissional', cor: PRETA, graus: 0, etaria: 'adulto', meses: 30 },
    ],
  },
};

/** Categorias de peso sugeridas nas inscrições de competição. */
export const CATEGORIAS_PESO = {
  'Jiu-Jitsu': ['Galo', 'Pluma', 'Pena', 'Leve', 'Médio', 'Meio-pesado', 'Pesado', 'Super-pesado', 'Pesadíssimo', 'Absoluto'],
  'Judô': ['-60 kg', '-66 kg', '-73 kg', '-81 kg', '-90 kg', '-100 kg', '+100 kg', 'Absoluto'],
  'Muay Thai': ['-54 kg', '-57 kg', '-60 kg', '-63,5 kg', '-67 kg', '-71 kg', '-75 kg', '-81 kg', '-86 kg', '+86 kg'],
  Kickboxing: ['-57 kg', '-60 kg', '-63,5 kg', '-67 kg', '-71 kg', '-75 kg', '-81 kg', '-86 kg', '-91 kg', '+91 kg'],
  Boxe: ['-52 kg', '-57 kg', '-63 kg', '-69 kg', '-75 kg', '-81 kg', '-91 kg', '+91 kg'],
  MMA: ['Peso-mosca', 'Peso-galo', 'Peso-pena', 'Peso-leve', 'Meio-médio', 'Peso-médio', 'Meio-pesado', 'Peso-pesado'],
  Karatê: ['-60 kg', '-67 kg', '-75 kg', '-84 kg', '+84 kg', 'Kata'],
  Taekwondo: ['-54 kg', '-58 kg', '-63 kg', '-68 kg', '-74 kg', '-80 kg', '-87 kg', '+87 kg', 'Poomsae'],
  Capoeira: ['Batizado', 'Troca de corda', 'Roda livre'],
};

/** Grava (ou completa) a escala oficial de uma modalidade. */
export function aplicarGraduacoes(executar, todos, modalidadeId, nomeModalidade) {
  const catalogo = GRADUACOES_PADRAO[nomeModalidade];
  if (!catalogo) return 0;

  const existentes = new Set(
    todos('SELECT nome FROM graduacoes WHERE modalidade_id = :m', { m: modalidadeId }).map((g) => g.nome),
  );
  let criadas = 0;
  catalogo.degraus.forEach((degrau, indice) => {
    if (existentes.has(degrau.nome)) return;
    executar(`
      INSERT INTO graduacoes (modalidade_id, nome, ordem, cor, cor_ponta, graus, faixa_etaria,
                              idade_minima, tempo_minimo, descricao)
      VALUES (:modalidade_id, :nome, :ordem, :cor, :cor_ponta, :graus, :faixa_etaria,
              :idade_minima, :tempo_minimo, :descricao)
    `, {
      modalidade_id: modalidadeId,
      nome: degrau.nome,
      ordem: indice + 1,
      cor: degrau.cor,
      cor_ponta: degrau.ponta ?? null,
      graus: degrau.graus ?? 0,
      faixa_etaria: degrau.etaria ?? 'adulto',
      idade_minima: degrau.idade ?? null,
      tempo_minimo: degrau.meses ?? 0,
      descricao: degrau.nota ?? null,
    });
    criadas += 1;
  });
  return criadas;
}
