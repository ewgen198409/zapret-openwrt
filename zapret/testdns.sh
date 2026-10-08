#!/usr/bin/env bash
#
# dns-benchmark.sh — тест доступности и скорости DNS-провайдеров (DoH + UDP)
#
# Зависимости: bash 4+, curl (>=7.62, нужна поддержка --doh-url), awk.
# Для UDP-теста требуется один из: dig (dnsutils / bind-utils / knot-utils),
# host или nslookup (в т.ч. busybox-nslookup на OpenWrt). Если ни одной нет —
# UDP-тест пропускается, DoH-тест продолжает работать.
#
# Использование:
#   ./dns-benchmark.sh
#
# Настройки через переменные окружения:
#   TEST_DOMAIN=example.com   ATTEMPTS=3   TIMEOUT=2   MAX_PARALLEL=4  ./dns-benchmark.sh
#   NO_ANIM=1  ./dns-benchmark.sh        # без живой анимации (только итоговая таблица)
#
set -uo pipefail

# Пытаемся выставить UTF-8 локаль — на некоторых системах локаль по
# умолчанию не UTF-8, из-за чего printf считает ширину строк в байтах,
# а не в символах, и таблица "плывёт". Если подходящей локали нет —
# просто продолжаем как есть (в таблице используются только ASCII-символы,
# так что выравнивание всё равно будет корректным).
UTF8_LOCALE=$(locale -a 2>/dev/null | grep -im1 -E 'utf-?8$' || true)
[[ -n "$UTF8_LOCALE" ]] && export LC_ALL="$UTF8_LOCALE"

TEST_DOMAIN="${TEST_DOMAIN:-example.com}"   # какой домен резолвим
ATTEMPTS="${ATTEMPTS:-3}"                   # число попыток на сервер
TIMEOUT="${TIMEOUT:-2}"                     # таймаут одной попытки, сек
MAX_PARALLEL="${MAX_PARALLEL:-4}"           # сколько провайдеров тестировать одновременно.
# Внимание: на OpenWrt-роутере со слабым CPU держите это число малым (2–4).
# С 12 параллельных TLS-рукопожатий CPU роутера садится и DoH-время раздувается.

# ---------- Проверка зависимостей ----------
for bin in curl awk; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Ошибка: не найдена утилита '$bin'. Установите её и запустите снова." >&2
    exit 1
  fi
done
if ! curl --help all 2>/dev/null | grep -q -- '--doh-url'; then
  echo "Предупреждение: ваш curl не поддерживает --doh-url (нужна версия >= 7.62)." >&2
fi

# Выбор утилиты для UDP-DNS. На OpenWrt обычно нет dig, зато есть busybox
# nslookup (или host). Если нет ни одной — UDP-тест пропустим.
if command -v dig >/dev/null 2>&1; then
  DNS_TOOL=dig          # даёт точное "Query time: N msec"
elif command -v host >/dev/null 2>&1; then
  DNS_TOOL=host
elif command -v nslookup >/dev/null 2>&1; then
  DNS_TOOL=nslookup
else
  DNS_TOOL=
  echo "Предупреждение: не найдено ни dig, ни host, ни nslookup. UDP-тест будет пропущен (DoH продолжит работу)." >&2
fi

# busybox nslookup сам долго гоняет внутренние ретраи (может висеть секунды),
# поэтому при наличии утилиты timeout оборачиваем UDP-запросы в неё.
if command -v timeout >/dev/null 2>&1; then
  HAVE_TIMEOUT=1
else
  HAVE_TIMEOUT=0
fi

# ---------- Цвета ----------
C_RESET='\033[0m'
C_HEADER='\033[1;35m'
C_NAME='\033[0;36m'
C_TIME='\033[0;32m'
C_DASH='\033[0;90m'
C_BOX='\033[0;33m'
C_BOLD='\033[1m'

# ---------- Визуализация процесса ----------
# Живой режим: прогресс-бар + строки результатов по мере готовности сервера.
# Включается только если вывод идёт в терминал; иначе (пайп/файл/NO_ANIM=1)
# скрипт молча собирает результаты и печатает итоговую таблицу.
IS_TTY=0
[[ -t 1 ]] && IS_TTY=1
NO_ANIM="${NO_ANIM:-0}"

DONE_COUNT=0
if [[ -n "$UTF8_LOCALE" ]]; then
  BAR_FILL='█'; BAR_EMPTY='░'
else
  BAR_FILL='#'; BAR_EMPTY='.'
fi

