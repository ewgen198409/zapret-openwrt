# Обход ТСПУ для WhatsApp и Telegram на OpenWRT с помощью Zapret

Этот репозиторий содержит конфигурацию и инструкции для обхода ТСПУ (Технических Средств Противодействия Угрозам) в WhatsApp и Telegram (включая звонки, сообщения и другие функции) с использованием инструмента [zapret](https://github.com/bol-van/zapret) на OpenWRT. Конфигурация основана на стратегии из [ByeByeDPI](https://github.com/hufFilters/byebyedpi), адаптированной с помощью ИИ (ChatGPT).

**Предупреждение:** Эта конфигурация предназначена для личного использования в условиях цензуры. Убедитесь, что вы соблюдаете местные законы. Тестирование проводилось в России; результаты могут варьироваться в зависимости от провайдера и региона.

## Требования
- Установленный [zapret-openwrt](https://github.com/remittor/zapret-openwrt) на вашем OpenWRT-роутере.
- Доступ к веб-интерфейсу OpenWRT (LuCI) для редактирования конфигураций.
- Базовые знания командной строки SSH для перезапуска сервиса.

## Установка и настройка

### 1. Добавление стратегии
Откройте файл конфигурации стратегии zapret (обычно в `/opt/zapret/config` или через LuCI) и добавьте следующую новую стратегию в раздел NFQWS (или аналогичный):

Для TCP (порт 443):
```
--new
--filter-tcp=443,4244,5222-5228,5242,50318,59234
--hostlist=/opt/zapret/ipset/cust1.txt
--ipset=/opt/zapret/ipset/zapret-ip-user.txt
--dpi-desync=fake,split
--dpi-desync-repeats=14
--dpi-desync-ttl=1
--dpi-desync-fooling=badsum,datanoack
```

Для UDP (порты 443, 590-1400, 3478, 50000-60000):
```
--new
--filter-udp=443,590-1400,3478,50000-60000
--hostlist=/opt/zapret/ipset/cust1.txt
--ipset=/opt/zapret/ipset/zapret-ip-user.txt
--dpi-desync=fake
--dpi-desync-repeats=10
--dpi-desync-fake-quic=/opt/zapret/files/fake/quic_initial_www_google_com.bin
--dpi-desync-fooling=badsum
```

### 2. Настройка портов прослушивания
В конфигурации zapret укажите порты для NFQWS:

```
NFQWS_PORTS_TCP: 80,443,4244,5222-5228,5242,50318,59234
NFQWS_PORTS_UDP: 443,590-1400,3478,50000-60000
```

### 3. Настройка списка хостов
Через веб-интерфейс LuCI (вкладка **Host Lists**) откройте файл `/opt/zapret/ipset/cust1.txt` и добавьте домены WhatsApp и Telegram:

```
t.me
telegra.ph
telesco.pe
telegram.me
telegram.org
telegram.dog
telegram.com
telegram.dev
telegram.app
wa.me
whatsapp-plus.info
whatsapp-plus.me
whatsapp-plus.net
whatsapp.cc
whatsapp.com
whatsapp.info
whatsapp.net
whatsapp.org
whatsapp.tv
whatsappbrand.com
graph.whatsapp.com
graph.whatsapp.net
fbcdn.net
g.whatsapp.net
*.whatsapp.com
*.whatsapp.net
```

### 4. Настройка списка IP-адресов
Откройте файл `/opt/zapret/ipset/zapret-ip-user.txt` и добавьте IP-адреса WhatsApp и Telegram:

```
31.13.65.50
31.13.66.49
31.13.66.56
57.144.23.32
157.240.1.60
157.240.14.60
149.154.160.0/20
91.108.4.0/22
91.108.8.0/22
91.108.12.0/22
91.108.16.0/22
91.108.20.0/22
```

### 5. В скрипты custom.d добавляем скрипт STUN4ALL.

### 6. Применение изменений
- Сохраните все файлы.
- Перезапустите сервис zapret:
  ```
  /etc/init.d/zapret restart
  ```
- Подождите 1–2 минуты для применения изменений и обновления ipset.

## Проверка
- Проверьте логи zapret: `logread | grep zapret`.
- Тестируйте подключение в WhatsApp и Telegram (сообщения, звонки, видео).
- Если проблемы persist, проверьте ipset: `ipset list zapret-ip-user`.
- Мониторьте трафик: `tcpdump -i any port 443`.

## Возможные проблемы и отладка
- **Задержки в работе:** Увеличьте `--dpi-desync-repeats` (до 20) для более агрессивного десинхронизации.
- **UDP не работает:** Убедитесь, что файлы fake QUIC присутствуют в `/opt/zapret/files/fake/`.
- **IP-адреса устарели:** Используйте скрипт для автоматического обновления (пример ниже).
- Если ничего не помогает, вернитесь к базовой конфигурации zapret и протестируйте поэтапно.

## Вклад и обновления
Эта конфигурация будет обновляться по мере тестирования. Если у вас есть улучшения или проблемы:
- Откройте issue в этом репозитории.
- Поделитесь логами и деталями вашего setup.

## Лицензия
MIT License. См. [LICENSE](LICENSE) файл.

---

*Адаптировано из [GitHub Issue #520](https://github.com/remittor/zapret-openwrt/issues/520) в remittor/zapret-openwrt.*
