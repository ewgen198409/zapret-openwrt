'use strict';
'require view';
'require ui';

return view.extend({
    showCreateCommand: function() {
        var commandText = E('textarea', {
            'id': 'command_output',
            'style': 'width:100%; height:100px; font-family:monospace;',
            'readonly': true,
            'placeholder': _('Generated command will appear here'),
        });

        var generateButton = E('button', {
            'class': 'cbi-button cbi-button-positive',
            'click': ui.createHandlerFn(this, this.generateCommand),
        }, _('Generate'));

        var copyButton = E('button', {
            'class': 'cbi-button cbi-button-neutral',
            'click': ui.createHandlerFn(this, function() {
                var textarea = document.getElementById('command_output');
                if (textarea) {
                    textarea.select();
                    document.execCommand('copy');
                }
            }),
        }, _('Copy'));

        var params = [
            { name: 'CURL', desc: 'замена программы curl', value: true },
            { name: 'CURL_MAX_TIME', desc: 'время таймаута curl в секундах', default: '2', value: true },
            { name: 'CURL_MAX_TIME_QUIC', desc: 'время таймаута curl для quic', default: '2', value: true },
            { name: 'CURL_MAX_TIME_DOH', desc: 'время таймаута curl для DoH серверов', default: '2', value: true },
            { name: 'CURL_CMD', desc: 'показывать команды curl (0|1)', value: true },
            { name: 'CURL_OPT', desc: 'дополнительные параметры curl. `-k` - игнор сертификатов. `-v` - подробный вывод протокола', value: true },
            { name: 'CURL_HTTPS_GET', desc: 'использовать метод GET вместо HEAD для https (0|1)', value: true },
            { name: 'DOMAINS', desc: 'список тестируемых доменов через пробел', default: 'rutracker.org', value: true },
            { name: 'IPVS', desc: 'тестируемые версии ip протокола (4|6|46)', default: '4', value: true },
            { name: 'ENABLE_HTTP', desc: 'включить тест plain http (0|1)', value: true },
            { name: 'ENABLE_HTTPS_TLS12', desc: 'включить тест https TLS 1.2 (0|1)', value: true },
            { name: 'ENABLE_HTTPS_TLS13', desc: 'включить тест https TLS 1.3 (0|1)', value: true },
            { name: 'ENABLE_HTTP3', desc: 'включить тест QUIC (0|1)', value: true },
            { name: 'REPEATS', desc: 'количество попыток тестирования', default: '1', value: true },
            { name: 'PARALLEL', desc: 'включить параллельные попытки (0|1)', value: true },
            { name: 'SCANLEVEL', desc: 'уровень сканирования (quick|standard|force)', default: 'standard', value: true },
            { name: 'BATCH', desc: 'пакетный режим без вопросов (0|1)', value: true },
            { name: 'HTTP_PORT', desc: 'номера портов для http', default: '80', value: true },
            { name: 'HTTPS_PORT', desc: 'номера портов для https', default: '443', value: true },
            { name: 'QUIC_PORT', desc: 'номера портов для quic', default: '443', value: true },
            { name: 'PKTWS_EXTRA', desc: 'дополнительные параметры nfqws/dvtws/winws', value: true },
            { name: 'TPWS_EXTRA', desc: 'дополнительные параметры tpws', value: true },
            { name: 'SECURE_DNS', desc: 'принудительно выключить или включить DoH (0|1)', value: true },
            { name: 'DOH_SERVERS', desc: 'список URL DoH', value: true },
            { name: 'DOH_SERVER', desc: 'конкретный DoH URL', value: true },
            { name: 'UNBLOCKED_DOM', desc: 'незаблокированный домен для тестов IP block', default: 'iana.org', value: true },
            { name: 'MIN_TTL', desc: 'пределы тестов с TTL', default: '1', value: true },
            { name: 'MAX_TTL', desc: 'пределы тестов с TTL', default: '12', value: true },
            { name: 'MIN_AUTOTTL_DELTA', desc: 'пределы тестов с autottl', default: '1', value: true },
            { name: 'MAX_AUTOTTL_DELTA', desc: 'пределы тестов с autottl', default: '5', value: true },
            { name: 'SIMULATE', desc: 'режим симуляции (0|1)', value: true },
            { name: 'SIM_SUCCESS_RATE', desc: 'вероятность успеха симуляции', default: '10', value: true },
            { name: 'SKIP_DNSCHECK', desc: 'отказ от проверки DNS (0|1)', value: false },
            { name: 'SKIP_IPBLOCK', desc: 'отказ от тестов блокировки по порту или IP (0|1)', value: false },
            { name: 'SKIP_TPWS', desc: 'отказ от тестов tpws (0|1)', value: false },
            { name: 'SKIP_PKTWS', desc: 'отказ от тестов nfqws/dvtws/winws (0|1)', value: false },
        ];

        var paramElements = [];
        params.forEach(function(param) {
            var checkbox = E('input', {
                'type': 'checkbox',
                'id': 'param_' + param.name,
            });
            var labelText = param.name;
            if (param.example) {
                labelText += ' (' + param.example + ')';
            }
            labelText += ' - ' + param.desc;
            var label = E('label', {
                'for': 'param_' + param.name,
            }, labelText);

            var input = null;
            if (param.value) {
                input = E('input', {
                    'type': 'text',
                    'id': 'value_' + param.name,
                    'value': param.default,
                    'style': 'margin-left: 10px; width: 100px;',
                });
            }

            paramElements.push(E('div', {
                'style': 'display: flex; align-items: center; margin: 5px 0; padding: 5px; border-bottom: 1px solid #eee;'
            }, [checkbox, E('span', { 'style': 'margin-left: 5px; flex: 1;' }, labelText), input]));
        });

        var content = paramElements.concat([
            E('hr'),
            E('div', { 'style': 'padding: 10px 0;' }, [
                generateButton,
                E('span', {}, ' '),
                copyButton,
                E('br'),
                commandText,
            ])
        ]);

        ui.showModal(_('Create Blockcheck Command'), [
            E('div', { 'style': 'max-height: 70vh; overflow-y: auto; padding: 10px; max-width: 95vw;' }, content),
            E('div', { 'class': 'right' }, [
                E('button', {
                    'class': 'btn',
                    'click': ui.hideModal,
                }, _('Close')),
            ])
        ]);
    },

    generateCommand: function() {
        var command = '';
        var params = [
            'CURL', 'CURL_MAX_TIME', 'CURL_MAX_TIME_QUIC', 'CURL_MAX_TIME_DOH', 'CURL_CMD', 'CURL_OPT', 'CURL_HTTPS_GET',
            'DOMAINS', 'IPVS', 'ENABLE_HTTP', 'ENABLE_HTTPS_TLS12', 'ENABLE_HTTPS_TLS13', 'ENABLE_HTTP3', 'REPEATS',
            'PARALLEL', 'SCANLEVEL', 'BATCH', 'HTTP_PORT', 'HTTPS_PORT', 'QUIC_PORT', 'SKIP_DNSCHECK', 'SKIP_IPBLOCK',
            'SKIP_TPWS', 'SKIP_PKTWS', 'PKTWS_EXTRA', 'TPWS_EXTRA', 'SECURE_DNS', 'DOH_SERVERS', 'DOH_SERVER',
            'UNBLOCKED_DOM', 'MIN_TTL', 'MAX_TTL', 'MIN_AUTOTTL_DELTA', 'MAX_AUTOTTL_DELTA', 'SIMULATE', 'SIM_SUCCESS_RATE'
        ];

        params.forEach(function(param) {
            var checkbox = document.getElementById('param_' + param);
            if (checkbox && checkbox.checked) {
                var valueInput = document.getElementById('value_' + param);
                var value = valueInput ? valueInput.value : '1';
                if (value) {
                    command += param + '=' + value.replace(/"/g, '\\"') + ' ';
                }
            }
        });

        command += '/opt/zapret/blockcheck.sh';

        var textarea = document.getElementById('command_output');
        if (textarea) {
            textarea.value = command;
        }
    },

    showHelp: function() {
        ui.showModal(_('Help - Blockcheck'), [
            E('div', { 'style': 'max-height: 70vh; overflow-y: auto; padding: 10px;' }, [
                E('h3', {}, _('Проверка провайдера')),
                E('p', {}, _('Перед настройкой нужно провести исследование какую бяку устроил вам ваш провайдер.')),
                E('p', {}, _('Нужно выяснить не подменяет ли он DNS и какой метод обхода DPI работает. В этом вам поможет скрипт blockcheck.sh.')),
                E('p', {}, _('Если DNS подменяется, но провайдер не перехватывает обращения к сторонним DNS, поменяйте DNS на публичный. Например: 8.8.8.8, 8.8.4.4, 1.1.1.1, 1.0.0.1, 9.9.9.9 Если DNS подменяется и провайдер перехватывает обращения к сторонним DNS, настройте dnscrypt. Еще один эффективный вариант - использовать ресолвер от yandex 77.88.8.88 на нестандартном порту 1253. Многие провайдеры не анализируют обращения к DNS на нестандартных портах. blockcheck если видит подмену DNS автоматически переключается на DoH сервера.')),
                E('p', {}, _('Следует прогнать blockcheck по нескольким заблокированным сайтам и выявить общий характер блокировок. Разные сайты могут быть заблокированы по-разному, нужно искать такую технику, которая работает на большинстве. Чтобы записать вывод blockcheck.sh в файл, выполните: ./blockcheck.sh | tee /tmp/blockcheck.txt.')),
                E('p', {}, _('Проанализируйте какие методы дурения DPI работают, в соответствии с ними настройте /opt/zapret/config.')),
                E('p', {}, _('Имейте в виду, что у провайдеров может быть несколько DPI или запросы могут идти через разные каналы по методу балансировки нагрузки. Балансировка может означать, что на разных ветках разные DPI или они находятся на разных хопах. Такая ситуация может выражаться в нестабильности работы обхода. Дернули несколько раз curl. То работает, то connection reset или редирект. blockcheck.sh выдает странноватые результаты. То split работает на 2-м. хопе, то на 4-м. Достоверность результата вызывает сомнения. В этом случае задайте несколько повторов одного и того же теста. Тест будет считаться успешным только, если все попытки пройдут успешно.')),
                E('p', {}, _('При использовании autottl следует протестировать как можно больше разных доменов. Эта техника может на одних провайдерах работать стабильно, на других потребуется выяснить при каких параметрах она стабильна, на третьих полный хаос, и проще отказаться.')),
                E('h3', {}, _('Blockcheck имеет 3 уровня сканирования.')),
                E('p', {}, _('quick - максимально быстро найти хоть что-то работающее.')),
                E('p', {}, _('standard дает возможность провести исследование как и на что реагирует DPI в плане методов обхода.')),
                E('p', {}, _('force дает максимум проверок даже в случаях, когда ресурс работает без обхода или с более простыми стратегиями.')),
                E('p', {}, _('Есть ряд других параметров, которые не будут спрашиваться в диалоге, но которые можно переопределить через переменные.')),
                E('ul', {}, [
                    E('li', {}, _('CURL - замена программы curl')),
                    E('li', {}, _('CURL_MAX_TIME - время таймаута curl в секундах')),
                    E('li', {}, _('CURL_MAX_TIME_QUIC - время таймаута curl для quic. если не задано, используется значение CURL_MAX_TIME')),
                    E('li', {}, _('CURL_MAX_TIME_DOH - время таймаута curl для DoH серверов')),
                    E('li', {}, _('CURL_CMD=1 - показывать команды curl')),
                    E('li', {}, _('CURL_OPT - дополнительные параметры curl. `-k` - игнор сертификатов. `-v` - подробный вывод протокола')),
                    E('li', {}, _('CURL_HTTPS_GET=1 - использовать метод GET вместо HEAD для https')),
                    E('li', {}, _('DOMAINS - список тестируемых доменов через пробел')),
                    E('li', {}, _('IPVS=4|6|46 - тестируемые версии ip протокола')),
                    E('li', {}, _('ENABLE_HTTP=0|1 - включить тест plain http')),
                    E('li', {}, _('ENABLE_HTTPS_TLS12=0|1 - включить тест https TLS 1.2')),
                    E('li', {}, _('ENABLE_HTTPS_TLS13=0|1 - включить тест https TLS 1.3')),
                    E('li', {}, _('ENABLE_HTTP3=0|1 - включить тест QUIC')),
                    E('li', {}, _('REPEATS - количество попыток тестирования')),
                    E('li', {}, _('PARALLEL=0|1 - включить параллельные попытки. может обидеть сайт из-за долбежки и привести к неверному результату')),
                    E('li', {}, _('SCANLEVEL=quick|standard|force - уровень сканирования')),
                    E('li', {}, _('BATCH=1 - пакетный режим без вопросов и ожидания ввода в консоли')),
                    E('li', {}, _('HTTP_PORT, HTTPS_PORT, QUIC_PORT - номера портов для соответствующих протоколов')),
                    E('li', {}, _('SKIP_DNSCHECK=1 - отказ от проверки DNS')),
                    E('li', {}, _('SKIP_IPBLOCK=1 - отказ от тестов блокировки по порту или IP')),
                    E('li', {}, _('SKIP_TPWS=1 - отказ от тестов tpws')),
                    E('li', {}, _('SKIP_PKTWS=1 - отказ от тестов nfqws/dvtws/winws')),
                    E('li', {}, _('PKTWS_EXTRA, TPWS_EXTRA - дополнительные параметры nfqws/dvtws/winws и tpws, указываемые после основной стратегии')),
                    E('li', {}, _('PKTWS_EXTRA_1 .. PKTWS_EXTRA_9, TPWS_EXTRA_1 .. TPWS_EXTRA_9 - отдельно дополнительные параметры, содержащие пробелы')),
                    E('li', {}, _('PKTWS_EXTRA_PRE - дополнительные параметры для nfqws/dvtws/winws, указываемые перед основной стратегии')),
                    E('li', {}, _('PKTWS_EXTRA_PRE_1 .. PKTWS_EXTRA_PRE_9 - отдельно дополнительные параметры, содержащие пробелы')),
                    E('li', {}, _('SECURE_DNS=0|1 - принудительно выключить или включить DoH')),
                    E('li', {}, _('DOH_SERVERS - список URL DoH через пробел для автоматического выбора работающего сервера')),
                    E('li', {}, _('DOH_SERVER - конкретный DoH URL, отказ от поиска')),
                    E('li', {}, _('UNBLOCKED_DOM - незаблокированный домен, который используется для тестов IP block')),
                    E('li', {}, _('MIN_TTL,MAX_TTL - пределы тестов с TTL. MAX_TTL=0 отключает тесты.')),
                    E('li', {}, _('MIN_AUTOTTL_DELTA,MAX_AUTOTTL_DELTA - пределы тестов с autottl по дельте. MAX_AUTOTTL_DELTA=0 отключает тесты.')),
                    E('li', {}, _('SIMULATE=1 - включить режим симуляции для отладки логики скрипта. отключаются реальные запросы через curl, заменяются рандомным результатом.')),
                    E('li', {}, _('SIM_SUCCESS_RATE=<percent> - вероятность успеха симуляции в процентах')),
                ]),
                E('p', {}, _('Пример запуска с переменными:')),
                E('p', {}, _('SECURE_DNS=1 SKIP_TPWS=1 CURL_MAX_TIME=1 CURL=/tmp/curl /opt/zapret/blockcheck.sh')),
                E('h3', {}, _('СКАН ПОРТОВ')),
                E('p', {}, _('Если в системе присутствует совместимый netcat (ncat от nmap или openbsd ncat. в OpenWrt по умолчанию нет), то выполняется сканирование портов http или https всех IP адресов домена. Если ни один IP не отвечает, то результат очевиден. Можно останавливать сканирование. Автоматически оно не остановится, потому что netcat-ы недостаточно подробно информируют о причинах ошибки. Если доступна только часть IP, то можно ожидать хаотичных сбоев, т.к. подключение идет к случайному адресу из списка.')),
                E('h3', {}, _('ПРОВЕРКА НА ЧАСТИЧНЫЙ IP block')),
                E('p', {}, _('Под частичным блоком подразумевается ситуация, когда коннект на порты есть, но по определенному транспортному или прикладному протоколу всегда идет реакция DPI вне зависимости от запрашиваемого домена. Эта проверка так же не выдаст автоматического вердикта/решения, потому что может быть очень много вариаций. Вместо этого анализ происходящего возложен на самого пользователя или тех, кто будет читать лог. Суть этой проверки в попытке дернуть неблокированный IP с блокированным доменом и наоборот, анализируя при этом реакцию DPI. Реакция DPI обычно проявляется в виде таймаута (зависание запроса), connection reset или http redirect на заглушку. Любой другой вариант скорее всего говорит об отсутствии реакции DPI. В частности, любые http коды, кроме редиректа, ведущего именно на заглушку, а не куда-то еще. На TLS - ошибки handshake без задержек. Ошибка сертификата может говорить как о реакции DPI с MiTM атакой (подмена сертификата), так и о том, что принимающий сервер неблокированного домена все равно принимает ваш TLS handshake с чужим доменом, пытаясь при этом выдать сертификат без запрошенного домена. Требуется дополнительный анализ. Если на заблокированный домен есть реакция на всех IP адресах, значит есть блокировка по домену. Если на неблокированный домен есть реакция на IP адресах блокированного домена, значит имеет место блок по IP. Соответственно, если есть и то, и другое, значит есть и блок по IP, и блок по домену. Неблокированный домен первым делом проверяется на доступность на оригинальном адресе. При недоступности тест отменяется, поскольку он будет неинформативен.')),
                E('p', {}, _('Если выяснено, что есть частичный блок по IP на DPI, то скорее всего все остальные тесты будут провалены вне зависимости от стратегий обхода. Но бывают и некоторые исключения. Например, пробитие через ipv6 option headers. Или сделать так, чтобы он не мог распознать протокол прикладного уровня. Дальнейшие тесты могут быть не лишены смысла.')),
                E('h3', {}, _('ПРИМЕРЫ БЛОКИРОВКИ ТОЛЬКО ПО ДОМЕНУ БЕЗ БЛОКА ПО IP')),
                E('pre', {}, _('> testing iana.org on it\'s original\n!!!!! AVAILABLE !!!!!\n> testing rutracker.org on 192.0.43.8 (iana.org)\ncurl: (28) Operation timed out after 1002 milliseconds with 0 bytes received\n> testing iana.org on 172.67.182.196 (rutracker.org)\nHTTP/1.1 409 Conflict\n> testing iana.org on 104.21.32.39 (rutracker.org)\nHTTP/1.1 409 Conflict')),
                E('pre', {}, _('> testing iana.org on it\'s original ip\n!!!!! AVAILABLE !!!!!\n> testing rutracker.org on 192.0.43.8 (iana.org)\ncurl: (28) Connection timed out after 1001 milliseconds\n> testing iana.org on 172.67.182.196 (rutracker.org)\ncurl: (35) OpenSSL/3.2.1: error:0A000410:SSL routines::ssl/tls alert handshake failure\n> testing iana.org on 104.21.32.39 (rutracker.org)\ncurl: (35) OpenSSL/3.2.1: error:0A000410:SSL routines::ssl/tls alert handshake failure')),
                E('pre', {}, _('> testing iana.org on it\'s original ip\n!!!!! AVAILABLE !!!!!\n> testing rutracker.org on 192.0.43.8 (iana.org)\nHTTP/1.1 307 Temporary Redirect\nLocation: https://www.gblnet.net/blocked.php\n> testing iana.org on 172.67.182.196 (rutracker.org)\nHTTP/1.1 409 Conflict\n> testing iana.org on 104.21.32.39 (rutracker.org)\nHTTP/1.1 409 Conflict')),
                E('pre', {}, _('> testing iana.org on it\'s original ip\n!!!!! AVAILABLE !!!!!\n> testing rutracker.org on 192.0.43.8 (iana.org)\ncurl: (35) Recv failure: Connection reset by peer\n> testing iana.org on 172.67.182.196 (rutracker.org)\ncurl: (35) OpenSSL/3.2.1: error:0A000410:SSL routines::ssl/tls alert handshake failure\n> testing iana.org on 104.21.32.39 (rutracker.org)\ncurl: (35) OpenSSL/3.2.1: error:0A000410:SSL routines::ssl/tls alert handshake failure')),
                E('h3', {}, _('ПРИМЕР ПОЛНОГО IP БЛОКА ИЛИ БЛОКА TCP ПОРТА ПРИ ОТСУТСТВИИ БЛОКА ПО ДОМЕНУ')),
                E('pre', {}, _('* port block tests ipv4 startmail.com:80\n  ncat -z -w 1 145.131.90.136 80\n  145.131.90.136 does not connect. netcat code 1\n  ncat -z -w 1 145.131.90.152 80\n  145.131.90.152 does not connect. netcat code 1')),
                E('pre', {}, _('* curl_test_http ipv4 startmail.com\n- checking without DPI bypass\n  curl: (28) Connection timed out after 2002 milliseconds\n  UNAVAILABLE code=28')),
                E('pre', {}, _('- IP block tests (requires manual interpretation)\n\n> testing iana.org on it\'s original ip\n!!!!! AVAILABLE !!!!!\n> testing startmail.com on 192.0.43.8 (iana.org)\nHTTP/1.1 302 Found\nLocation: https://www.iana.org/\n> testing iana.org on 145.131.90.136 (startmail.com)\ncurl: (28) Connection timed out after 2002 milliseconds\n> testing iana.org on 145.131.90.152 (startmail.com)\ncurl: (28) Connection timed out after 2002 milliseconds')),
            ]),
            E('div', { 'class': 'right' }, [
                E('button', {
                    'class': 'btn',
                    'click': ui.hideModal,
                }, _('Close')),
            ])
        ]);
    },

    render: function() {
        var h2 = E('div', {'class' : 'cbi-title-section'}, [
            E('h2', {'class': 'cbi-title-field'}, [ _('Zapret') + ' - ' + _('Blockcheck') ]),
        ]);

        var helpButton = E('button', {
            'class': 'cbi-button cbi-button-neutral',
            'style': 'position: absolute; top: 10px; left: 10px; z-index: 1000;',
            'click': ui.createHandlerFn(this, this.showHelp),
        }, _('Help'));

        var createCommandButton = E('button', {
            'class': 'cbi-button cbi-button-neutral',
            'style': 'position: absolute; top: 10px; left: 80px; z-index: 1000;',
            'click': ui.createHandlerFn(this, this.showCreateCommand),
        }, _('Create command'));

        var terminalIframe = E('iframe', {
            'src': 'http://' + window.location.hostname + ':7681/?arg=/bin/bash',
            'style': 'width:90vw; height:80vh; margin: 0 auto; display: block; border:1px solid #ccc; resize: both; overflow: hidden; opacity: 0.9; scrollbar-width: thin; scrollbar-color: #888 #f1f1f1;',
            'sandbox': 'allow-scripts allow-same-origin',
        });

        return E('div', { 'class': 'zapret-app', 'style': 'width:100vw; height:100vh; position: relative; margin-left: calc(-50vw + 50%); background-image: url(/luci-static/resources/view/zapret/wallpaper.jpg); background-size: cover; background-position: center; background-attachment: fixed;' }, [
            helpButton,
            createCommandButton,
            E('div', {'style': 'text-align: center;'}, h2),
            E('div', {'class': 'cbi-section-descr', 'style': 'text-align: center;'}, _('Terminal window for running blockcheck.sh to test DPI bypass strategies.')),
            terminalIframe,
        ]);
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
