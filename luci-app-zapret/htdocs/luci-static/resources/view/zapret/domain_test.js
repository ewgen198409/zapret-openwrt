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
                if (resultArea) resultArea.innerHTML = '';
            }
        }, _('Clear'));

        var resultArea = E('div', {
            'id': 'result_area',
            'style': 'width:100%; height:400px; font-family: monospace; overflow-y: auto; background:rgba(20,20,20,0.5); border:1px solid rgba(255,255,255,0.1); padding:8px; box-sizing:border-box; border-radius: 4px; color: inherit;'
        });

        var progressBar = E('div', {
            'id': 'progress_bar_fill',
            'style': 'height:100%; width:0%; background:linear-gradient(90deg,#2a7,#4c4); transition:width 0.2s ease; border-radius:3px;'
        });
        var progressText = E('span', {
            'id': 'progress_text',
            'style': 'position:absolute; right:6px; top:50%; transform:translateY(-50%); font-size:11px; color:#aaa; white-space:nowrap;'
        }, '');
        var progressWrap = E('div', {
            'id': 'progress_wrap',
            'style': 'position:relative; flex:1; height:18px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:visible; display:none; align-self:center; margin-left:12px; opacity:0.7;'
        }, [ progressBar, progressText ]);

        return E('div', { 'class': 'zapret-app fade-in' }, [
            E('div', { 'class': 'cbi-section' }, [
                E('div', { 'class': 'cbi-section-title' }, _('Domain Test')),
                E('div', { 'class': 'cbi-section-descr' }, _('Test availability of domains with current zapret configuration.')),
                E('div', { 'style': 'margin-bottom: 10px;' }, [
                    E('label', { 'for': 'domains_input' }, _('Domains (space separated):')),
                    domainsInput
                ]),
                E('div', { 'style': 'margin-bottom: 10px; display:flex; align-items:center;' }, [
                    testButton,
                    ' ',
                    autoTestButton,
                    ' ',
                    clearButton,
                    progressWrap
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
            // Normalize: accept both strings and objects {host, id, country}
            domains = domainsArray.map(function(d) {
                if (typeof d === 'string') return { host: d, id: d, country: '' };
                return d;
            });
        } else {
            var domainsInput = document.getElementById('domains_input');
            if (!domainsInput) return;
            var raw = domainsInput.value;
            domains = raw.split(/\s+/).filter(function(d) { return d.trim().length > 0; })
                .map(function(d) { return { host: d, id: d, country: '' }; });
        }

        if (domains.length === 0) {
            resultArea.innerHTML = '';
            resultArea.appendChild(E('span', { 'style': 'color:#aaa' }, _('No domains entered.')));
            return;
        }

        resultArea.innerHTML = '';
        var wrap = document.getElementById('progress_wrap');
        var fill = document.getElementById('progress_bar_fill');
        var txt = document.getElementById('progress_text');
        if (wrap) { wrap.style.display = 'block'; }
        if (fill) { fill.style.width = '0%'; fill.style.background = 'linear-gradient(90deg,#2a7,#4c4)'; }
        if (txt) txt.textContent = '0 / ' + domains.length;
        this.testNext(domains, 0, resultArea, domains.length);
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

    testNext: function(domains, index, resultArea, total) {
        if (this._stopTest) {
            resultArea.appendChild(E('div', { 'style': 'color:#fa0; margin-top:6px' }, _('Test stopped by user.')));
            var fill = document.getElementById('progress_bar_fill');
            if (fill) fill.style.background = 'linear-gradient(90deg,#a70,#f84)';
            this._stopTest = false;
            this._setAutoTestButton(false);
            return;
        }

        if (index >= domains.length) {
            resultArea.appendChild(E('div', { 'style': 'color:#4c4; margin-top:6px' }, _('Test completed.')));
            var fill = document.getElementById('progress_bar_fill');
            if (fill) fill.style.width = '100%';
            this._stopTest = false;
            this._setAutoTestButton(false);
            return;
        }

        var entry = domains[index];
        var host = entry.host;
        var id = entry.id || host;
        var countryTag = entry.country ? ' [' + entry.country + ']' : '';
        var label = id + countryTag;
        var scriptPath = '/opt/zapret/domain-test.sh';

        var appendLine = function(idStr, countryStr, statusStr, timeStr, color) {
            var line = E('div', { 'style': 'display:flex; align-items:baseline; white-space:pre; color:' + color }, [
                E('span', { 'style': 'display:inline-block; width:220px; overflow:hidden; flex-shrink:0' }, idStr),
                E('span', { 'style': 'display:inline-block; width:60px; flex-shrink:0; color:#888' }, countryStr),
                E('span', { 'style': 'display:inline-block; width:70px; flex-shrink:0; font-weight:bold' }, statusStr),
                E('span', { 'style': 'color:#aaa' }, timeStr)
            ]);
            resultArea.appendChild(line);
            resultArea.scrollTop = resultArea.scrollHeight;
        };

        fs.exec(scriptPath, [host]).then(function(res) {
            if (res.code === 0 && res.stdout) {
                var parts = res.stdout.trim().split('|');
                var status = parts[0];
                var timeVal = parts[2];
                var timeStr = 'time: ' + ((timeVal && timeVal !== '-') ? parseFloat(timeVal).toFixed(3) + 's' : '-');
                var isOk = (status === 'OK');
                appendLine(id, entry.country ? '[' + entry.country + ']' : '', isOk ? '[ OK ]' : '[FAIL]', timeStr, isOk ? '#4c4' : '#f44');
            } else {
                appendLine(id, entry.country ? '[' + entry.country + ']' : '', '[ERROR]', '', '#f84');
            }
            var done = index + 1;
            var pct = total > 0 ? Math.round(done / total * 100) : 0;
            var fill = document.getElementById('progress_bar_fill');
            var txt = document.getElementById('progress_text');
            if (fill) fill.style.width = pct + '%';
            if (txt) txt.textContent = done + ' / ' + total;
            this.testNext(domains, index + 1, resultArea, total);
        }.bind(this)).catch(function(e) {
            appendLine(id, entry.country ? '[' + entry.country + ']' : '', '[EXCEPTION]', '', '#f84');
            this.testNext(domains, index + 1, resultArea, total);
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

			// Extra (our) domains go first
			var extraHosts = [
				'rutube.ru', 'esia.gosuslugi.ru', 'ntc.party', 'gosuslugi.ru',
				'instagram.com', 'facebook.com', 'lkfl2.nalog.ru', 'nalog.ru',
				'spankbang.com', 'rutracker.org', 'nnmclub.to', 'rutor.info',
				'openwrt.org', 'sxyprn.net', 'epidemz.net.co', 'pornhub.com',
				'kinozal.tv', 'discord.com', 'filmix.my', 'play.google.com',
				'flightradar24.com', 'cub.red', 'x.com'
			];
			var domains = extraHosts.map(function(h) {
				return { host: h, id: h, country: '' };
			});

			// Append JSON domains (skip duplicates), display id + country
			var seenHosts = {};
			extraHosts.forEach(function(h) { seenHosts[h] = true; });
			for (var i = 0; i < data.length; i++) {
				var item = data[i];
				var host = item.host || item.id || null;
				if (!host || typeof host !== 'string') continue;
				if (seenHosts[host]) continue;
				seenHosts[host] = true;
				domains.push({
					host: host,
					id: item.id || host,
					country: item.country || ''
				});
			}

			if (domains.length === 0) {
				throw new Error('No domains found in JSON');
			}

			fs.remove(tempJson).catch(function() {});
			this.runTest(domains);
		}.bind(this)).catch(function(e) {
			resultArea.innerHTML = '<span style="color:#f66">' + _('Auto test error: ') + e.message + '</span>';
			fs.remove(tempJson).catch(function() {});
		});
	}
});