# Печать одной строки таблицы с цветами.
print_row() {
  local name="$1" doh_res="$2" udp_res="$3"
  local doh_padded udp_padded doh_c udp_c
  doh_padded=$(printf "%15s" "$doh_res")
  udp_padded=$(printf "%15s" "$udp_res")
  doh_c="$C_TIME"; [[ "$doh_res" == "-" ]] && doh_c="$C_DASH"
  udp_c="$C_TIME"; [[ "$udp_res" == "-" ]] && udp_c="$C_DASH"
  printf "${C_NAME}%-24s${C_RESET} ${doh_c}%s${C_RESET} ${udp_c}%s${C_RESET}\n" \
    "$name" "$doh_padded" "$udp_padded"
}

# Прогресс-бар на последней строке экрана (курсор всегда держим на ней).
progress_line() {
  local done="$1" total="$2"
  local pct=0 bar_len filled i bar
  (( total > 0 )) && pct=$(( done * 100 / total ))
  bar_len=$(( total < 60 ? total : 40 ))
  filled=$(( done * bar_len / total ))
  bar=""
  for ((i = 0; i < filled; i++));   do bar="${bar}${BAR_FILL}"; done
  for ((i = filled; i < bar_len; i++)); do bar="${bar}${BAR_EMPTY}"; done
  printf '\r\033[2K\033[0;33mТест DNS:\033[0m [\033[0;32m%s\033[0m] %d/%d  %3d%%' \
    "$bar" "$done" "$total" "$pct"
}

