#
# Copyright (c) 2024 remittor
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-zapret
PKG_VERSION:=71.20250919
PKG_LICENSE:=MIT
PKG_MAINTAINER:=remittor <https://github.com/remittor>

LUCI_TITLE:=LuCI support for zapret
LUCI_DEPENDS:=+zapret
LUCI_PKGARCH:=all

define Package/$(PKG_NAME)/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	rm -f /tmp/luci-index*
	rm -rf /tmp/luci-modulecache/
	#killall -HUP rpcd 2>/dev/null
	/etc/init.d/rpcd reload
	[ -f "/sbin/luci-reload" ] && /sbin/luci-reload
	[ -f "/etc/init.d/uhttpd" ] && /etc/init.d/uhttpd reload
fi
exit 0
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/zapret
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/zapret/wallpaper.jpg $(1)/www/luci-static/resources/view/zapret/
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/zapret/Ubuntu-Regular.ttf $(1)/www/luci-static/resources/view/zapret/
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
