#
# Copyright (c) 2024 remittor
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-i18n-zapret-ru
PKG_VERSION:=72.20260403
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=remittor <https://github.com/remittor>
PKG_BUILD_DEPENDS:=luci-base/host
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=luci
  CATEGORY:=LuCI
  TITLE:=luci-app-zapret - Russian translation
  DEPENDS:=+luci-app-zapret
  PKGARCH:=all
endef

define Build/Compile
	mkdir -p $(PKG_BUILD_DIR)
	po2lmo ./po/ru/luci-app-zapret.po $(PKG_BUILD_DIR)/luci-app-zapret.ru.lmo
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/luci-app-zapret.ru.lmo $(1)/usr/lib/lua/luci/i18n/
endef

$(eval $(call BuildPackage,$(PKG_NAME)))