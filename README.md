Zapret is not a VPN! Zapret is an Anti-DPI utility!
!!! Для работы Blockcheck необходимо чтовы все пакеты из архива были установлены.
!!! Также желательна установка пакета dnsmasq-full вместо dnsmasq. Если удалять dnsmasq через web-интерфейс, то есть риск оставить роутер без работающего DNS, что сделает невозможным установку dnsmasq-full. Поэтому такую замену пакета рекомендуется делать через ssh в соответствии с данным рецептом. opkg update; cd /tmp/ && opkg download dnsmasq-full; opkg install ipset libnettle8 libnetfilter-conntrack3;
opkg remove dnsmasq; opkg install dnsmasq-full --cache /tmp/; rm -f /tmp/dnsmasq-full*.ipk;
[Instructions for installing](https://github.com/remittor/zapret-openwrt/wiki/Installing-zapret‐openwrt-package)

[Download page](https://github.com/ewgen198409/zapret-openwrt/releases)

## Screenshots

![image](https://github.com/ewgen198409/zapret-openwrt/blob/24.10/image.PNG)
<img width="1886" height="879" alt="image" src="https://github.com/user-attachments/assets/65b2e021-f5c4-4eec-a8ab-cc0693c42d5f" />

