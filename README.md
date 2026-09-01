# 🥋 Sistema de Gestão para Academia de Lutas

Sistema completo para administrar uma academia de artes marciais: **cadastro de alunos, planos,
turmas, horários, avisos, chamada e controle financeiro**, com áreas separadas para o **dono**,
os **mestres**, a **recepção** e os **alunos**.

Roda com **Node.js + SQLite** e não precisa de banco de dados externo nem de build do front-end.

---

## O que o sistema faz

### Página pública (sem login)
Vitrine da academia com as modalidades, a **grade completa de horários**, os planos e os avisos
liberados para o site. É por ali que o aluno também **cria a própria conta**.

### Área de login com 4 perfis

| Perfil | O que enxerga e faz |
|---|---|
| **Dono** | Tudo. Cadastra modalidades, faixas, turmas, horários, planos, equipe, avisos, alunos, e vê o financeiro completo (receitas, despesas, saldo, inadimplência). |
| **Mestre** | Painel com as turmas dele, chamada, faixas/graduações dos alunos, avisos e a grade de horários. Edita as turmas em que é o responsável. |
| **Recepção** | Cadastro e matrícula de alunos, planos, mensalidades e recebimentos, avisos e chamada. Não vê despesas nem o resultado consolidado. |
| **Aluno** | "Minha área": plano, mensalidades, horários das turmas dele, frequência, graduações e os avisos direcionados a ele. |

### Módulos

- **Alunos** — cadastro completo (dados, responsável para os kids, observações), situação
  (pendente / ativo / trancado / inativo), ficha com histórico de turmas, graduações,
  mensalidades e presenças.
- **Cadastro aberto** — o aluno se cadastra sozinho pela página inicial e entra como *pendente*;
  a recepção confirma a matrícula e libera o plano.
- **Modalidades e faixas** — Jiu-Jitsu, Muay Thai, Karatê, Kickboxing e MMA já vêm cadastrados
  com as respectivas faixas, e o dono pode criar quantas modalidades quiser (Boxe, Judô, Capoeira...).
- **Turmas e horários** — cada turma tem modalidade, categoria (kids / adulto / misto / feminino),
  nível, mestre responsável, capacidade, local e vários horários na semana.
- **Grade de horários** — visão semanal completa, com filtro por modalidade e categoria.
- **Planos** — valor, periodicidade (mensal, trimestral, semestral, anual), aulas por semana e
  quais modalidades estão incluídas.
- **Matrículas** — vincula aluno + plano, ativa o cadastro, define o dia de vencimento e já
  gera a primeira mensalidade.
- **Financeiro** — mensalidades (geração mensal em um clique, recebimento, cancelamento),
  entradas e saídas por categoria, inadimplência, saldo do mês e evolução dos últimos meses.
  Todo pagamento de mensalidade vira automaticamente uma receita no caixa.
- **Avisos** — campeonatos, eventos, exames de faixa, cancelamento de aula e recados gerais,
  com público-alvo (todos, kids, adultos, uma modalidade, uma turma ou só a equipe) e opção de
  publicar também na página pública.
- **Chamada** — lista de presença por turma e por data, com resumo de frequência do mês.

---

## Como rodar

Requisitos: **Node.js 22.5 ou superior** (o SQLite já vem embutido no Node).

```bash
npm install          # instala o Express (única dependência)
npm start            # sobe o servidor em http://localhost:3000
```

Na primeira execução o sistema cria o banco em `dados/academia.db` já com as 5 modalidades,
as faixas, os planos de exemplo, as turmas com horários e o usuário do dono.

**Login inicial do dono:**

```
e-mail: dono@academia.com
senha:  admin123
```

> Troque essa senha no primeiro acesso (menu lateral → *Trocar senha*), ou defina
> `DONO_EMAIL` / `DONO_SENHA` antes de subir o sistema pela primeira vez.

### Dados de demonstração (opcional)

Para navegar com a academia "cheia" (alunos, mestres, mensalidades pagas e em aberto,
despesas e avisos):

```bash
npm run seed -- --demo
```