# Новая строка результата печатается ПОВЕРХ прогресс-бара, потом бар
# перерисовывается внизу. Так процесс выглядит «живым».
flush_finished() {
  local f base name doh_res udp_res
  for f in "$TMPDIR"/*.done; do
    [ -e "$f" ] || continue
    base="${f%.done}"
    [[ -e "$base.printed" ]] && continue
    if (( IS_TTY && !NO_ANIM )); then
      IFS='|' read -r name doh_res udp_res < "$base.res"
      # Печатаем строку ПОВЕРХ прогресс-бара; бар перерисовывается строкой ниже —
      # так строки результатов накапливаются сверху вниз, а бар всегда внизу.
      printf '\r\033[2K'
      print_row "$name" "$doh_res" "$udp_res"
      ((DONE_COUNT++))
      progress_line "$DONE_COUNT" "$TOTAL"
    else
      ((DONE_COUNT++))
    fi
    : > "$base.printed"
  done
}

# ---------- Список провайдеров: "Имя|DoH URL|UDP IP" (UDP можно оставить пустым) ----------
declare -a PROVIDERS=(
  "AdGuard|https://dns.adguard-dns.com/dns-query|94.140.14.14"
  "AdGuard Family|https://family.adguard-dns.com/dns-query|94.140.14.15"
  "AdGuard Unfiltered|https://unfiltered.adguard-dns.com/dns-query|94.140.14.140"
  "Alibaba|https://dns.alidns.com/dns-query|223.5.5.5"
  "BlahDNS|https://doh.blahdns.com/dns-query|"
  "BunkerDNS|https://doh.bunkerdns.ru/dns-query|89.108.72.27"
  "Ciransa|https://dns.ciransa.ca/dns-query|"
  "CleanBrowsing|https://doh.cleanbrowsing.org/doh/family-filter/|185.228.168.168"
  "Cloudflare|https://cloudflare-dns.com/dns-query|1.1.1.1"
  "Cloudflare Security|https://security.cloudflare-dns.com/dns-query|1.1.1.2"
  "Cloudflare Mozilla|https://mozilla.cloudflare-dns.com/dns-query|"
  "Comss.one|https://dns.comss.one/dns-query|83.220.169.155"
  "ControlD|https://freedns.controld.com/p0|76.76.2.0"
  "Digitale Gesellschaft|https://dns.digitale-gesellschaft.ch/dns-query|185.95.218.42"
  "DNS.SB|https://doh.dns.sb/dns-query|185.222.222.222"
  "DNS0.eu|https://dns0.eu/dns-query|193.110.81.0"
  "DNS0.children|https://zero.dns0.eu/dns-query|193.110.81.9"
  "Odvr.nic.cz|https://odvr.nic.cz/doh|"
  "PowerDNS|https://doh.powerdns.org/dns-query|"
  "SwissPrivacy|https://dns.swissprivacy.ch/dns-query|"
  "dnsforge.de|https://dnsforge.de/dns-query|176.9.93.198"
  "DNSPod (doh.pub)|https://doh.pub/dns-query|119.29.29.29"
  "Google|https://dns.google/dns-query|8.8.8.8"
  "LibreDNS|https://doh.libredns.gr/dns-query|"
  "Mullvad|https://doh.mullvad.net/dns-query|"
  "Mullvad Adblock|https://adblock.doh.mullvad.net/dns-query|"
  "NextDNS|https://dns.nextdns.io|45.90.28.0"
  "OpenDNS|https://doh.opendns.com/dns-query|208.67.222.222"
  "Quad9|https://dns.quad9.net/dns-query|9.9.9.9"
  "Quad9 Unsecured|https://dns10.quad9.net/dns-query|9.9.9.10"
  "UncensoredDNS|https://anycast.uncensoreddns.org/dns-query|91.239.100.100"
  "Wikimedia|https://wikimedia-dns.org/dns-query|185.71.138.138"
  "Yandex|https://common.dot.dns.yandex.net/dns-query|77.88.8.8"
)
# ^ Список можно свободно редактировать: добавляйте/убирайте строки в формате
#   "Имя|DoH URL|UDP IP". Если у провайдера нет обычного UDP-резолвера — оставьте
#   поле после второго "|" пустым.

TOTAL=${#PROVIDERS[@]}

# ---------- Тест DoH ----------
# Идея: curl использует указанный DoH-сервер для резолва имени в запросе,
# а %{time_namelookup} отдаёт время именно этой фазы (резолвинга).
test_doh() {
  local url="$1"
  local sum=0 ok=0 i t
  for ((i = 0; i < ATTEMPTS; i++)); do
    t=$(curl -s -o /dev/null -m "$TIMEOUT" --doh-url "$url" \
        -w '%{time_namelookup}' "https://${TEST_DOMAIN}/" 2>/dev/null)
    if [[ -n "$t" && "$t" != "0.000000" ]]; then
      sum=$(awk -v a="$sum" -v b="$t" 'BEGIN{printf "%.6f", a+b}')
      ((ok++))
    fi
  done
  if ((ok == 0)); then
    echo "-"
  else
    local avg
    avg=$(awk -v s="$sum" -v n="$ok" 'BEGIN{printf "%.1f", (s/n)*1000}')
    if ((ok < ATTEMPTS)); then echo "${avg}ms ${ok}/${ATTEMPTS}"; else echo "${avg}ms"; fi
  fi
}

# ---------- Тест обычного UDP DNS ----------
# dig печатает точное "Query time: X msec". host/nslookup (в т.ч. busybox)
# этого не дают, поэтому для них замеряем время напрямую и определяем успех
# по содержимому ответа.

# Таймер. busybox date на OpenWrt НЕ умеет %N, поэтому основной источник —
# /proc/uptime (доли секунды, есть во всех Linux, включая busybox).
# Если нет и его — падаем на секунды (грубо, но не вводит в заблуждение).
now_ms() {
  if [[ -r /proc/uptime ]]; then
    awk '{printf "%d", $1*1000}' /proc/uptime 2>/dev/null
  elif [[ "$(date +%N 2>/dev/null)" =~ ^[0-9]+$ ]]; then
    echo $(( $(date +%s%N) / 1000000 ))
  else
    echo $(( $(date +%s) * 1000 ))
  fi
}

# Один UDP-запрос выбранным инструтом. $1 — IP DNS-сервера.
udp_lookup() {
  case "$DNS_TOOL" in
    dig)      dig "@$1" "$TEST_DOMAIN" +time="$TIMEOUT" +tries=1 2>/dev/null ;;
    host)     host -t A "$TEST_DOMAIN" "$1" 2>/dev/null ;;
    nslookup) nslookup "$TEST_DOMAIN" "$1" 2>/dev/null ;;
  esac
}

# То же, но через host/nslookup с ограничением по времени: busybox nslookup
# без этого сам ретраит и может висеть секунды, искажая измерение.
udp_timed() {
  local ip="$1" out
  if ((HAVE_TIMEOUT)); then
    case "$DNS_TOOL" in
      host)     out=$(timeout "$TIMEOUT" host     -t A "$TEST_DOMAIN" "$ip" 2>/dev/null) ;;
      nslookup) out=$(timeout "$TIMEOUT" nslookup       "$TEST_DOMAIN" "$ip" 2>/dev/null) ;;
      *)        out=$(udp_lookup "$ip") ;;
    esac
  else
    out=$(udp_lookup "$ip")
  fi
  printf '%s' "$out"
}

# Успешен ли ответ (код 0 — да): отсекаем очевидные сбои и требуем наличия IPv4.
udp_ok() {
  local out="$1"
  [[ -z "$out" ]] && return 1
  if echo "$out" | grep -qiE "can't resolve|no such|no answer|no servers|timed out|refused|servfail|nxdomain|not found"; then
    return 1
  fi
  echo "$out" | grep -qE '([0-9]{1,3}\.){3}[0-9]{1,3}'
}

test_udp() {
  local ip="$1"
  [[ -z "$ip" ]] && { echo "-"; return; }
  [[ -z "${DNS_TOOL:-}" ]] && { echo "-"; return; }
  local sum=0 ok=0 i t s e out avg
  for ((i = 0; i < ATTEMPTS; i++)); do
    if [[ "$DNS_TOOL" == dig ]]; then
      out=$(udp_lookup "$ip")
      if echo "$out" | grep -q "Query time:"; then
        t=$(printf '%s\n' "$out" | sed -n 's/.*Query time: *\([0-9][0-9]*\) *msec.*/\1/p' | head -1)
        [[ -n "$t" ]] && { sum=$((sum + t)); ((ok++)); }
      fi
    else
      s=$(now_ms)
      out=$(udp_timed "$ip")
      e=$(now_ms)
      if udp_ok "$out"; then
        sum=$((sum + (e - s))); ((ok++))
      fi
    fi
  done
  if ((ok == 0)); then
    echo "-"
  else
    avg=$((sum / ok))
    if ((ok < ATTEMPTS)); then echo "${avg}ms ${ok}/${ATTEMPTS}"; else echo "${avg}ms"; fi
  fi
}

