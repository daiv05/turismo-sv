FROM php:8.4-cli-alpine

RUN apk add --no-cache git unzip libpq icu-libs libzip libpng libjpeg-turbo freetype libwebp \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS postgresql-dev icu-dev libzip-dev linux-headers libpng-dev libjpeg-turbo-dev freetype-dev libwebp-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install gd pdo_pgsql intl zip bcmath pcntl exif \
    && apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV COMPOSER_PROCESS_TIMEOUT=0

WORKDIR /repo/backend
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
