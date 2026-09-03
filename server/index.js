import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { abrirBanco } from './db.js';
import { autenticacaoOpcional } from './auth.js';
import { garantirDadosIniciais } from './seed.js';

import rotasAuth from './rotas/auth.js';
import rotasPublico from './rotas/publico.js';
import rotasPainel from './rotas/painel.js';
import rotasAlunos from './rotas/alunos.js';
import rotasModalidades from './rotas/modalidades.js';
import rotasTurmas from './rotas/turmas.js';
import rotasPlanos from './rotas/planos.js';
import rotasMatriculas from './rotas/matriculas.js';
import rotasFinanceiro from './rotas/financeiro.js';
import rotasAvisos from './rotas/avisos.js';
import rotasPresencas from './rotas/presencas.js';
import rotasUsuarios from './rotas/usuarios.js';
import rotasConfiguracoes from './rotas/configuracoes.js';
import rotasMinhaArea from './rotas/minha-area.js';
import rotasAvaliacoes from './rotas/avaliacoes.js';
import rotasCertificados from './rotas/certificados.js';
import rotasArquivos, { PASTA_ARQUIVOS } from './rotas/arquivos.js';
import rotasCheckins from './rotas/checkins.js';
import rotasLoja from './rotas/loja.js';
import rotasCompeticoes from './rotas/competicoes.js';
import rotasEquipes from './rotas/equipes.js';
import rotasAuditoria from './rotas/auditoria.js';
import rotasRegras from './rotas/regras.js';
import rotasContas from './rotas/contas.js';
import { garantirCobrancaDoDia } from './cobranca.js';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));

export function criarApp() {
  abrirBanco();
  garantirDadosIniciais();

  const app = express();
  app.use(express.json({ limit: '8mb' })); // o limite maior atende o upload de certificados
  app.use(autenticacaoOpcional);

  // A cobrança do dia roda sozinha, no máximo uma vez por dia: gera as
  // mensalidades do mês, suspende quem passou do prazo e reativa quem pagou.
  app.use('/api', (_req, _res, proximo) => {
    try { garantirCobrancaDoDia(); } catch { /* a cobrança nunca derruba o atendimento */ }
    proximo();
  });

  app.get('/api/saude', (_req, res) => res.json({ ok: true, servico: 'atak' }));

  app.use('/api/auth', rotasAuth);
  app.use('/api/publico', rotasPublico);
  app.use('/api/painel', rotasPainel);
  app.use('/api/alunos', rotasAlunos);
  app.use('/api/modalidades', rotasModalidades);
  app.use('/api/turmas', rotasTurmas);
  app.use('/api/planos', rotasPlanos);
  app.use('/api/matriculas', rotasMatriculas);
  app.use('/api/financeiro', rotasFinanceiro);
  app.use('/api/avisos', rotasAvisos);
  app.use('/api/presencas', rotasPresencas);
  app.use('/api/usuarios', rotasUsuarios);
  app.use('/api/configuracoes', rotasConfiguracoes);
  app.use('/api/minha-area', rotasMinhaArea);
  app.use('/api/avaliacoes', rotasAvaliacoes);
  app.use('/api/certificados', rotasCertificados);
  app.use('/api/arquivos', rotasArquivos);
  app.use('/api/checkins', rotasCheckins);
  app.use('/api/loja', rotasLoja);
  app.use('/api/competicoes', rotasCompeticoes);
  app.use('/api/equipes', rotasEquipes);
  app.use('/api/auditoria', rotasAuditoria);
  app.use('/api/regras', rotasRegras);
  app.use('/api/contas', rotasContas);

  app.use('/api', (_req, res) => res.status(404).json({ erro: 'Endpoint não encontrado.' }));

  // Certificados e imagens enviados pelo dono
  app.use('/arquivos', express.static(PASTA_ARQUIVOS, { maxAge: '7d' }));

  // Front-end (SPA)
  app.use(express.static(join(raiz, 'public')));
  app.get('*', (_req, res) => res.sendFile(join(raiz, 'public', 'index.html')));

  // Tratamento central de erros
  app.use((erro, _req, res, _proximo) => {
    const status = erro.status || 500;
    if (status >= 500) console.error('[erro]', erro);
    const mensagem = status >= 500 ? 'Erro interno no servidor.' : erro.message;
    res.status(status).json({ erro: mensagem });
  });

  return app;
}

const executadoDireto = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (executadoDireto) {
  const porta = Number(process.env.PORT) || 3000;
  criarApp().listen(porta, () => {
    console.log(`\n  Atak - sistema de gestao rodando em http://localhost:${porta}\n`);
  });
}
