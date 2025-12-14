'use strict';
'require view';
'require fs';
'require form';
'require ui';

return view.extend({
    load: function() {
        return Promise.resolve();
    },

    runBlockcheck: function() {
        var textarea = document.getElementById('blockcheck_output');
        if (!textarea) return;

        textarea.value = 'Running blockcheck.sh...\n';
        textarea.scrollTop = textarea.scrollHeight;

        // Запуск скрипта с BATCH=1 для неинтерактивного режима
        fs.exec('/bin/sh', ['-c', 'BATCH=1 /opt/zapret/blockcheck.sh']).then(function(res) {
            textarea.value += res.stdout || '';
            textarea.value += '\nExit code: ' + (res.code || 0) + '\n';
            textarea.scrollTop = textarea.scrollHeight;
        }).catch(function(e) {
            textarea.value += 'Error: ' + e.message + '\n';
            textarea.scrollTop = textarea.scrollHeight;
        });
    },

    render: function() {
        var h2 = E('div', {'class' : 'cbi-title-section'}, [
            E('h2', {'class': 'cbi-title-field'}, [ _('Zapret') + ' - ' + _('Blockcheck') ]),
        ]);

        var runButton = E('button', {
            'class': 'cbi-button cbi-button-positive',
            'click': ui.createHandlerFn(this, this.runBlockcheck),
        }, _('Run Blockcheck'));

        var outputTextarea = E('textarea', {
            'id': 'blockcheck_output',
            'class': 'cbi-input-textarea',
            'style': 'width:100% !important; height:400px; font-family:monospace;',
            'readonly': 'readonly',
            'placeholder': _('Output will appear here...'),
        });

        return E('div', { 'class': 'zapret-app' }, [
            h2,
            E('div', {'class': 'cbi-section'}, [
                E('div', {'class': 'cbi-section-descr'}, _('Run blockcheck.sh to test DPI bypass strategies. This may take some time.')),
                runButton,
                E('br'),
                outputTextarea,
            ]),
        ]);
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
