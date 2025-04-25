# Use a Node.js base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the frontend code
COPY . .

COPY .env.production .env

# Build the frontend
RUN npm run build

# Expose the frontend port
EXPOSE 3002

# Serve the frontend using a lightweight HTTP server
CMD ["npx", "serve", "-s", "build", "-l", "3002"]