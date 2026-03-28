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

        var autoTestButton = E('button', {
            'id': 'auto_test_btn',
            'class': 'cbi-button cbi-button-neutral',
            'click': ui.createHandlerFn(this, this.toggleAutoTest)
        }, _('Auto Test'));

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
                    autoTestButton,
                    ' ',
                    clearButton
                ]),
                resultArea
            ])
        ]);
    },

    runTest: function(domainsArray) {
        var resultArea = document.getElementById('result_area');
        if (!resultArea) return;

        var domains;
        if (domainsArray && domainsArray.length > 0) {
            domains = domainsArray;
        } else {
            var domainsInput = document.getElementById('domains_input');
            if (!domainsInput) return;
            var raw = domainsInput.value;
            domains = raw.split(/\s+/).filter(function(d) { return d.trim().length > 0; });
        }

        if (domains.length === 0) {
            resultArea.value = _('No domains entered.');
            return;
        }

        resultArea.value = '';
        this.testNext(domains, 0, resultArea);
    },

    _stopTest: false,

    _setAutoTestButton: function(running) {
        var btn = document.getElementById('auto_test_btn');
        if (!btn) return;
        if (running) {
            btn.textContent = _('Stop Test');
            btn.classList.remove('cbi-button-neutral');
            btn.classList.add('cbi-button-negative');
        } else {
            btn.textContent = _('Auto Test');
            btn.classList.remove('cbi-button-negative');
            btn.classList.add('cbi-button-neutral');
        }
    },

    toggleAutoTest: function() {
        if (this._stopTest === false && document.getElementById('auto_test_btn').textContent === _('Stop Test')) {
            this._stopTest = true;
            return;
        }
        this.runAutoTest();
    },

    testNext: function(domains, index, resultArea) {
        if (this._stopTest) {
            resultArea.value += _('\nTest stopped by user.\n');
            this._stopTest = false;
            this._setAutoTestButton(false);
            return;
        }

        if (index >= domains.length) {
            resultArea.value += _('\nTest completed.\n');
            this._stopTest = false;
            this._setAutoTestButton(false);
            return;
        }

        var domain = domains[index];
        var scriptPath = '/opt/zapret/domain-test.sh';

        fs.exec(scriptPath, [domain]).then(function(res) {
            if (res.code === 0 && res.stdout) {
                var parts = res.stdout.trim().split('|');
                var status = parts[0];
                var dom = parts[1];
                var timeVal = parts[2];
                var timeStr = (timeVal && timeVal !== '-') ? parseFloat(timeVal).toFixed(3) + 's' : '-';
                var maxDomainWidth = 50;
                var paddedDomain = (dom || domain).padEnd(maxDomainWidth);
                var paddedStatus = (status === 'OK' ? '[ OK ]' : '[FAIL]').padEnd(8);
                var paddedTime = ('time: ' + timeStr).padEnd(12);
                resultArea.value += paddedDomain + ' ' + paddedStatus + ' ' + paddedTime + '\n';
            } else {
                resultArea.value += domain.padEnd(50) + ' [ERROR]' + '\n';
            }
            this.testNext(domains, index + 1, resultArea);
        }.bind(this)).catch(function(e) {
            resultArea.value += domain.padEnd(50) + ' [EXCEPTION]' + '\n';
            this.testNext(domains, index + 1, resultArea);
        }.bind(this));
    },

	runAutoTest: function() {
		var resultArea = document.getElementById('result_area');
		if (!resultArea) return;

		this._stopTest = false;
		this._setAutoTestButton(true);
		resultArea.value = _('Loading domain list...\n');

		var jsonUrl = 'https://raw.githubusercontent.com/hyperion-cs/dpi-checkers/refs/heads/main/ru/tcp-16-20/suite.v2.json';
		var tempJson = '/tmp/dpi_suite.json';

		fs.exec('/usr/bin/wget', ['-q', '-O', tempJson, jsonUrl]).then(function(res) {
			if (res.code !== 0) {
				throw new Error('Failed to download domain list (wget exit ' + res.code + ')');
			}
			return fs.read(tempJson);
		}).then(function(jsonData) {
			var data;
			try {
				data = JSON.parse(jsonData);
			} catch(e) {
				throw new Error('Invalid JSON format: ' + e.message);
			}
			if (!data || !Array.isArray(data)) {
				throw new Error('Unexpected JSON structure (not an array)');
			}

			var domains = [];
			for (var i = 0; i < data.length; i++) {
				var item = data[i];
				// Приоритет: host, затем id
				if (item.host && typeof item.host === 'string') {
					domains.push(item.host);
				} else if (item.id && typeof item.id === 'string') {
					domains.push(item.id);
				}
			}
			if (domains.length === 0) {
				throw new Error('No domains found in JSON');
			}

			fs.remove(tempJson).catch(function() {});
			this.runTest(domains);
		}.bind(this)).catch(function(e) {
			resultArea.value = _('Auto test error: ') + e.message;
			fs.remove(tempJson).catch(function() {});
		});
	}
});