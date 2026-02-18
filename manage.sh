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
  docker compose build
  success "Контейнеры собраны"

  echo ""
  info "Перезапуск приложения..."
  docker compose up -d --remove-orphans
  success "Приложение обновлено и запущено"
  echo ""
  docker compose ps
}

cmd_migrate() {
  info "Запуск миграций..."
  docker compose run --rm migrate
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
  echo "    migrate     Запустить миграции БД"
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
  migrate) cmd_migrate ;;
  logs)    cmd_logs "${2:-100}" ;;
  status)  cmd_status ;;
  help)    cmd_help ;;
  *)       cmd_help ;;
esac
