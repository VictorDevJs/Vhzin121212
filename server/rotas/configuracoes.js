import { Router } from 'express';
import { todos, executar, transacao } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, texto } from '../util.js';

const roteador = Router();

const CHAVES = [
  'nome_academia', 'telefone', 'whatsapp', 'endereco', 'instagram', 'sobre', 'chamada',
  'cor_primaria', 'ano_fundacao', 'historia', 'horario_funcionamento',
  'logo_url', 'simbolo_url', 'foto_capa', 'manchete',
  'instagram_url', 'facebook_url', 'youtube_url', 'tiktok_url',
];

roteador.get('/', exigirPapel(...EQUIPE), rota((_req, res) => {
  const atuais = Object.fromEntries(todos('SELECT chave, valor FROM configuracoes').map((c) => [c.chave, c.valor]));
  res.json(Object.fromEntries(CHAVES.map((chave) => [chave, atuais[chave] ?? ''])));
}));

roteador.put('/', exigirPapel('dono'), rota((req, res) => {
  transacao(() => {
    for (const chave of CHAVES) {
      if (req.body[chave] === undefined) continue;
      executar(`INSERT INTO configuracoes (chave, valor) VALUES (:chave, :valor)
                ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor`,
        { chave, valor: texto(req.body[chave], '') });
    }
  });
  const atuais = Object.fromEntries(todos('SELECT chave, valor FROM configuracoes').map((c) => [c.chave, c.valor]));
  res.json(Object.fromEntries(CHAVES.map((chave) => [chave, atuais[chave] ?? ''])));
}));

export default roteador;
