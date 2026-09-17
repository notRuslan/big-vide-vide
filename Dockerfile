FROM node:20-alpine

WORKDIR /app

# Install all dependencies (frontend + backend)
COPY apps/frontend/package.json apps/frontend/package-lock.json* ./apps/frontend/
COPY apps/backend/package.json apps/backend/package-lock.json* ./apps/backend/

RUN npm ci --prefix apps/frontend --production=false
RUN npm ci --prefix apps/backend --production=false

# Copy sources
COPY apps/frontend/ ./apps/frontend/
COPY apps/backend/ ./apps/backend/

# Build frontend
RUN npm run build --prefix apps/frontend

# Install production deps for backend
RUN npm ci --prefix apps/backend --production=true

EXPOSE 3000

# Default command starts backend (which also serves frontend static files)
CMD ["npm", "run", "start", "--prefix", "apps/backend"]