# ---------- Запуск в параллель ----------
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"; [ "${CURSOR_HIDDEN:-0}" -eq 1 ] && printf "\033[?25h"' EXIT

run_provider() {
  local idx="$1" name="$2" doh="$3" udp="$4"
  local doh_res udp_res
  doh_res=$(test_doh "$doh")
  udp_res=$(test_udp "$udp")
  # Сначала результат, потом маркер готовности — иначе родитель может
  # прочитать файл раньше, чем он будет записан.
  printf '%s|%s|%s\n' "$name" "$doh_res" "$udp_res" > "$TMPDIR/$(printf '%04d' "$idx").res"
  : > "$TMPDIR/$(printf '%04d' "$idx").done"
}

echo -e "${C_HEADER}Тестирую ${TOTAL} DNS-серверов (домен: ${TEST_DOMAIN}, попыток: ${ATTEMPTS})...${C_RESET}"
echo

CURSOR_HIDDEN=0
if (( IS_TTY && !NO_ANIM )); then
  printf '\033[?25l'          # скрыть курсор, чтобы не мигал при перерисовке
  CURSOR_HIDDEN=1
  progress_line 0 "$TOTAL"
fi

idx=0
for entry in "${PROVIDERS[@]}"; do
  IFS='|' read -r name doh udp <<< "$entry"
  run_provider "$idx" "$name" "$doh" "$udp" &
  ((idx++))
  while (( $(jobs -r -p | wc -l) >= MAX_PARALLEL )); do
    wait -n 2>/dev/null || true
    flush_finished
  done
done
# Ждём остаток фоновых процессов и собираем результаты по мере готовности.
while jobs -r -p | grep -q .; do
  wait -n 2>/dev/null || true
  flush_finished
done
flush_finished

# Убираем прогресс-бар перед итоговой таблицей.
if (( IS_TTY && !NO_ANIM )); then
  printf '\r\033[2K\n'
fi

# ---------- Итоговая таблица (отсортирована по скорости DoH, «-» в конце) ----------
printf "${C_BOLD}${C_HEADER}%-24s %15s %15s${C_RESET}\n" "Provider" "DoH min" "UDP min"
printf '%s\n' "----------------------------------------------------------------"

doh_ok=0
udp_total=0
udp_ok=0

declare -a ALL_RES=()
for f in "$TMPDIR"/*.res; do
  IFS='|' read -r name doh_res udp_res < "$f"
  num=$(printf '%s' "${doh_res%% *}" | tr -cd '0-9.')
  [[ -n "$num" ]] || num='99999'
  ALL_RES+=("$num|$name|$doh_res|$udp_res")

  [[ "$doh_res" != "-" ]] && ((doh_ok++))
  [[ "$udp_res" != "-" ]] && { ((udp_ok++)); }
done
mapfile -t ALL_RES < <(printf '%s\n' "${ALL_RES[@]}" | sort -n -t'|' -k1,1)

for row in "${ALL_RES[@]}"; do
  IFS='|' read -r _ name doh_res udp_res <<< "$row"
  print_row "$name" "$doh_res" "$udp_res"
done

# Считаем, у скольких провайдеров вообще указан UDP IP
for entry in "${PROVIDERS[@]}"; do
  IFS='|' read -r _ _ udp <<< "$entry"
  [[ -n "$udp" ]] && ((udp_total++))
done

echo
echo -e "${C_BOX}┌───────────────────────────────────────┐${C_RESET}"
echo -e "${C_BOX}│${C_RESET}                  Итог                  ${C_BOX}│${C_RESET}"
echo -e "${C_BOX}├───────────────────────────────────────┤${C_RESET}"
printf "${C_BOX}│${C_RESET} DNS доступность: ${C_TIME}%d/%d${C_RESET} DoH   ${C_TIME}%d/%d${C_RESET} UDP  ${C_BOX}│${C_RESET}\n" \
  "$doh_ok" "$TOTAL" "$udp_ok" "$udp_total"
echo -e "${C_BOX}└───────────────────────────────────────┘${C_RESET}"
