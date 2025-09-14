'use strict';
'require view';
'require fs';
'require form';
'require poll';
'require uci';
'require ui';
'require view.zapret.tools as tools';

return view.extend({
    retrieveLog: async function() {
        return Promise.all([
            L.resolveDefault(fs.stat('/bin/cat'), null),
            fs.exec('/usr/bin/find', [ '/tmp', '-maxdepth', '1', '-type', 'f', '-name', 'zapret+*.log' ]),
            uci.load(tools.appName),
        ]).then(function(status_array) {
            var filereader = status_array[0] ? status_array[0].path : null;
            var log_data   = status_array[1];   // stdout: multiline text
            if (log_data.code != 0) {
                ui.addNotification(null, E('p', _('Unable to get log files') + '(code = ' + log_data.code + ') : retrieveLog()'));
                return null;
            }
            var reason = '';
            var uci_cfg = uci.get(tools.appName, 'config');
            if (uci_cfg !== null && typeof(uci_cfg) === 'object') {
                let flag = uci_cfg.DAEMON_LOG_ENABLE;
                if (flag != '1') {
                    reason = ' (Reason: option DAEMON_LOG_ENABLE = ' + flag + ')';
                }
            }
            if (typeof(log_data.stdout) !== 'string') {
                return 'Log files not found.' + reason;
            }
            var log_list = log_data.stdout.trim().split('\n');
            if (log_list.length <= 0) {
                return 'Log files not found!' + reason;
            }
            for (let i = 0; i < log_list.length; i++) {
                let logfn = log_list[i].trim();
                if (logfn.startsWith('/tmp/') && logfn.endsWith('+main.log')) {
                    log_list.splice(i, 1);
                    log_list.unshift(logfn);
                    break;
                }
            }
            var tasks = [ ];
            var logdata = [ ];
            for (let i = 0; i < log_list.length; i++) {
                let logfn = log_list[i].trim();
                if (logfn.startsWith('/tmp/')) {
                    //console.log('LOG: ' + logfn);
                    logdata.push( { filename: logfn, data: null, rows: 0 } );
                    tasks.push( fs.read_direct(logfn) );
                }
            }
            return Promise.all(tasks).then(function(log_array) {
                for (let i = 0; i < log_array.length; i++) {
                    if (log_array[i]) {
                        logdata[i].data = log_array[i];
                        // Ограничиваем количество строк до 40
                        var lineCount = tools.getLineCount(log_array[i]) + 1;
                        logdata[i].rows = Math.min(lineCount, 40);
                    }
                }
                return logdata;
            }).catch(function(e) {
                ui.addNotification(null, E('p', _('Unable to execute or read contents')
                    + ': %s [ %s | %s | %s ]'.format(
                        e.message, 'retrieveLogData', 'uci.zapret'
                )));
                return null;
            });
        }).catch(function(e) {
            const [, lineno, colno] = e.stack.match(/(\d+):(\d+)/);
            ui.addNotification(null, E('p', _('Unable to execute or read contents')
                + ': %s [ lineno: %s | %s | %s | %s ]'.format(
                    e.message, lineno, 'retrieveLog', 'uci.zapret'
            )));
            return null;
        });
    },

    pollLog: async function() {
        let logdate_len = -2;
        let logdata;
        for (let txt_id = 0; txt_id < 10; txt_id++) {
            let elem = document.getElementById('dmnlog_' + txt_id);
            if (!elem)
                break;
            if (logdate_len == -2) {
                logdata = await this.retrieveLog();
                logdate_len = (Array.isArray(logdata)) ? logdata.length : -1;
            }
            let elem_name = elem.getAttribute("name");
            let founded = false;
            if (logdate_len > 0) {
                for (let log_num = 0; log_num < logdate_len; log_num++) {
                    if (logdata[log_num].filename == elem_name) {
                        if (logdata[log_num].data) {
                            elem.value = logdata[log_num].data;
                            // Сохраняем ограничение в 40 строк при обновлении
                            var lineCount = tools.getLineCount(logdata[log_num].data) + 1;
                            elem.rows = Math.min(lineCount, 40);
                            founded = true;
                        }
                        break;
                    }
                }
            }
            if (!founded) {
                elem.value = '';
                elem.rows = 0;
            }
        }
    },

    load: async function() {
        poll.add(this.pollLog.bind(this));
        return await this.retrieveLog();
    },
    
    render: function(logdata) {
        if (!logdata) {
            return;
        }
        if (typeof(logdata) === 'string') {
            return E('div', {}, [
                E('p', {'class': 'cbi-title-field'}, [ logdata ]),
            ]);
        }
        if (!Array.isArray(logdata)) {
            ui.addNotification(null, E('p', _('Unable to get log files') + ' : render()'));
            return;
        }
        
        // Добавляем CSS стили для растягивания лога и ограничения высоты
        var style = E('style', {}, `
            .log-container {
                width: 100%;
                overflow: hidden;
            }
            .log-textarea {
                width: 100%;
                box-sizing: border-box;
                font-family: monospace;
                font-size: 12px;
                white-space: pre;
                overflow-wrap: normal;
                overflow-x: auto;
                overflow-y: auto;
                resize: none;
                min-height: 200px;
                max-height: 600px;
            }
            .log-buttons {
                width: 100%;
                display: flex;
                justify-content: center;
                gap: 10px;
                margin: 10px 0;
            }
            .log-tab-content {
                width: 100%;
            }
            .log-controls {
                display: flex;
                justify-content: center;
                gap: 15px;
                margin: 10px 0;
            }
        `);

        var h2 = E('div', {'class' : 'cbi-title-section'}, [
            E('h2', {'class': 'cbi-title-field'}, [ _('Zapret') + ' - ' + _('Log Viewer') ]),
        ]);

        var tabs = E('div', {'class': 'log-container'}, E('div', {'class': 'log-tab-content'}));

        for (let log_num = 0; log_num < logdata.length; log_num++) {
            var logfn = logdata[log_num].filename;
            let filename = logfn.replace(/.*\//, '');
            let fname = filename.split('.')[0];
            fname = fname.replace(/^(zapret\+)/, '');
            
            let tabNameText = fname.replace(/\+/g, ' ');
            let tabname = 'tablog_' + log_num;

            var scrollDownButton = E('button', {
                'id': 'scrollDownButton_' + log_num,
                'class': 'cbi-button cbi-button-neutral',
                'click': ui.createHandlerFn(this, function() {
                    var textarea = document.getElementById('dmnlog_' + log_num);
                    if (textarea) {
                        textarea.scrollTop = textarea.scrollHeight;
                    }
                })
            }, _('Scroll to bottom'));

            var scrollUpButton = E('button', {
                'id': 'scrollUpButton_' + log_num,
                'class': 'cbi-button cbi-button-neutral',
                'click': ui.createHandlerFn(this, function() {
                    var textarea = document.getElementById('dmnlog_' + log_num);
                    if (textarea) {
                        textarea.scrollTop = 0;
                    }
                })
            }, _('Scroll to top'));
            
            let log_id = 'dmnlog_' + log_num;
            let log_name = logdata[log_num].filename;
            let log_text = (logdata[log_num].data) ? logdata[log_num].data : '';
            
            // Ограничиваем количество строк до 40
            var rows = Math.min(logdata[log_num].rows, 40);
            
            let tab = E('div', { 'data-tab': tabname, 'data-tab-title': tabNameText }, [
                E('div', { 'id': 'content_dmnlog_' + log_num, 'class': 'log-container' }, [
                    E('div', {'class': 'log-controls'}, [
                        scrollUpButton,
                        scrollDownButton
                    ]),
                    E('textarea', {
                        'id': log_id,
                        'name': log_name,
                        'class': 'log-textarea',
                        'readonly': 'readonly',
                        'wrap': 'off',
                        'rows': rows,
                    }, [ log_text ]),
                    E('div', {'class': 'log-controls'}, [
                        E('span', {'class': 'cbi-value-description'}, 
                          _('Showing maximum 40 lines. Use scroll buttons to navigate.')
                        )
                    ]),
                ]),
            ]);
            
            tabs.firstElementChild.appendChild(tab);
        }
        
        // Добавляем стили в DOM
        document.head.appendChild(style);
        
        ui.tabs.initTabGroup(tabs.firstElementChild.childNodes);
        return E('div', { 'class': 'zapret-app' }, [ h2, tabs ]);
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});

