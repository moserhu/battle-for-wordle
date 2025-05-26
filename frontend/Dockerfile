# Use a Node.js base image
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the frontend code
COPY . .

# Build the frontend
RUN npm run build

FROM nginx:alpine

# Remove default nginx static content
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/* /etc/nginx/nginx.conf

# Copy built static files
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx config (optional but recommended)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]