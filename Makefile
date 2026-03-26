# Makefile for local building of zapret-openwrt packages
# Usage:
#   make                  - build all packages for default architecture
#   make ARCH=mipsel      - build for mipsel_24kc
#   make ARCH=aarch64    - build for aarch64_cortex-a53
#   make ARCH=all        - build for all architectures
#   make clean           - clean build artifacts
#   make help            - show this help

# Default architecture
ARCH ?= aarch64_cortex-a53

# Supported architectures
SUPPORTED_ARCHS = mipsel_24kc aarch64_cortex-a53

# OpenWrt version
OPENWRT_VERSION ?= 24.10.5

# Branch for SDK setup
OPENWRT_BRANCH ?= openwrt-24.10

# Package version
PKG_VERSION := 72.20260216

# Build options
JOBS ?= $(shell nproc)
MAKEFLAGS += -j$(JOBS)

# Paths
SCRIPT_DIR := $(shell pwd)
BUILD_ROOT ?= $(HOME)/zapret-build
SDK_PATH := $(BUILD_ROOT)/sdk-$(ARCH)

# Packages to build
PACKAGES = zapret zapret-tpws zapret-mdig zapret-ip2net luci-app-zapret

# Output directory
OUTPUT_DIR ?= $(HOME)/zapret-build/packages-$(ARCH)

