# Imagem do sistema da Atak.
#
# Roda em qualquer lugar que aceite container com disco: Render, Railway,
# Fly.io, VPS. O disco importa — todo o sistema vive em /dados, e sem um
# volume montado ali os alunos e os pagamentos somem no próximo reinício.
FROM node:22-alpine

WORKDIR /app

# Só o Express, sem as ferramentas de desenvolvimento.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public ./public
COPY README.md ./

# Tudo que precisa sobreviver a um reinício mora aqui.
ENV DB_ARQUIVO=/dados/academia.db \
    ARQUIVOS_PASTA=/dados/arquivos \
    BACKUP_PASTA=/dados/backups \
    ATRAS_DE_PROXY=1 \
    PORT=3000 \
    NODE_ENV=production

RUN mkdir -p /dados && chown -R node:node /dados /app
VOLUME ["/dados"]

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
