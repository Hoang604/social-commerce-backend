FROM node:22-slim
RUN apt-get update && apt-get install -y procps

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .
CMD ["npm", "run", "dev:start"]