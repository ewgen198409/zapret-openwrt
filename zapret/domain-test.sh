#!/bin/sh
# domain-test.sh - проверка доступности доменов с текущими настройками zapret
INPUT_FILE="$1"
OUTPUT_FILE="$2"

# Параметры curl (аналогично Zapret-Manager.sh)
CURL_TIMEOUT="--connect-timeout 4 --max-time 6 --speed-time 3 --speed-limit 1"
CURL_OPT="-sL --range 0-65535 -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) curl/8.0'"

# Проверка одного URL (домен -> https://домен)
check_url() {
    local domain="$1"
    local url="https://$domain"
    if curl $CURL_TIMEOUT $CURL_OPT -o /dev/null "$url" >/dev/null 2>&1; then
        echo "[ OK ] $domain"
        return 0
    else
        echo "[FAIL] $domain"
        return 1
    fi
}

# Основная функция
result=""
while IFS= read -r domain; do
    [ -z "$domain" ] && continue
    result="$result$(check_url "$domain")\n"
done < "$INPUT_FILE"

# Выводим результат в файл
echo -e "$result" > "$OUTPUT_FILE"