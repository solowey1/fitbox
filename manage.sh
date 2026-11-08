#!/bin/sh
set -eu

# ─── Цвета ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── Утилиты ─────────────────────────────────────────────────────────────────
info()    { printf "${BLUE}[INFO]${NC}  %s\n" "$*"; }
success() { printf "${GREEN}[OK]${NC}    %s\n" "$*"; }
warn()    { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
error()   { printf "${RED}[ERROR]${NC} %s\n" "$*"; exit 1; }

# Переходим в директорию скрипта (корень проекта)
cd "$(dirname "$0")"

# ─── Команды ─────────────────────────────────────────────────────────────────

cmd_start() {
  info "Запуск приложения..."
  docker compose up -d --remove-orphans
  success "Приложение запущено"
  echo ""
  docker compose ps
}

cmd_stop() {
  info "Остановка приложения..."
  docker compose down
  success "Приложение остановлено"
}

cmd_restart() {
  info "Перезапуск приложения..."
  docker compose down
  docker compose up -d --remove-orphans
  success "Приложение перезапущено"
  echo ""
  docker compose ps
}

cmd_update() {
  info "Получение обновлений из GitHub..."
  git pull --ff-only || error "Не удалось подтянуть изменения (возможно есть локальные коммиты)"
  success "Код обновлён"

  echo ""
  info "Пересборка контейнеров..."
  # --profile tools: без него сервис migrate (профиль tools) не пересобирается
  docker compose --profile tools build
  success "Контейнеры собраны"

  echo ""
  info "Перезапуск приложения..."
  docker compose up -d --remove-orphans
  success "Приложение обновлено и запущено"

  # Caddyfile подключён в контейнер одним файлом: git pull подменяет файл на диске,
  # а контейнер продолжает видеть старый, пока его не пересоздать (reload не помогает)
  if caddy_config_stale; then
    echo ""
    info "Caddyfile изменился — применяем"
    cmd_caddy
  fi

  echo ""
  docker compose ps
}

# Caddy запущен, но видит не тот Caddyfile, что лежит на диске
caddy_config_stale() {
  [ -n "$(docker compose ps --status running -q caddy 2>/dev/null)" ] || return 1
  running="$(docker compose exec -T caddy cat /etc/caddy/Caddyfile 2>/dev/null | cksum)"
  [ "$running" != "$(cksum < Caddyfile)" ]
}

cmd_caddy() {
  info "Проверка Caddyfile..."
  # отдельный одноразовый контейнер видит Caddyfile с диска; порты не занимает
  if ! out="$(docker compose run --rm --no-deps -T caddy caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile 2>&1)"; then
    printf '%s\n' "$out" | grep -viE '"level":"info"' | tail -20
    error "Caddyfile с ошибкой — Caddy не перезапущен, работает прежний конфиг"
  fi
  success "Caddyfile корректный"

  info "Пересоздание контейнера Caddy..."
  docker compose up -d --force-recreate --no-deps caddy
  success "Caddy работает с новым Caddyfile (сертификаты сохранены в томе caddy_data)"
}

cmd_migrate() {
  info "Сборка образа миграций..."
  # docker compose run не пересобирает образ: без этого запустится migrate.js из старой сборки
  docker compose --profile tools build migrate

  info "Запуск миграций..."
  docker compose run --rm migrate node scripts/migrate.js "$@"
  success "Миграции выполнены"
}

cmd_logs() {
  lines="${1:-100}"
  info "Логи приложения (последние $lines строк)..."
  docker compose logs --tail="$lines" -f node-app
}

cmd_status() {
  info "Статус контейнеров:"
  echo ""
  docker compose ps
}

cmd_help() {
  echo ""
  printf "  ${GREEN}Fitbox — управление приложением${NC}\n"
  echo ""
  echo "  Использование: ./manage.sh <команда>"
  echo ""
  echo "  Команды:"
  echo "    start       Запустить приложение"
  echo "    stop        Остановить приложение"
  echo "    restart     Перезапустить приложение"
  echo "    update      Обновить код из GitHub, пересобрать и перезапустить"
  echo "                  (Caddy пересоздаётся, только если изменился Caddyfile)"
  echo "    caddy       Проверить Caddyfile и применить его (пересоздать контейнер Caddy)"
  echo "    migrate     Запустить миграции БД"
  echo "                  --dry-run       показать, что будет применено"
  echo "                  --baseline=NNN  отметить миграции <= NNN применёнными (один раз для существующей БД)"
  echo "    logs [N]    Показать логи приложения (по умолчанию 100 строк)"
  echo "    status      Показать статус контейнеров"
  echo "    help        Показать эту справку"
  echo ""
}

# ─── Точка входа ─────────────────────────────────────────────────────────────

case "${1:-}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  update)  cmd_update ;;
  caddy)   cmd_caddy ;;
  migrate) shift; cmd_migrate "$@" ;;
  logs)    cmd_logs "${2:-100}" ;;
  status)  cmd_status ;;
  help)    cmd_help ;;
  *)       cmd_help ;;
esac
