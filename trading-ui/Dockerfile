# Use Node.js 20 Alpine for a lightweight build
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build Arguments
ARG VITE_SUPABASE_URL=http://100.66.171.30:8000
ARG VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTExNjcsImV4cCI6MjA5MDg4NzExOX0.L0NhbF9Bbm9uX0tleV9WYWx1ZV9Gb3JfRGV2ZWxvcG1lbnRfT25seQ

# Map ARGs to ENVs for Vite Build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Clean Build
RUN npm run build

# Expose the port used by Vite preview
EXPOSE 3001

# Start the app in preview mode
CMD ["npm", "run", "preview", "--", "--port", "3001", "--host"]
