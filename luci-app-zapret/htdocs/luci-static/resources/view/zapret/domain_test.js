'use strict';
'require view';
'require fs';
'require ui';
'require view.zapret.tools as tools';

return view.extend({
    render: function() {
        var domainsInput = E('textarea', {
            'id': 'domains_input',
            'class': 'cbi-input-textarea',
            'style': 'width:100%; height:100px;',
            'placeholder': _('Enter domains separated by spaces or new lines\nExample: rutracker.org iana.org startmail.com')
        });

        var testButton = E('button', {
            'class': 'cbi-button cbi-button-positive',
            'click': ui.createHandlerFn(this, this.runTest)
        }, _('Test'));

        var clearButton = E('button', {
            'class': 'cbi-button cbi-button-neutral',
            'click': function() {
                var resultArea = document.getElementById('result_area');
                if (resultArea) resultArea.value = '';
            }
        }, _('Clear'));

        var resultArea = E('textarea', {
            'id': 'result_area',
            'class': 'cbi-input-textarea',
            'style': 'width:100%; height:400px; font-family: monospace;',
            'readonly': true
        });

        return E('div', { 'class': 'zapret-app fade-in' }, [
            E('div', { 'class': 'cbi-section' }, [
                E('div', { 'class': 'cbi-section-title' }, _('Domain Test')),
                E('div', { 'class': 'cbi-section-descr' }, _('Test availability of domains with current zapret configuration.')),
                E('div', { 'style': 'margin-bottom: 10px;' }, [
                    E('label', { 'for': 'domains_input' }, _('Domains (space separated):')),
                    domainsInput
                ]),
                E('div', { 'style': 'margin-bottom: 10px;' }, [
                    testButton,
                    ' ',
                    clearButton
                ]),
                resultArea
            ])
        ]);
    },

    runTest: function() {
        var domainsInput = document.getElementById('domains_input');
        var resultArea = document.getElementById('result_area');
        if (!domainsInput || !resultArea) return;

        var raw = domainsInput.value;
        var domains = raw.split(/\s+/).filter(function(d) { return d.trim().length > 0; });
        if (domains.length === 0) {
            resultArea.value = _('No domains entered.');
            return;
        }

        resultArea.value = _('Testing...\n');

        var tempFile = '/tmp/domain_test_input.txt';
        var outputFile = '/tmp/domain_test_output.txt';
        var scriptPath = '/opt/zapret/domain-test.sh';

        // Записываем домены в временный файл (по одному на строку)
        fs.write(tempFile, domains.join('\n') + '\n').then(function() {
            // Проверяем существование скрипта
            return fs.stat(scriptPath);
        }).then(function() {
            // Вызываем бэкенд-скрипт
            return fs.exec(scriptPath, [tempFile, outputFile]);
        }).then(function(res) {
            // Читаем результат
            return fs.read(outputFile);
        }).then(function(content) {
            resultArea.value = content;
        }).catch(function(e) {
            resultArea.value = _('Error: ') + e.message;
        }).finally(function() {
            // Удаляем временные файлы (если они есть)
            fs.remove(tempFile).catch(function() {});
            fs.remove(outputFile).catch(function() {});
        });
    }
});