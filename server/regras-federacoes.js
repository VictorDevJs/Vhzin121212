/**
 * Regras e pontuação de cada arte marcial.
 *
 * Serve de consulta rápida para aluno, mestre e responsável de competições.
 * Regra de federação muda de temporada: cada bloco diz qual entidade manda,
 * e a tela avisa que o regulamento oficial é a palavra final.
 */

export const REGRAS = {
  'Jiu-Jitsu': {
    federacao: 'IBJJF / CBJJ',
    site: 'ibjjf.com',
    resumo: 'Vence por finalização. Sem finalização, ganha quem somou mais pontos por posição dominante.',
    tempo: [
      ['Branca adulto', '5 minutos'],
      ['Azul', '6 minutos'],
      ['Roxa', '7 minutos'],
      ['Marrom', '8 minutos'],
      ['Preta', '10 minutos'],
      ['Infantil e juvenil', '3 a 5 minutos, conforme a idade'],
      ['Master', 'Tempo reduzido em relação ao adulto'],
    ],
    pontuacao: [
      ['Queda (takedown)', 2, 'Derrubar e estabilizar por 3 segundos.'],
      ['Raspagem', 2, 'Inverter a posição estando por baixo na guarda.'],
      ['Joelho na barriga', 2, 'Joelho apoiado no abdômen, com controle por 3 segundos.'],
      ['Passagem de guarda', 3, 'Ultrapassar as pernas e estabilizar de lado por 3 segundos.'],
      ['Montada', 4, 'Sentado no tronco, ambos os joelhos no chão.'],
      ['Pegada nas costas', 4, 'Costas do adversário com os dois ganchos encaixados.'],
    ],
    criterios: [
      'Vantagem: marcada quando a posição quase se completou. Só desempata quando os pontos estão iguais.',
      'Ordem de desempate: pontos, depois vantagens, depois punições. Persistindo, decisão do árbitro.',
    ],
    faltas: [
      ['1ª punição', 'Advertência ao atleta.'],
      ['2ª punição', 'Advertência e vantagem para o adversário.'],
      ['3ª punição', 'Dois pontos para o adversário.'],
      ['4ª punição', 'Desqualificação.'],
      ['Golpes proibidos', 'Chave de joelho e cervical são proibidas conforme a faixa; consulte a tabela da idade e graduação.'],
    ],
  },

  'Muay Thai': {
    federacao: 'CBMT / IFMA',
    site: 'ifmamuaythai.org',
    resumo: 'Luta de ringue com socos, chutes, joelhos e cotovelos. Ganha por nocaute ou por pontos, round a round.',
    tempo: [
      ['Amador', '3 rounds de 3 minutos, 1 a 2 minutos de intervalo'],
      ['Profissional', '5 rounds de 3 minutos'],
      ['Juvenil', '3 rounds de 2 minutos'],
    ],
    pontuacao: [
      ['Round vencido', 10, 'Sistema 10 pontos obrigatórios: o vencedor do round leva 10.'],
      ['Round perdido', 9, 'Perdedor leva 9 quando o round foi disputado.'],
      ['Round com queda', 8, 'Perdedor leva 8 quando foi ao chão uma vez.'],
      ['Round dominado', 7, 'Duas quedas ou domínio total do adversário.'],
    ],
    criterios: [
      'Contam golpes limpos que causam efeito, não a quantidade de tentativas.',
      'Chute e joelho valem mais que soco na avaliação tradicional.',
      'Clinch é permitido, com o árbitro separando quando a ação para.',
      'No amador com capacete, a cotovelada costuma ser proibida — confira o regulamento do evento.',
    ],
    faltas: [
      ['Advertência', 'Falta leve; o árbitro chama a atenção sem descontar ponto.'],
      ['Ponto descontado', 'Falta repetida ou grave.'],
      ['Desqualificação', 'Falta intencional grave ou terceira punição.'],
      ['Proibido', 'Cabeçada, golpe na nuca, na virilha e em atleta caído.'],
    ],
  },

  'Karatê': {
    federacao: 'WKF / CBK',
    site: 'wkf.net',
    resumo: 'Duas provas: kumite (combate) e kata (forma). No kumite, ganha por diferença de 8 pontos ou por vantagem no tempo.',
    tempo: [
      ['Kumite adulto masculino', '3 minutos'],
      ['Kumite adulto feminino', '2 minutos'],
      ['Kumite juvenil', '2 minutos'],
      ['Kata', 'Sem tempo fixo; nota por execução'],
    ],
    pontuacao: [
      ['Yuko', 1, 'Soco (tsuki) no tronco ou na cabeça.'],
      ['Waza-ari', 2, 'Chute (geri) no tronco.'],
      ['Ippon', 3, 'Chute na cabeça, ou golpe em adversário derrubado.'],
    ],
    criterios: [
      'Só pontua o golpe com forma correta, atitude esportiva, vigor, consciência, tempo certo e distância correta.',
      'Diferença de 8 pontos encerra a luta imediatamente.',
      'Empate no fim do tempo: vence quem marcou primeiro (senshu); sem pontos, decisão dos árbitros.',
      'No kata a nota é técnica (70%) e atlética (30%).',
    ],
    faltas: [
      ['Categoria 1', 'Contato excessivo, golpe em área proibida, ataque a braços ou pernas.'],
      ['Categoria 2', 'Sair da área, fingir lesão, agarrar, comportamento antidesportivo.'],
      ['Escala', 'Chukoku, Keikoku, Hansoku-Chui e Hansoku (desqualificação).'],
    ],
  },

  'Judô': {
    federacao: 'IJF / CBJ',
    site: 'ijf.org',
    resumo: 'Ippon encerra a luta na hora. Sem ippon, decide o waza-ari; faltas acumuladas eliminam.',
    tempo: [
      ['Adulto', '4 minutos'],
      ['Sub-15 e sub-13', '3 minutos'],
      ['Golden score', 'Prorrogação sem tempo limite, até a primeira pontuação ou terceiro shido'],
    ],
    pontuacao: [
      ['Ippon', 'Vitória', 'Queda de costas com força, velocidade e controle; imobilização de 20 segundos; ou desistência em estrangulamento ou chave de braço.'],
      ['Waza-ari', 'Meia', 'Queda sem um dos critérios do ippon, ou imobilização de 10 a 19 segundos. Dois waza-ari valem ippon.'],
    ],
    criterios: [
      'A luta para assim que sai o ippon.',
      'Chave de braço e estrangulamento são permitidos apenas a partir da categoria adulta.',
      'No golden score, a primeira pontuação vence.',
    ],
    faltas: [
      ['Shido', 'Falta leve: passividade, pegada irregular, sair da área. O terceiro shido dá a vitória ao adversário.'],
      ['Hansoku-make', 'Falta grave: desqualificação imediata.'],
      ['Proibido', 'Pegar a perna do adversário com a mão, golpear a cabeça no tatame, técnicas de perigo.'],
    ],
  },

  Taekwondo: {
    federacao: 'World Taekwondo / CBTKD',
    site: 'worldtaekwondo.org',
    resumo: 'Combate de chutes com colete eletrônico. Chute giratório e chute na cabeça valem mais.',
    tempo: [
      ['Adulto', '3 rounds de 2 minutos, 1 minuto de intervalo'],
      ['Juvenil', '3 rounds de 1 minuto e meio'],
      ['Empate', 'Round de ouro de 1 minuto'],
    ],
    pontuacao: [
      ['Soco no tronco', 1, 'Golpe de punho válido no colete.'],
      ['Chute no tronco', 2, 'Chute simples no colete.'],
      ['Chute na cabeça', 3, 'Chute limpo no capacete.'],
      ['Chute giratório no tronco', 4, 'Com giro completo do corpo.'],
      ['Chute giratório na cabeça', 5, 'Maior pontuação da modalidade.'],
    ],
    criterios: [
      'O colete e o capacete eletrônicos registram o impacto; o giro é validado pelos árbitros.',
      'Diferença grande de pontos encerra o round conforme o regulamento do evento.',
    ],
    faltas: [
      ['Gam-jeom', 'Falta: um ponto para o adversário. Dez gam-jeom eliminam.'],
      ['Proibido', 'Atravessar a linha, cair de propósito, agarrar, empurrar, golpear abaixo da cintura.'],
    ],
  },

  Boxe: {
    federacao: 'IBA / CBBoxe',
    site: 'cbboxe.com.br',
    resumo: 'Só golpes de punho, acima da linha da cintura. Ganha por nocaute ou pela soma dos rounds.',
    tempo: [
      ['Elite masculino', '3 rounds de 3 minutos'],
      ['Elite feminino', '4 rounds de 2 minutos'],
      ['Juvenil', '3 rounds de 2 minutos'],
      ['Profissional', '4 a 12 rounds de 3 minutos'],
    ],
    pontuacao: [
      ['Round vencido', 10, 'Sistema 10 pontos obrigatórios, avaliado por cinco juízes.'],
      ['Round perdido', 9, 'Disputa equilibrada com leve vantagem do adversário.'],
      ['Round com queda', 8, 'Perdedor foi ao chão ou levou contagem de proteção.'],
    ],
    criterios: [
      'Contam golpes limpos que acertam com a parte correta da luva.',
      'Domínio do ringue, defesa e agressividade efetiva entram na avaliação.',
      'Formas de vitória: pontos, nocaute, RSC (árbitro encerra), abandono, desqualificação.',
    ],
    faltas: [
      ['Advertência', 'Falta leve, sem desconto.'],
      ['Ponto descontado', 'Falta repetida.'],
      ['Proibido', 'Golpe na nuca, nos rins, abaixo da cintura, com a cabeça, o cotovelo ou o interior da luva.'],
    ],
  },

  Kickboxing: {
    federacao: 'WAKO Brasil',
    site: 'wako.sport',
    resumo: 'Várias modalidades sob o mesmo nome: da luta parada por pontos ao contato pleno com chutes baixos.',
    tempo: [
      ['Point Fighting', '2 rounds de 2 minutos, com a luta parando a cada ponto'],
      ['Light Contact e Kick Light', '3 rounds de 2 minutos, contato controlado'],
      ['K-1 Style e Low Kick', '3 rounds de 3 minutos, contato pleno'],
      ['Full Contact', '3 a 5 rounds de 2 minutos, sem golpes abaixo da cintura'],
    ],
    pontuacao: [
      ['Soco', 1, 'Point Fighting: mão válida no alvo.'],
      ['Chute no tronco', 1, 'Point Fighting.'],
      ['Chute na cabeça', 2, 'Point Fighting.'],
      ['Chute com giro na cabeça', 3, 'Point Fighting.'],
      ['Round vencido', 10, 'Modalidades de contato pleno usam o sistema 10-9.'],
    ],
    criterios: [
      'Cada modalidade tem alvo e potência próprios: confira em qual delas você vai competir.',
      'No Low Kick e no K-1 o chute baixo é permitido; no Full Contact não.',
      'Número mínimo de chutes por round é exigido em algumas modalidades.',
    ],
    faltas: [
      ['Advertência e desconto', 'Escala igual à do boxe.'],
      ['Proibido', 'Golpe na nuca, na coluna, na virilha, joelhada e cotovelada (salvo modalidade que permita).'],
    ],
  },

  MMA: {
    federacao: 'Regras Unificadas / CABMMA',
    site: 'cabmma.com.br',
    resumo: 'Trocação, quedas e solo na mesma luta. Vence por finalização, nocaute ou decisão dos juízes.',
    tempo: [
      ['Luta comum', '3 rounds de 5 minutos'],
      ['Luta principal ou de título', '5 rounds de 5 minutos'],
      ['Amador', '3 rounds de 3 minutos, com restrições de golpe'],
    ],
    pontuacao: [
      ['Round vencido', 10, 'Sistema 10 pontos obrigatórios.'],
      ['Round dominado', 8, 'Domínio claro, com dano ou controle prolongado.'],
    ],
    criterios: [
      'Ordem de avaliação: dano efetivo, depois domínio de luta agarrada e trocação, depois iniciativa.',
      'Formas de vitória: finalização, nocaute, nocaute técnico, decisão, desqualificação, desistência.',
    ],
    faltas: [
      ['Proibido', 'Cabeçada, dedo no olho, golpe na nuca e na coluna, joelhada ou chute em adversário caído, agarrar a grade.'],
      ['Punição', 'Advertência, desconto de ponto ou desqualificação, conforme a gravidade.'],
      ['Amador', 'Cotovelada e joelhada na cabeça costumam ser proibidas — confira o regulamento do evento.'],
    ],
  },

  Capoeira: {
    federacao: 'CBCapoeira / FICA',
    site: 'cbcapoeira.org.br',
    resumo: 'Não é luta de nocaute: o jogo é avaliado. Na academia, o que vale é o batizado e a troca de corda.',
    tempo: [
      ['Jogo de competição', '1 a 3 minutos por dupla'],
      ['Roda aberta', 'Sem tempo fixo, a música conduz'],
    ],
    pontuacao: [
      ['Movimentação', 3, 'Ginga, esquiva, deslocamento e uso do espaço.'],
      ['Técnica', 3, 'Golpes, acrobacias e floreios executados com controle.'],
      ['Musicalidade', 2, 'Cantar, tocar e respeitar o ritmo do berimbau.'],
      ['Malícia e interação', 2, 'Jogo de cintura e diálogo com o parceiro de jogo.'],
    ],
    criterios: [
      'A capoeira é jogada em dupla: quem só ataca, sem diálogo, perde pontos.',
      'Contato forte e intencional desclassifica.',
      'Na academia a graduação vem no batizado e na troca de corda, uma vez por ano.',
    ],
    faltas: [
      ['Contato', 'Golpe desferido para machucar tira o atleta do jogo.'],
      ['Desrespeito', 'Com o parceiro, a bateria ou o mestre: eliminação.'],
    ],
  },
};

/** Lista enxuta para montar as abas da tela. */
export function modalidadesComRegras() {
  return Object.entries(REGRAS).map(([modalidade, dados]) => ({
    modalidade,
    federacao: dados.federacao,
    resumo: dados.resumo,
  }));
}