# Colors
RED = \033[0;31m
GREEN = \033[0;32m
YELLOW = \033[0;33m
NC = \033[0m # No Color

# Help target
.PHONY: help
help:
	@echo "zapret-openwrt local build Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make [target] [ARCH=<arch>] [JOBS=<n>] [OPENWRT_VERSION=<ver>]"
	@echo ""
	@echo "Targets:"
	@echo "  all          - build all packages (default)"
	@echo "  clean        - clean build artifacts"
	@echo "  setup-sdk    - download and setup OpenWrt SDK"
	@echo "  help         - show this help"
	@echo ""
	@echo "Architecture options:"
	@echo "  ARCH=mipsel_24kc       - build for MIPS Little Endian (mt7621)"
	@echo "  ARCH=aarch64_cortex-a53 - build for ARM64 (default)"
	@echo "  ARCH=all               - build for all architectures"
	@echo ""
	@echo "OpenWrt version (default: 24.10.5):"
	@echo "  OPENWRT_VERSION=23.05.5"
	@echo "  OPENWRT_VERSION=24.10.5"
	@echo ""
	@echo "Examples:"
	@echo "  make ARCH=aarch64_cortex-a53"
	@echo "  make ARCH=mipsel_24kc"
	@echo "  make ARCH=all JOBS=4"
	@echo "  make OPENWRT_VERSION=23.05.5 ARCH=mipsel_24kc"
	@echo ""

# Check if SDK is available
define check_sdk
	@if [ ! -d "$(SDK_PATH)" ]; then \
		echo -e "$(RED)SDK not found at $(SDK_PATH)$(NC)"; \
		echo "Please run 'make setup-sdk' first or set SDK_PATH"; \
		exit 1; \
	fi
endef

# Download and setup OpenWrt SDK using setup.sh (like GitHub workflow)
.PHONY: setup-sdk
setup-sdk: setup-sdk-$(ARCH)

setup-sdk-mipsel_24kc:
	@echo -e "$(YELLOW)Setting up OpenWrt SDK for mipsel_24kc...$(NC)"
	@mkdir -p $(BUILD_ROOT)
	@cd $(BUILD_ROOT) && \
	wget -q https://downloads.openwrt.org/releases/$(OPENWRT_VERSION)/targets/ramips/mt7621/openwrt-sdk-$(OPENWRT_VERSION)-ramips-mt7621_gcc-13.3.0_musl.Linux-x86_64.tar.zst
	@cd $(BUILD_ROOT) && \
	unzstd openwrt-sdk-$(OPENWRT_VERSION)-ramips-mt7621_gcc-13.3.0_musl.Linux-x86_64.tar.zst && \
	tar -xf openwrt-sdk-$(OPENWRT_VERSION)-ramips-mt7621_gcc-13.3.0_musl.Linux-x86_64.tar
	@mv $(BUILD_ROOT)/openwrt-sdk-$(OPENWRT_VERSION)-ramips-mt7621_gcc-13.3.0_musl.Linux-x86_64 $(SDK_PATH)
	@echo -e "$(GREEN)SDK setup complete!$(NC)"

setup-sdk-aarch64_cortex-a53:
	@echo -e "$(YELLOW)Setting up OpenWrt SDK for aarch64_cortex-a53...$(NC)"
	@mkdir -p $(BUILD_ROOT)
	@cd $(BUILD_ROOT) && \
	wget -q https://downloads.openwrt.org/releases/$(OPENWRT_VERSION)/targets/armsr/armv8/openwrt-sdk-$(OPENWRT_VERSION)-armsr-armv8_gcc-13.3.0_musl.Linux-x86_64.tar.zst
	@cd $(BUILD_ROOT) && \
	unzstd openwrt-sdk-$(OPENWRT_VERSION)-armsr-armv8_gcc-13.3.0_musl.Linux-x86_64.tar.zst && \
	tar -xf openwrt-sdk-$(OPENWRT_VERSION)-armsr-armv8_gcc-13.3.0_musl.Linux-x86_64.tar
	@mv $(BUILD_ROOT)/openwrt-sdk-$(OPENWRT_VERSION)-armsr-armv8_gcc-13.3.0_musl.Linux-x86_64 $(SDK_PATH)
	@echo -e "$(GREEN)SDK setup complete!$(NC)"

# Build target for single architecture
.PHONY: build-arch
build-arch:
	@$(check_sdk)
	@echo -e "$(YELLOW)Building for $(ARCH)...$(NC)"
	@cd $(SDK_PATH) && \
		rm -rf ./package/zapret-openwrt && \
		cp -r $(SCRIPT_DIR) ./package/zapret-openwrt
	@cd $(SDK_PATH) && \
		mv feeds.conf.default feeds.conf && \
		sed -i -e 's|base.*\.git|base https://github.com/openwrt/openwrt.git|' feeds.conf && \
		sed -i -e 's|packages.*\.git|packages https://github.com/openwrt/packages.git|' feeds.conf && \
		sed -i -e 's|luci.*\.git|luci https://github.com/openwrt/luci.git|' feeds.conf && \
		mkdir -p ./logs
	@cd $(SDK_PATH) && \
		./scripts/feeds update base packages luci
	@cd $(SDK_PATH) && \
		./scripts/feeds install -a
	@cd $(SDK_PATH) && \
		make defconfig
	@cd $(SDK_PATH) && \
		sed -i 's/CONFIG_LUCI_JSMIN=y/CONFIG_LUCI_JSMIN=n/g' .config
	@cd $(SDK_PATH) && \
		make -j$(JOBS) package/zapret-openwrt/zapret/compile \
			package/zapret-openwrt/zapret-tpws/compile \
			package/zapret-openwrt/zapret-mdig/compile \
			package/zapret-openwrt/zapret-ip2net/compile \
			package/zapret-openwrt/luci-app-zapret/compile \
			CONFIG_CCACHE=1 BUILD_LOG=1
	@mkdir -p $(OUTPUT_DIR)
	@find $(SDK_PATH)/bin/packages -name "*.ipk" -exec cp {} $(OUTPUT_DIR)/ \;
	@echo -e "$(GREEN)Build complete! Packages saved to $(OUTPUT_DIR)$(NC)"
	@ls -la $(OUTPUT_DIR)

# Build for all architectures
.PHONY: all
all: 
	@if [ "$(ARCH)" = "all" ]; then \
		for arch in $(SUPPORTED_ARCHS); do \
			echo -e "$(YELLOW)========================================$(NC)"; \
			echo -e "$(YELLOW)Building for $$arch$(NC)"; \
			echo -e "$(YELLOW)========================================$(NC)"; \
			$(MAKE) ARCH=$$arch build-arch || true; \
		done; \
	else \
		$(MAKE) build-arch; \
	fi

# Build specific package
.PHONY: package
package:
	@$(check_sdk)
	@echo -e "$(YELLOW)Building package $(PKG) for $(ARCH)...$(NC)"
	@cd $(SDK_PATH) && \
		mkdir -p ./logs && \
		make -j$(JOBS) package/zapret-openwrt/$(PKG)/compile CONFIG_CCACHE=1 BUILD_LOG=1
	@find $(SDK_PATH)/bin/packages -name "$(PKG)_*.ipk" -exec cp {} $(OUTPUT_DIR)/ \;
	@echo -e "$(GREEN)Package $(PKG) built!$(NC)"

# Clean build artifacts
.PHONY: clean
clean:
	@echo -e "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -rf $(BUILD_ROOT)
	@rm -rf $(SCRIPT_DIR)/bin/packages-*
	@echo -e "$(GREEN)Clean complete!$(NC)"

# Show current configuration
.PHONY: info
info:
	@echo "Current configuration:"
	@echo "  ARCH:         $(ARCH)"
	@echo "  JOBS:         $(JOBS)"
	@echo "  PKG_VERSION:  $(PKG_VERSION)"
	@echo "  BUILD_ROOT:   $(BUILD_ROOT)"
	@echo "  SDK_PATH:     $(SDK_PATH)"
	@echo "  OUTPUT_DIR:   $(OUTPUT_DIR)"
	@echo ""
	@echo "Supported architectures: $(SUPPORTED_ARCHS)"
