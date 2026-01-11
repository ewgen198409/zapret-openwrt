# Zapret OpenWrt

[![GitHub release](https://img.shields.io/github/release/ewgen198409/zapret-openwrt.svg)](https://github.com/ewgen198409/zapret-openwrt/releases)
[![Downloads](https://img.shields.io/github/downloads/ewgen198409/zapret-openwrt/total.svg)](https://github.com/ewgen198409/zapret-openwrt/releases)
[![License](https://img.shields.io/github/license/ewgen198409/zapret-openwrt)](LICENSE)

## Описание

**Zapret** — это не VPN! Это утилита **Anti-DPI** (Deep Packet Inspection).

Утилита предназначена для обхода DPI в сетях, где блокируется определённый контент. Она позволяет обходить цензуру и блокировки, применяя различные техники манипуляции трафиком.

Проект основан на оригинальном [Zapret](https://github.com/bol-van/zapret) и адаптирован для использования в OpenWrt.

## Функции

- Обход DPI без использования VPN
- Поддержка различных протоколов (HTTP, HTTPS, QUIC)
- Интеграция с OpenWrt LuCI интерфейсом
- Гибкая конфигурация
- Поддержка пользовательских списков доменов и IP
- Мониторинг и логирование

## Требования

- OpenWrt (рекомендуется версия 24.10+)
- Пакет curl с поддержкой HTTP/1.3 и QUIC (необходим для Blockcheck)

### Важные замечания

> **Внимание!** Для работы Blockcheck необходимо, чтобы все пакеты из архива были установлены.

> **Рекомендация:** Установите пакет curl с поддержкой HTTP/1.3 и QUIC. В официальном репозитории OpenWrt он без этой поддержки. Для архитектуры cortex-a53 скачайте отсюда: [openwrt-curl-prebuilt](https://github.com/vayulqq/openwrt-curl-prebuilt/releases). Для других архитектур ищите или собирайте самостоятельно.

Процесс установки curl описан в [обсуждениях](https://github.com/remittor/zapret-openwrt/discussions/168#discussioncomment-15417775).

## Установка

### Через SSH (рекомендуется)

Поддерживаемые архитектуры: mipsel_24kc, aarch64_cortex-a53.

1. Скачайте и распакуйте архив для вашей архитектуры:
   ```bash
   cd /tmp && wget https://github.com/ewgen198409/zapret-openwrt/releases/download/latest/zapret-openwrt-<ваша_архитектура>.tar.gz && tar -xzf zapret-openwrt-<ваша_архитектура>.tar.gz
   ```

2. Установите пакеты:
   ```bash
   opkg install zapret.ipk zapret-ip2net.ipk zapret-mdig.ipk zapret-tpws.ipk luci-app-zapret.ipk
   ```

### Ручная установка

Скачайте архивы с [релизов](https://github.com/ewgen198409/zapret-openwrt/releases) и установите пакеты вручную.

Подробные инструкции: [Installing zapret-openwrt package](https://github.com/remittor/zapret-openwrt/wiki/Installing-zapret‐openwrt-package)

## Использование

После установки пакет доступен через LuCI интерфейс: **Services → Zapret**.

Жмем Reset settings, в появившемся окне снимаем все галочки и выбираем набор стратегий, жмем Reset settings. Далее рестарт сервис и проверяем работу.
### Основные компоненты:

- **Blockcheck**: Проверка блокировки сайтов
- **Settings**: Основные настройки
- **Tools**: Дополнительные инструменты
- **Service**: Управление службой
- **DMN Log**: Просмотр логов демонов

## Конфигурация

Конфигурация осуществляется через LuCI интерфейс или напрямую в файлах `/etc/config/zapret`.

Поддерживаются пользовательские списки:
- `zapret/files/zapret-hosts-user.txt` — пользовательские домены для обработки
- `zapret/files/zapret-hosts-user-exclude.txt` — исключения
- `zapret/files/zapret-ip-exclude.txt` — исключения по IP

## Скриншоты

### Основной интерфейс
![Основной скриншот](https://github.com/ewgen198409/zapret-openwrt/blob/24.10/image.PNG)

### Детальный вид
<img width="1886" height="879" alt="Интерфейс Zapret" src="https://github.com/user-attachments/assets/65b2e021-f5c4-4eec-a8ab-cc0693c42d5f" />

## Поддержка и обратная связь

- **Issues**: [GitHub Issues](https://github.com/ewgen198409/zapret-openwrt/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ewgen198409/zapret-openwrt/discussions)
- **Wiki**: [Документация](https://github.com/remittor/zapret-openwrt/wiki)

## Лицензия

Этот проект распространяется под лицензией MIT. См. [LICENSE](LICENSE) для подробностей.

## Благодарности

- Оригинальный проект [Zapret](https://github.com/bol-van/zapret)
- Проект [remittor/zapret-openwrt](https://github.com/remittor/zapret-openwrt)
- Сообщество OpenWrt
