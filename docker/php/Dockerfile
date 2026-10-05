FROM php:8.4-cli-alpine

RUN apk add --no-cache git unzip libpq icu-libs libzip \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS postgresql-dev icu-dev libzip-dev linux-headers \
    && docker-php-ext-install pdo_pgsql intl zip bcmath pcntl \
    && apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /repo/backend
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
