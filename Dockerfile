FROM archlinux:latest

# Update system and install dependencies
RUN pacman -Syu --noconfirm && \
    pacman -S --noconfirm \
    nodejs \
    npm \
    chromium \
    imagemagick \
    texlive-core \
    texlive-latexextra \
    ttf-dejavu \
    ttf-liberation \
    graphviz \
    git \
    make \
    gcc

# Set working directory
WORKDIR /app

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Create directory for persistent data
RUN mkdir -p /root/.noclawd

# Expose nothing (bot-only) or specific ports if needed
# EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
