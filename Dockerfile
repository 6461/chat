FROM node:10
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY server.js ./
EXPOSE 6461
CMD ["node", "server.js"]
