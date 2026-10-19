FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app
COPY . .

ENV PORT 3000
EXPOSE 3000

CMD ["node", "server.js"]
