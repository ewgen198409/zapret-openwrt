'use strict';
'require baseclass';
'require fs';
'require poll';
'require uci';
'require dom';
'require ui';
'require view';
'require view.zapret.tools as tools';

const btn_style_neutral  = 'btn';
const btn_style_action   = 'btn cbi-button-action';
const btn_style_positive = 'btn cbi-button-save important';
const btn_style_negative = 'btn cbi-button-reset important';
const btn_style_warning  = 'btn cbi-button-negative';
const btn_style_success  = 'btn cbi-button-success important';

const fn_update_pkg_sh   = '/opt/'+tools.appName+'/update-pkg.sh';

return baseclass.extend({
    releasesUrlPrefix : 'https://raw.githubusercontent.com/ewgen198409/zapret-openwrt/gh-pages/releases/',
    installProgressTimer: null,
    installProgressValue: 0,
    
    appendLog: function(msg, end = '\n')
    {
        this.logArea.value += msg + end;
        this.logArea.scrollTop = this.logArea.scrollHeight;
    },

    setBtnMode: function(check, install, cancel)
    {
        this.btn_check.disabled   = check   ? false : true;
        this.btn_install.disabled = install ? false : true;
        this.btn_cancel.disabled  = cancel  ? false : true;
    },
    
    setStage: function(stage, btn_flag = true)
    {
        if (stage == 0) this.setBtnMode(1, 0, 1);
        if (stage == 1) this.setBtnMode(0, 0, 1);
        if (stage == 2) this.setBtnMode(1, 1, 1);
        if (stage == 3) this.setBtnMode(0, 0, 0);
        if (stage == 8) this.setBtnMode(0, 0, 1);
        if (stage >= 9) this.setBtnMode(0, 0, 0);

        if (stage == 3) {
            this.setInstallProgressVisible(true);
        } else if (stage == 0 || stage == 1 || stage == 2) {
            this.setInstallProgressVisible(false);
        }
        this.stage = stage;
    },

    setInstallProgressVisible: function(show)
    {
        if (!this.progressWrap) {
            return;
        }
        this.progressWrap.style.display = show ? 'flex' : 'none';
    },

    setInstallProgress: function(value, text)
    {
        if (!this.progressBar || !this.progressLabel) {
            return;
        }
        let v = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
        this.installProgressValue = v;
        this.progressBar.value = v;
        this.progressLabel.textContent = (text || _('Installing packages...')) + ' ' + v + '%';
    },

    updateInstallProgressFromLog: function()
    {
        if (!this.logArea) {
            return;
        }
        let txt = this.logArea.value || '';
        let v = this.installProgressValue || 0;

        if (/Downloading\s+/m.test(txt)) v = Math.max(v, 20);
        if (/Install downloaded packages\.\.\./m.test(txt)) v = Math.max(v, 55);
        if (/Install non-LuCI optional packages:/m.test(txt)) v = Math.max(v, 70);
        if (/Install LuCI optional packages:/m.test(txt)) v = Math.max(v, 80);
        if (/Temporary directory removed:/m.test(txt)) v = Math.max(v, 95);
        if (/RESULT:\s*\(\+\)/m.test(txt)) v = 100;

        this.setInstallProgress(v);
    },

    startInstallProgressMonitor: function()
    {
        this.stopInstallProgressMonitor();
        this.setInstallProgressVisible(true);
        this.setInstallProgress(5);
        this.installProgressTimer = setInterval(() => {
            this.updateInstallProgressFromLog();
        }, 700);
    },

    stopInstallProgressMonitor: function(finalizeOk)
    {
        if (this.installProgressTimer) {
            clearInterval(this.installProgressTimer);
            this.installProgressTimer = null;
        }
        if (finalizeOk) {
            this.setInstallProgress(100);
        }
    },

    checkUpdates: async function(ev)
    {
        this._action = 'checkUpdates';
        this.setStage(1);
        this.pkg_url = null;
        this.renderExtraPackages([]);
        this.appendLog(_('Checking for updates...'));
        let cmd = [ fn_update_pkg_sh, '-c' ];  // check for updates
        if (document.getElementById('cfg_exclude_prereleases').checked == false) {
            cmd.push('-p');  // include prereleases ZIP-files
        }
        this.forced_reinstall = document.getElementById('cfg_forced_reinstall').checked;
        return tools.execAndRead({
            cmd: cmd,
            log: '/tmp/'+tools.appName+'_pkg_check.log',
            logArea: this.logArea,
            callback: this.execAndReadCallback,
            ctx: this,
        });
    },

    installUpdates: async function(ev)
    {
        if (!this.pkg_url || this.pkg_url.length < 10) {
            this.appendLog('ERROR: pkg_url = null');
            this.setStage(9);
            return;
        }
        this._action = 'installUpdates';
        this.setStage(3);
        this.startInstallProgressMonitor();
        this.appendLog(_('Install updates...'));
        let cmd = [ fn_update_pkg_sh, '-u', this.pkg_url ];  // update packages
        let selectedExtras = this.getSelectedExtraPackages();
        if (selectedExtras.length > 0) {
            this.appendLog(_('Selected optional packages: ') + selectedExtras.join(', '));
        } else {
            this.appendLog(_('Optional packages not selected'));
        }
        if (selectedExtras.length > 0) {
            cmd.push('-e');
            cmd.push(selectedExtras.join(','));
        }
        if (document.getElementById('cfg_forced_reinstall').checked == true) {
            cmd.push('-f');  // forced reinstall if same version
        }
        //this._test = 1; cmd.push('-t'); cmd.push('45');  // only for testing
        return tools.execAndRead({
            cmd: cmd,
            log: '/tmp/'+tools.appName+'_pkg_install.log',
            logArea: this.logArea,
            hiderow: /^ \* resolve_conffiles.*(?:\r?\n|$)/gm,
            callback: this.execAndReadCallback,
            ctx: this,
        });
    },

    execAndReadCallback: function(rc, txt = '')
    {
        //console.log('execAndReadCallback = ' + rc + '; _action = ' + this._action);
        if (rc == 0 && txt) {
            let code = txt.match(/^RESULT:\s*\(([^)]+)\)\s+.+$/m);
            if (this._action == 'checkUpdates') {
                this.appendLog('=========================================================');
                if (code && code[1] == 'E') {
                    this.btn_install.textContent = _('Reinstall');
                } else {
                    this.btn_install.textContent = _('Install');
                }
                let extraPackages = [];
                let extraPkgMatch = txt.match(/^EXTRA_PKG_AVAILABLE\s*=\s*(.*)$/m);
                if (extraPkgMatch && extraPkgMatch[1]) {
                    extraPackages = extraPkgMatch[1]
                        .split(',')
                        .map(v => v.trim())
                        .filter(v => v.length > 0);
                }
                this.renderExtraPackages(extraPackages);
                if (extraPackages.length > 0) {
                    this.appendLog(_('Optional packages available: ') + extraPackages.join(', '));
                }
                let pkg_url = txt.match(/^ZAP_PKG_URL\s*=\s*(.+)$/m);
                if (code && pkg_url) {
                    // Check if versions are same (E or G codes)
                    let isSameVersion = (code[1] == 'E' || code[1] == 'G');
                    
                    if (isSameVersion && !this.forced_reinstall) {
                        // Same version and forced reinstall is OFF -> disable install
                        this.appendLog(_('Latest version already installed. Use "Forced reinstall" to reinstall.'));
                        this.setStage(0);  // install not needed
                        return;
                    }
                    
                    // If same version but forced reinstall is ON -> allow reinstall
                    if (isSameVersion && this.forced_reinstall) {
                        this.appendLog(_('Forced reinstall enabled - will reinstall current version.'));
                    }
                    
                    this.pkg_url = pkg_url[1];
                    this.setStage(2);  // enable all buttons
                    return;  // install allowed
                }
            }
            if (this._action == 'installUpdates') {
                if (this._test || (code && code[1] == '+')) {
                    this.stopInstallProgressMonitor(true);
                    this.setStage(9);
                    this.appendLog('Please update WEB-page (press F5)');
                    return;
                }
            }
        }
        if (this._action == 'installUpdates') {
            this.stopInstallProgressMonitor(false);
        }
        this.setStage(0);
        if (rc >= 500) {
            if (txt) {
                this.appendLog(txt.startsWith('ERROR') ? txt : 'ERROR: ' + txt);
            } else {
                this.appendLog('ERROR: ' + this._action + ': Terminated with error code = ' + rc);
            }
        } else {
            this.appendLog('ERROR: Process finished with retcode = ' + rc);
        }
        this.appendLog('=========================================================');
    },

    getSelectedExtraPackages: function()
    {
        let nodes = document.querySelectorAll('#cfg_extra_pkg_list input[type="checkbox"]:checked');
        let selected = [];
        nodes.forEach((cb) => {
            if (cb && cb.value && cb.value.length > 0) {
                selected.push(cb.value);
            }
        });
        return selected;
    },

    renderExtraPackages: function(pkgList)
    {
        if (!this.extraPkgSection || !this.extraPkgListNode) {
            return;
        }
        this.extraPkgCheckboxes = [];
        dom.content(this.extraPkgListNode, []);

        if (!pkgList || pkgList.length === 0) {
            this.extraPkgSection.style.display = 'none';
            return;
        }

        let rows = [];
        pkgList.forEach((pkg, idx) => {
            let id = 'cfg_extra_pkg_' + idx;
            let checkbox = E('input', { type: 'checkbox', id: id, value: pkg });
            this.extraPkgCheckboxes.push(checkbox);
            rows.push(E('label', { 'for': id, 'style': 'display:block; margin:4px 0; line-height:1.35;' }, [
                checkbox,
                ' ', pkg,
            ]));
        });

        dom.content(this.extraPkgListNode, rows);
        this.extraPkgSection.style.display = '';
    },

    openUpdateDialog: function(pkg_arch)
    {
        if (tools.checkUnsavedChanges()) {
            ui.addNotification(null, E('p', _('You have unapplied changes')));
            return;
        }
        this.stage = 0;
        this.pkg_arch = pkg_arch;
        this.pkg_url = null;

        let exclude_prereleases = E('label', [
            E('input', { type: 'checkbox', id: 'cfg_exclude_prereleases', checked: true }),
            ' ', _('Exclude PreReleases')
        ]);

        let forced_reinstall = E('label', [
            E('input', { type: 'checkbox', id: 'cfg_forced_reinstall'}),
            ' ', _('Forced reinstall packages')
        ]);

        this.extraPkgListNode = E('div', { 'id': 'cfg_extra_pkg_list', 'style': 'padding-left: 24px; margin-top: 6px;' });
        this.extraPkgSection = E('div', { 'id': 'cfg_extra_pkg_section', 'style': 'display:none; margin:8px 0 10px 0;' }, [
            E('strong', _('Optional additional packages')),
            E('br'),
            this.extraPkgListNode,
        ]);
        this.extraPkgCheckboxes = [];

        this.logArea = E('textarea', {
            'id': 'widget.modal_content',
            'readonly': true,
            'style': 'width:100% !important; font-family: monospace;',
            'rows': 20,
            'wrap': 'off',
        });

        this.btn_cancel = E('button', {
            'id': 'btn_cancel',
            'name': 'btn_cancel',
            'class': btn_style_warning,
        }, _('Cancel'));
        this.btn_cancel.onclick = ui.hideModal;

        this.btn_check = E('button', {
            'id': 'btn_check',
            'name': 'btn_check',
            'class': btn_style_action,
        }, _('Check'));
        this.btn_check.onclick = ui.createHandlerFn(this, this.checkUpdates);

        this.btn_install = E('button', {
            'id': 'btn_install',
            'name': 'btn_install',
            'class': btn_style_positive,
        }, _('Install'));
        this.btn_install.onclick = ui.createHandlerFn(this, async () => {
            let res = await this.installUpdates();
            if (true) {
                setTimeout(() => {
                    this.btn_install.disabled = true;
                }, 0);
            }
        });
        
        this.setStage(0);

        this.progressBar = E('progress', {
            'id': 'widget.install_progress',
            'max': 100,
            'value': 0,
            'style': 'width: 220px; height: 16px;'
        });
        this.progressLabel = E('span', { 'style': 'font-size: 12px; white-space: nowrap;' }, _('Installing packages...') + ' 0%');
        this.progressWrap = E('div', {
            'id': 'widget.install_progress_wrap',
            'style': 'display:none; flex-direction:column; align-items:center; gap:2px; min-width:240px;'
        }, [
            this.progressBar,
            this.progressLabel,
        ]);

        ui.showModal(_('Check for upgrades and installation'), [
            E('div', { 'class': 'cbi-section' }, [
                exclude_prereleases,
                E('br'), E('br'),
                forced_reinstall,
                E('br'), E('br'),
                this.extraPkgSection,
                E('hr', { 'style': 'margin: 8px 0 10px 0;' }),
                this.logArea,
            ]),
            E('div', { 'style': 'display:flex; justify-content:space-between; align-items:center; margin-top:1px;' }, [
                E('div', { 'class': 'left' }, [
                    this.btn_check,
                    ' ',
                    this.btn_install,
                ]),
                this.progressWrap,
                E('div', { 'class': 'right' }, [
                    ' ',
                    this.btn_cancel,
                ]),
            ]),
        ]);
        
        // Attach event listener to forced reinstall checkbox
        // This allows dynamic button activation when toggling forced reinstall
        setTimeout(() => {
            let checkboxForcedReinstall = document.getElementById('cfg_forced_reinstall');
            if (checkboxForcedReinstall) {
                checkboxForcedReinstall.addEventListener('change', (ev) => {
                    this.forced_reinstall = checkboxForcedReinstall.checked;
                    
                    // If we have a package URL and forced reinstall is now enabled,
                    // activate the install button even if versions are the same
                    if (this.pkg_url && this.stage == 0 && this.forced_reinstall) {
                        this.appendLog(_('Forced reinstall enabled - install button is now active.'));
                        this.setStage(2);
                    }
                    // If forced reinstall is disabled and versions are the same,
                    // disable the install button
                    else if (this.pkg_url && this.forced_reinstall == false && this.stage == 0) {
                        this.appendLog(_('Forced reinstall disabled - install button deactivated.'));
                        this.setStage(0);
                    }
                });
            }
        }, 100);
    },
});