Logins criados pela demonstração:

| Perfil | E-mail | Senha |
|---|---|---|
| Mestre | `ricardo@academia.com` | `mestre123` |
| Recepção | `recepcao@academia.com` | `recepcao123` |
| Aluno | `lucas0@email.com` | `aluno123` |

### Outros comandos

```bash
npm run dev    # sobe com recarregamento automático ao salvar arquivos
npm test       # testes automatizados da API (20 casos)
```

### Configuração

Copie `.env.example` para `.env` (ou exporte as variáveis no ambiente):

| Variável | Para que serve | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `APP_SEGREDO` | Chave que assina os tokens de sessão — **troque em produção** | valor de desenvolvimento |
| `DB_ARQUIVO` | Caminho do banco SQLite | `./dados/academia.db` |
| `DONO_EMAIL` / `DONO_SENHA` / `DONO_NOME` | Primeiro usuário dono criado automaticamente | `dono@academia.com` / `admin123` |

**Backup:** todo o sistema vive no arquivo `dados/academia.db`. Copiar esse arquivo é o backup completo.

---

## Estrutura do projeto

```
server/
  index.js              servidor Express e registro das rotas
  db.js                 conexão SQLite e criação das tabelas
  auth.js               senha (scrypt), token de sessão e controle de permissão
  util.js               validações e formatos compartilhados
  seed.js               dados iniciais e carga de demonstração
  rotas/                uma rota por assunto (alunos, turmas, financeiro, avisos...)
public/
  index.html            casca da aplicação
  css/estilo.css        tema visual
  js/api.js             cliente da API e sessão
  js/ui.js              componentes de tela (tabelas, modais, formulários)
  js/app.js             menu, rotas e permissões da interface
  js/paginas/           uma tela por arquivo
testes/api.test.js      testes da API
```

## API

Todas as rotas ficam sob `/api` e usam `Authorization: Bearer <token>`, exceto as públicas.

| Rota | Descrição |
|---|---|
| `POST /api/auth/registrar` · `POST /api/auth/login` | cadastro do aluno e login (públicas) |
| `GET /api/publico/academia` | dados da vitrine: modalidades, grade, planos e avisos (pública) |
| `GET /api/painel` | números do painel conforme o perfil |
| `/api/alunos` | CRUD de alunos, ficha, graduações |
| `/api/modalidades` | modalidades e suas faixas |
| `/api/turmas` | turmas, horários, alunos da turma e `GET /api/turmas/grade` |
| `/api/planos` · `/api/matriculas` | planos e matrículas |
| `/api/financeiro` | mensalidades, lançamentos e `GET /api/financeiro/resumo` |
| `/api/avisos` | mural de avisos (filtrado pelo público-alvo de cada aluno) |
| `/api/presencas` | chamada e resumo de frequência |
| `/api/usuarios` · `/api/configuracoes` | equipe e dados institucionais (dono) |
| `GET /api/minha-area` | tudo o que o aluno logado precisa ver |

---

## Segurança

- Senhas guardadas com **scrypt** + sal aleatório (nunca em texto puro).
- Sessão por **token assinado com HMAC-SHA256**, com validade de 7 dias.
- Permissão verificada **no servidor** em cada rota — esconder um botão no navegador não libera acesso.
- A interface monta todo conteúdo com `textContent`, sem `innerHTML`, evitando injeção de script
  através de dados cadastrados.

## Como adaptar para a sua academia

1. Entre como dono → **Equipe e academia** → preencha nome, telefone, endereço, Instagram e o texto
   "sobre" (aparecem na página pública).
2. **Turmas e modalidades** → ajuste as modalidades, as faixas de cada arte e crie as turmas com
   os horários reais.
3. **Planos** → cadastre os planos e valores que você vende.
4. **Equipe e academia** → crie os acessos dos mestres e da recepção.
5. **Alunos** → cadastre (ou aprove quem se cadastrou sozinho) e matricule em um plano.
6. Todo dia 1º, use **Financeiro → Gerar mensalidades** para criar as cobranças do mês.
