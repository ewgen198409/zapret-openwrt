#!/bin/sh
# domain-test.sh - проверка доступности доменов
# Использование: 
#   domain-test.sh domain           - выводит результат в формате: статус|домен|время
#   domain-test.sh input_file output_file - проверить все домены из input_file, результат в output_file

CURL_TIMEOUT="--connect-timeout 4 --max-time 6 --speed-time 3 --speed-limit 1"
CURL_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) curl/8.0"

check_domain() {
    local domain="$1"
    output=$(curl $CURL_TIMEOUT -sL -o /dev/null -w "%{http_code}|%{time_total}" -A "$CURL_AGENT" "https://$domain" 2>/dev/null)
    http_code=$(echo "$output" | cut -d'|' -f1)
    time_total=$(echo "$output" | cut -d'|' -f2)
    if [ "$http_code" != "000" ] && [ -n "$http_code" ]; then
        echo "OK|$domain|$time_total"
    else
        echo "FAIL|$domain|-"
    fi
}

if [ $# -eq 1 ]; then
    check_domain "$1"
    exit 0
fi

if [ $# -eq 2 ]; then
    INPUT_FILE="$1"
    OUTPUT_FILE="$2"
    result=""
    while IFS= read -r domain; do
        [ -z "$domain" ] && continue
        result="$result$(check_domain "$domain")\n"
    done < "$INPUT_FILE"
    echo -e "$result" > "$OUTPUT_FILE"
    exit 0
fi

echo "Usage: domain-test.sh domain | domain-test.sh input_file output_file"
exit 1