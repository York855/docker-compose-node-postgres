FROM node:20-alpine

WORKDIR /app

# Copy package.json first so the npm install layer is cached
# when only the application code changes
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

# Do not run the app as root
USER node

EXPOSE 3000
CMD ["node", "server.js"]
