FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies required for building frontend)
RUN npm ci

# Copy application source code
COPY . .

# Build frontend bundle into frontend/dist
RUN npm run build

# Remove devDependencies to keep image size small
RUN npm prune --production

# Create data directory
RUN mkdir -p data

# Expose default application port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
