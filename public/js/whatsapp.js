/** Montagem de links do WhatsApp (cobranca, boas-vindas, contato). */

/** Deixa o telefone no formato que o WhatsApp espera: 55 + DDD + numero. */
export function numeroWhatsapp(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.startsWith('55')) return digitos;
  if (digitos.length >= 10 && digitos.length <= 11) return `55${digitos}`;
  return digitos;
}

export function linkWhatsapp(telefone, mensagem = '') {
  const numero = numeroWhatsapp(telefone);
  if (!numero) return null;
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : '';
  return `https://wa.me/${numero}${texto}`;
}

/** Mensagem pronta de cobranca amigavel. */
export function mensagemCobranca({ aluno, competencia, valor, vencimento, academia }) {
  return [
    `Oi, ${aluno.split(' ')[0]}! Aqui e da ${academia}.`,
    `Sua mensalidade de ${competencia} (${valor}) venceu em ${vencimento}.`,
    'Quando puder, passa aqui na recepção ou me chama por aqui para acertar. Bons treinos!',
  ].join(' ');
}

export function mensagemBoasVindas({ aluno, academia }) {
  return `Oi, ${aluno.split(' ')[0]}! Bem-vindo(a) a ${academia}. Qualquer duvida sobre horarios, planos ou uniforme, e só chamar por aqui.`;
}
