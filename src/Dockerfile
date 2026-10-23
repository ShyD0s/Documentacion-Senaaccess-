# Build del front (Vite) en etapa separada
FROM node:24-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY resources ./resources
COPY vite.config.js ./
RUN npm run build

# Imagen final PHP 8.3 + extensiones que exige la app
FROM php:8.4-cli-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgmp-dev libsodium-dev libicu-dev libzip-dev libpng-dev libjpeg-dev libxml2-dev libonig-dev libcurl4-openssl-dev libssl-dev \
    unzip git curl ca-certificates \
    && docker-php-ext-configure gd --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    pdo_mysql gmp sodium intl bcmath gd zip dom xml mbstring ctype curl fileinfo \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
ENV COMPOSER_ALLOW_SUPERUSER=1
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --optimize-autoloader --no-interaction
COPY . .
COPY --from=frontend /app/public/build ./public/build
RUN mkdir -p storage/framework/views storage/framework/cache/data storage/framework/sessions storage/framework/testing storage/logs bootstrap/cache \
    && chmod -R 755 storage bootstrap/cache \
    && php artisan package:discover --ansi
EXPOSE 8000
CMD mkdir -p storage/framework/views storage/framework/cache/data storage/framework/sessions storage/framework/testing storage/logs bootstrap/cache \
    && chmod -R 755 storage bootstrap/cache \
    && php artisan migrate --force --seed \
    && php artisan serve --host 0.0.0.0 --port $PORT
