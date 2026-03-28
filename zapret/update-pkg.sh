#!/bin/sh
# Copyright (c) 2025 remittor

EXE_DIR=$(cd "$(dirname "$0")" 2>/dev/null || exit 1; pwd)

opt_check=
opt_prerelease=
opt_update=
opt_forced=
opt_test=

while getopts "cu:pft:" opt; do
	case $opt in
		c) opt_check=true;;
		p) opt_prerelease="true";;
		u) opt_update="$OPTARG";;
		f) opt_forced="true";;
		t) opt_test="$OPTARG";;
	esac
done

ZAPRET_CFG_NAME="zapret"
if [ "$EXE_DIR" != "/tmp" ]; then
	[ -f "$EXE_DIR/comfunc.sh" ] || { echo "ERROR: file $EXE_DIR/comfunc.sh not found!"; exit 1; }
	. $EXE_DIR/comfunc.sh
fi

. /usr/share/libubox/jshn.sh
. /etc/openwrt_release

ZAP_PKG_DIR=/tmp/$ZAPRET_CFG_NAME-pkg

if [ "$opt_test" != "" ]; then
	echo 1; sleep 2;
	echo 2; sleep 2;
	echo 3; sleep 2;
	echo ' * resolve_conffiles 123456'; sleep 1;
	echo 4; sleep 2; 
	echo END
	return "$opt_test"
fi

ZAP_CPU_ARCH="$DISTRIB_ARCH"
REPO_OWNER="ewgen198409"
REPO_NAME="zapret-openwrt"
ZAP_REL_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/gh-pages/releases/releases_${ZAP_CPU_ARCH}.json"
CURL_TIMEOUT=5
CURL_HEADER1="Accept: application/json"
CURL_HEADER2="User-Agent: Mozilla/5.0 (compatible; zapret-updater)"

REL_JSON=
REL_ACTUAL_TAG=
REL_ACTUAL_PRE=
REL_ACTUAL_URL=
REL_ACTUAL_LUCI_URL=

ZAP_OUT=
ZAP_ERR=
ZAP_PKG_URL=

if command -v apk >/dev/null; then
	PKG_MGR=apk
	ZAP_PKG_EXT=apk
	PKG_CHECK="apk info -e "
	PKG_REMOVE="apk del --force "
elif command -v opkg >/dev/null; then
	PKG_MGR=opkg
	ZAP_PKG_EXT=ipk
	PKG_CHECK="opkg status "
	PKG_REMOVE="opkg remove --force-remove "
else
	echo "ERROR: No package manager found"
	return 1
fi

# -------------------------------------------------------------------------------------------------------

function check_pkg_installed
{
	local pkg_name="$1"
	if [ "$PKG_MGR" = apk ]; then
		apk info -e "$pkg_name" >/dev/null 2>&1; 
	else
		opkg status "$pkg_name" 2>/dev/null | grep -q .
	fi
}

function get_distrib_param
{
	local parname=$1
	local value="__unknown__"
	if [ -f /etc/openwrt_release ]; then
		while IFS='=' read -r key val; do
			val="${val#\'}"
			val="${val%\'}"
			val="${val#\"}"
			val="${val%\"}"
			if [ "$key" = "$parname" ]; then
				value="$val"
				break
			fi
		done < /etc/openwrt_release
	fi
	printf '%s' "$value"
}

function pkg_mgr_update
{
	local forced=$1
	if [ "$PKG_MGR" = "opkg" ]; then
		PKG_TOTAL=$( opkg list | wc -l )
		PKG_INSTALLED=$( opkg list-installed | wc -l )
		if [ "$PKG_TOTAL" -le "$PKG_INSTALLED" ] || [ "$PKG_TOTAL" -le $((PKG_INSTALLED + 100)) ]; then
			echo ">>> OPKG update..."
			opkg update
			return $?
		fi
	else
		PKG_AVAIL=$( apk list --available 2>/dev/null | wc -l )
		if [ "$PKG_AVAIL" -lt 100 ]; then
			echo ">>> APK update..."
			apk update
			return $?
		fi
	fi
	return 0
}

function curl_install
{
	if command -v curl >/dev/null 2>&1; then
		return 0
	fi
	pkg_mgr_update || { echo "ERROR: cannot update packages list"; return 1; }
	echo ">>> Package curl not found, installing..."
	if [ "$PKG_MGR" = "opkg" ]; then
		opkg install curl
	else
		apk add curl
	fi
}



function get_pkg_version
{
	local pkg_name="$1"
	local ver line base
	if [ "$PKG_MGR" = opkg ]; then
		ver=$( opkg list-installed "$pkg_name" 2>/dev/null | awk -F' - ' '{print $2}' | tr -d '\r' )
		if [ -n "$ver" ]; then
			echo -n "$ver"
			return 0
		fi
	fi
	if [ "$PKG_MGR" = apk ]; then
		line=$( apk info -s "$pkg_name" 2>/dev/null | head -n 1 | awk '{print $1}' || true )
		if [ -n "$line" ]; then
			base=${line%-r[0-9]*}
			ver=${base##*-}
			case "$line" in
				*-r[0-9]*)
					echo -n "$ver${line#$base}"
					;;
				*)
					echo -n "$ver"
					;;
			esac
			return 0
		fi
	fi
	echo ""
	return 1
}

function normalize_version
{
	local ver="$1"
	local base
	local major minor build rel
	local old_ifs
	case "$ver" in
		*-r[0-9]*)
			rel="${ver##*-r}"
			base="${ver%-r*}"
			;;
		*)
			rel=1
			base="$ver"
			;;
	esac
	old_ifs="$IFS" ; IFS='.' ; set -- $base ; IFS="$old_ifs"
	rel=${rel:-1}
	major=${1:-0}
	minor=${2:-0}
	echo "$major.$minor.$rel"
}

function pkg_version_cmp
{
	local ver1=$( normalize_version "$1" )
	local ver2=$( normalize_version "$2" )
	local x1 x2
	# major
	x1=$( echo "$ver1" | cut -d. -f1 )
	x2=$( echo "$ver2" | cut -d. -f1 )
	[ "$x1" -gt "$x2" ] && { echo -n "G"; return 0; }
	[ "$x1" -lt "$x2" ] && { echo -n "L"; return 0; }
	# minor
	x1=$( echo "$ver1" | cut -d. -f2 )
	x2=$( echo "$ver2" | cut -d. -f2 )
	[ "$x1" -gt "$x2" ] && { echo -n "G"; return 0; }
	[ "$x1" -lt "$x2" ] && { echo -n "L"; return 0; }
	# release
	x1=$( echo "$ver1" | cut -d. -f3 )
	x2=$( echo "$ver2" | cut -d. -f3 )
	[ "$x1" -gt "$x2" ] && { echo -n "G"; return 0; }
	[ "$x1" -lt "$x2" ] && { echo -n "L"; return 0; }
	echo -n "E"
}

function download_releases_info
{
	local fname resp hdr txt txtlen txtlines generated_at
	REL_JSON=
	
	echo "Download releases info from GitHub API..."
	
	# Use GitHub API directly
	local api_url="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases"
	
	echo "Fetching releases from: $api_url"
	resp=$( curl -s -D - --max-time $CURL_TIMEOUT -H "$CURL_HEADER1" -H "$CURL_HEADER2" "$api_url" 2>/dev/null )
	hdr="${resp%%$'\r\n\r\n'*}"
	status=$( printf '%s\n' "$hdr" | head -n 1 | awk '{print $2}' )
	
	if [ "$status" != 200 ]; then
		echo "ERROR: Cannot download file from GitHub API (status = $status)"
		return 103
	fi
	
	txt="${resp#*$'\r\n\r\n'}"
	txtlen=${#txt}
	txtlines=$(printf '%s\n' "$txt" | wc -l)
	
	if [ $txtlen -lt 64 ]; then
		echo "ERROR: Cannot download releases info! (size = $txtlen)"
		return 104
	fi
	
	# Convert GitHub API response to our JSON format
	# Extract first release with its tag_name (handle both with and without spaces around colon)
	local first_tag=$(echo "$txt" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
	local first_prerel=$(echo "$txt" | grep -A 5 "\"tag_name\"" | grep '"prerelease"' | grep -o 'false\|true' | head -1)
	local generated_at=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
	
	if [ -z "$first_tag" ]; then
		echo "ERROR: Cannot download releases info! (no releases found)"
		return 105
	fi
	
	# Extract real download URLs from API response for this architecture
	# Look for zapret package matching our architecture
	local zapret_asset=$(echo "$txt" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*zapret_[^"]*_'"${ZAP_CPU_ARCH}"'\.ipk[^"]*"' | head -1 | cut -d'"' -f4)
	
	# If not found with arch-specific pattern, try generic pattern (some releases may have different naming)
	if [ -z "$zapret_asset" ]; then
		zapret_asset=$(echo "$txt" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*zapret[^"]*\.ipk[^"]*"' | head -1 | cut -d'"' -f4)
	fi
	
	# Look for luci-app-zapret package (architecture independent, marked as 'all')
	local luci_asset=$(echo "$txt" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*luci-app-zapret[^"]*\.ipk[^"]*"' | head -1 | cut -d'"' -f4)
	
	# Build our expected JSON format
	REL_JSON="{"
	REL_JSON="${REL_JSON}\"generated_at\":\"${generated_at}\","
	REL_JSON="${REL_JSON}\"releases\":{"
	REL_JSON="${REL_JSON}\"0\":{"
	REL_JSON="${REL_JSON}\"tag\":\"${first_tag}\","
	REL_JSON="${REL_JSON}\"prerelease\":${first_prerel},"
	REL_JSON="${REL_JSON}\"assets\":["
	
	if [ -n "$zapret_asset" ]; then
		REL_JSON="${REL_JSON}{\"name\":\"zapret_${first_tag}_${ZAP_CPU_ARCH}.ipk\",\"browser_download_url\":\"${zapret_asset}\"},"
	fi
	
	if [ -n "$luci_asset" ]; then
		REL_JSON="${REL_JSON}{\"name\":\"luci-app-zapret_${first_tag}_all.ipk\",\"browser_download_url\":\"${luci_asset}\"}"
	fi
	
	REL_JSON="${REL_JSON}]"
	REL_JSON="${REL_JSON}}}}}"
	
	echo "Releases info downloaded! Size = $txtlen, Lines = $txtlines"
	echo "First release: $first_tag (prerelease=$first_prerel)"
	if [ -n "$zapret_asset" ]; then
		echo "Found zapret for $ZAP_CPU_ARCH: ${zapret_asset##*/}"
	fi
	if [ -n "$luci_asset" ]; then
		echo "Found luci-app-zapret: ${luci_asset##*/}"
	fi
	# Debug: show JSON structure
	echo "DEBUG: REL_JSON structure:" >&2
	echo "$REL_JSON" | head -c 200 >&2
	echo "" >&2
	return 0
}

function get_actual_release
{
	local tag url pre idx_list
	REL_ACTUAL_TAG=
	REL_ACTUAL_PRE=
	REL_ACTUAL_URL=
	REL_ACTUAL_LUCI_URL=
	json_load "$(printf '%s' "$REL_JSON")"
	if [ $? -ne 0 ]; then
		echo "ERROR: incorrect format of ${ZAP_REL_URL##*/}"
		json_cleanup
		return 151
	fi
	json_select releases
	if [ $? -ne 0 ]; then
		echo "ERROR: incorrect format of ${ZAP_REL_URL##*/}"
		json_cleanup
		return 157
	fi
	json_get_keys idx_list
	# array already sorted by created_at => take first elem
	for rel_id in $idx_list; do
		json_select "$rel_id"   # enter into releases[rel_id]
		json_get_var tag tag
		json_get_var pre prerelease
		if [ "$opt_prerelease" != "true" ] && [ "$pre" = "1" ]; then
			json_select ..   # exit from releases[rel_id]
			continue
		fi
		json_select assets
		if [ $? -ne 0 ]; then
			echo "ERROR: release[$rel_id] has not include 'assets'"
			json_cleanup
			return 160
		fi
		
		# Get all assets (zapret and luci-app-zapret)
		local asset_idx=1
		while true; do
			json_select "$asset_idx" > /dev/null 2>&1
			if [ $? -ne 0 ]; then
				break  # No more assets
			fi
			
			local asset_url asset_name
			json_get_var asset_name name
			json_get_var asset_url browser_download_url
			
			# Check what type of asset this is
			case "$asset_name" in
				*"luci-app"*)
					REL_ACTUAL_LUCI_URL="$asset_url"
					;;
				*)
					if [ -z "$REL_ACTUAL_URL" ]; then
						REL_ACTUAL_URL="$asset_url"
					fi
					;;
			esac
			
			json_select ..  # back to assets
			asset_idx=$((asset_idx + 1))
		done
		
		json_select ..  # exit from assets
		json_select ..  # exit from releases[rel_id]
		json_cleanup
		REL_ACTUAL_TAG="$tag"
		REL_ACTUAL_PRE="$pre"
		# Debug output
		echo "DEBUG: REL_ACTUAL_TAG='$REL_ACTUAL_TAG' REL_ACTUAL_URL='$REL_ACTUAL_URL' REL_ACTUAL_LUCI_URL='$REL_ACTUAL_LUCI_URL'" >&2
		return 0
	done
	json_cleanup
	echo "ERROR: latest release for arch \"$ZAP_CPU_ARCH\" not found!"
	return 150  # release not found
}

# -------------------------------------------------------------------------------------------------------

if [ "$opt_check" != "true" -a "$opt_update" = "" ]; then
	echo 'ERROR: Incorrect arguments'
	return 4
fi

if [ "$opt_update" = "@" ]; then
	opt_check="true"
fi

#echo "DISTRIB_ID: $DISTRIB_ID"
echo "DISTRIB_RELEASE: $DISTRIB_RELEASE"
echo "DISTRIB_DESCRIPTION:" $( get_distrib_param DISTRIB_DESCRIPTION )
echo "DISTRIB_ARCH:" $( get_distrib_param DISTRIB_ARCH )

if ! command -v curl >/dev/null 2>&1; then
	if [ "$opt_forced" = true ]; then
		curl_install
	fi
fi
if ! command -v curl >/dev/null 2>&1; then
	echo "ERROR: Required package \"curl\" not installed!"
	return 10
fi
CURL_INFO=$( curl -V )
if ! echo "$CURL_INFO" | grep -q 'https'; then
    echo "------- package curl"
	echo "$CURL_INFO"
	echo "-------"
	echo "ERROR: package \"curl\" not supported HTTPS protocol!"
	echo "NOTE: Please install package \"curl-ssl\""
	return 11
fi

if [ "$opt_check" = "true" ]; then
	download_releases_info
	ZAP_ERR=$?
	if [ $ZAP_ERR -ne 0 ]; then
		echo "ERROR: Func download_releases_info return error code: $ZAP_ERR"
		return $ZAP_ERR
	fi
	get_actual_release
	ZAP_ERR=$?
	if [ $ZAP_ERR = 150 ] && [ "$opt_prerelease" != true ] && [ "$opt_forced" = true ]; then
		opt_prerelease="true"
		get_actual_release
		ZAP_ERR=$?
	fi
	if [ $ZAP_ERR -ne 0 ]; then
		echo "ERROR: Func get_actual_release return error code: $ZAP_ERR"
		return $ZAP_ERR
	fi
	echo "Latest package version: $REL_ACTUAL_TAG"
	echo "Latest package url: $REL_ACTUAL_URL"
elif [ "$opt_update" = "@" ]; then
	# When updating to latest (@), we need to get release info from GitHub API
	download_releases_info
	ZAP_ERR=$?
	if [ $ZAP_ERR -ne 0 ]; then
		echo "ERROR: Func download_releases_info return error code: $ZAP_ERR"
		return $ZAP_ERR
	fi
	get_actual_release
	ZAP_ERR=$?
	if [ $ZAP_ERR = 150 ] && [ "$opt_prerelease" != true ] && [ "$opt_forced" = true ]; then
		opt_prerelease="true"
		get_actual_release
		ZAP_ERR=$?
	fi
	if [ $ZAP_ERR -ne 0 ]; then
		echo "ERROR: Func get_actual_release return error code: $ZAP_ERR"
		return $ZAP_ERR
	fi
	echo "Latest package version: $REL_ACTUAL_TAG"
	echo "Latest package url: $REL_ACTUAL_URL"
fi

ZAP_PKG_SIZE=
ZAP_PKG_SZ=
ZAP_PKG_ZIP_NAME=
ZAP_PKG_FN=
ZAP_PKG_BASE_FN=
ZAP_PKG_LUCI_FN=

ZAP_CUR_PKG_VER=$( get_pkg_version $ZAPRET_CFG_NAME )
echo "Current installed version: $ZAP_CUR_PKG_VER"

if [ "$opt_update" = "" ]; then
	ZAP_PKG_URL="$REL_ACTUAL_URL"
	if [ "$ZAP_PKG_URL" = "" ]; then
		echo "ERROR: actual release not found!"
		return 199
	fi
else
	ZAP_PKG_URL="$opt_update"
	if [ "$opt_update" = "@" ]; then
		ZAP_PKG_URL="$REL_ACTUAL_URL"
	fi
	if [ "$opt_update" = "@" -a "$ZAP_PKG_URL" = "" ]; then
		echo "ERROR: actual release not found!"
		return 199
	fi
fi

ZAP_PKG_ZIP_NAME=${ZAP_PKG_URL##*/}
# Extract version from filename: handles both "zapret_v72.x_arch" and "zapret_72.x_arch" formats
# First try with "v" prefix: zapret_v72.20260312_mipsel_24kc.ipk -> 72.20260312
ZAP_PKG_ZIP_VER=${ZAP_PKG_ZIP_NAME#*_v}
# If no "v" found (version string is same as original), try without "v" prefix
if [ "$ZAP_PKG_ZIP_VER" = "$ZAP_PKG_ZIP_NAME" ]; then
	# Format: zapret_72.20260312_mipsel_24kc.ipk -> 72.20260312
	ZAP_PKG_ZIP_VER=${ZAP_PKG_ZIP_NAME#*_}     # Remove everything up to and including first "_"
	ZAP_PKG_ZIP_VER=${ZAP_PKG_ZIP_VER%%_*}     # Keep only the version part before next "_"
	ZAP_PKG_ZIP_VER=${ZAP_PKG_ZIP_VER%%-*}     # Handle dash separator too (e.g. "72.20260312-r1")
else
	# Version was found with "v" prefix, extract it
	ZAP_PKG_ZIP_VER=${ZAP_PKG_ZIP_VER%%_*}
fi

if [ "$opt_update" != "" ]; then
	if [ "$opt_update" = "@" ]; then
		echo "Latest  available version: $ZAP_PKG_ZIP_VER"
	else
		echo "Target  requested version: $ZAP_PKG_ZIP_VER"
	fi
fi
echo "ZAP_PKG_URL = $ZAP_PKG_URL"

ZAP_VER_CMP=$( pkg_version_cmp "$ZAP_CUR_PKG_VER" "$ZAP_PKG_ZIP_VER" )
if [ "$opt_update" = "" ]; then
	if [ "$ZAP_VER_CMP" = "E" ]; then
		echo "RESULT: (E) No update required for this package!"
	elif [ "$ZAP_VER_CMP" = "G" ]; then
		echo "RESULT: (G) You have a newer version installed than the one on GitHub!"
	elif [ "$ZAP_VER_CMP" = "L" ]; then
		echo "RESULT: (L) You have an older version installed than the one on GitHub!"
	else
		echo "ERROR: ZAP_PKG_ZIP_VER='$ZAP_PKG_ZIP_VER' ZAP_VER_CMP='$ZAP_VER_CMP'"
		return 199
	fi
	return 0
fi

if [ "$opt_update" != "" ]; then
	if [ "$opt_forced" != "true" ]; then
		if [ "$ZAP_VER_CMP" = "E" ]; then
			echo "RESULT: (E) No update required for this package!"
			return 0
		fi
	fi
	ZAP_PKG_DIR=/tmp/$ZAPRET_CFG_NAME-pkg
	rm -rf $ZAP_PKG_DIR 2>/dev/null
	mkdir -p $ZAP_PKG_DIR
	
	# Use ZAP_PKG_URL directly (already contains correct download URL from GitHub)
	ZAP_PKG_FILE="${ZAPRET_CFG_NAME}_${ZAP_PKG_ZIP_VER}_${ZAP_CPU_ARCH}.${ZAP_PKG_EXT}"
	echo "Downloading $ZAP_PKG_FILE from $ZAP_PKG_URL..."
	curl -s -L --retry 3 --retry-delay 1 --max-time 60 -H "$CURL_HEADER2" \
		"${ZAP_PKG_URL}" -o "$ZAP_PKG_DIR/$ZAP_PKG_FILE"
	if [ $? -ne 0 ]; then
		echo "ERROR: cannot download ${ZAP_PKG_FILE}!"
		return 215
	fi
	
	# For luci-app-zapret: if we got it from GitHub API, we have the direct URL
	# Otherwise find it from release page
	if [ -n "$REL_ACTUAL_LUCI_URL" ]; then
		LUCI_PKG_URL="$REL_ACTUAL_LUCI_URL"
	else
		# Extract directory from ZAP_PKG_URL and try to find luci package
		release_dir="${ZAP_PKG_URL%/*}"
		LUCI_PKG_URL=$(curl -s "$release_dir/" 2>/dev/null | grep -o "href=\"[^\"]*luci-app-${ZAPRET_CFG_NAME}[^\"]*\.${ZAP_PKG_EXT}[^\"]*\"" | head -1 | cut -d'"' -f2 | awk '{print $1}')
		if [ -z "$LUCI_PKG_URL" ]; then
        # Fallback: try common naming pattern
			LUCI_PKG_URL="${release_dir}/luci-app-${ZAPRET_CFG_NAME}_${ZAP_PKG_ZIP_VER}-r1_all.${ZAP_PKG_EXT}"
		fi
	fi
	
	LUCI_PKG_FILE="luci-app-${ZAPRET_CFG_NAME}_${ZAP_PKG_ZIP_VER}-r1_all.${ZAP_PKG_EXT}"
	echo "Downloading $LUCI_PKG_FILE from $LUCI_PKG_URL..."
	curl -s -L --retry 3 --retry-delay 1 --max-time 60 -H "$CURL_HEADER2" \
		"${LUCI_PKG_URL}" -o "$ZAP_PKG_DIR/$LUCI_PKG_FILE"
	if [ $? -ne 0 ]; then
		echo "ERROR: cannot download ${LUCI_PKG_FILE}!"
		return 216
	fi
	ZAP_PKG_LIST=$( ls -1 "$ZAP_PKG_DIR" )
	echo "------ Downloaded packages:"
	echo "$ZAP_PKG_LIST"
	echo "------"
	if [ "$PKG_MGR" != "apk" ]; then
		ZAP_PKG_BASE_FN=$( find "$ZAP_PKG_DIR" -maxdepth 1 -type f -name "${ZAPRET_CFG_NAME}_*.${ZAP_PKG_EXT}" | head -n 1 )
	else
		ZAP_PKG_BASE_FN=$( find "$ZAP_PKG_DIR" -maxdepth 1 -type f -name "${ZAPRET_CFG_NAME}-[0-9]*.?*.${ZAP_PKG_EXT}" | head -n 1 )
	fi
	ZAP_PKG_LUCI_FN=$( find "$ZAP_PKG_DIR" -maxdepth 1 -type f -name "luci-app-${ZAPRET_CFG_NAME}*.${ZAP_PKG_EXT}" | head -n 1 )
	if [ ! -f "$ZAP_PKG_BASE_FN" ]; then
		echo "ERROR: File \"${ZAPRET_CFG_NAME}*.${ZAP_PKG_EXT}\" not found!"
		return 231
	fi
	echo "ZAP_PKG_BASE_FN = $ZAP_PKG_BASE_FN"
	if [ ! -f "$ZAP_PKG_LUCI_FN" ]; then
		echo "ERROR: File \"luci-app-${ZAPRET_CFG_NAME}*.${ZAP_PKG_EXT}\" not found!"
		return 232
	fi
	echo "ZAP_PKG_LUCI_FN = $ZAP_PKG_LUCI_FN"
	if [ "$opt_forced" = true ]; then
		pkg_mgr_update
	fi
	if check_pkg_installed ${ZAPRET_CFG_NAME}-mdig; then
		echo "Uninstall mdig..."
		${PKG_REMOVE} ${ZAPRET_CFG_NAME}-mdig
	fi
	if check_pkg_installed ${ZAPRET_CFG_NAME}-ip2net; then
		echo "Uninstall ip2net..."
		${PKG_REMOVE} ${ZAPRET_CFG_NAME}-ip2net
	fi
	echo "Install downloaded packages..."
	if [ "$PKG_MGR" != "apk" ]; then
		opkg install --force-reinstall "$ZAP_PKG_BASE_FN"
	else
		apk add --allow-untrusted --upgrade "$ZAP_PKG_BASE_FN"
	fi
	if [ $? -ne 0 ]; then
		echo "ERROR: Failed to install package $ZAP_PKG_BASE_FN"
		return 245
	fi
	if [ "$PKG_MGR" != "apk" ]; then
		opkg install --force-reinstall "$ZAP_PKG_LUCI_FN"
	else
		apk add --allow-untrusted --upgrade "$ZAP_PKG_LUCI_FN"
	fi
	if [ $? -ne 0 ]; then
		echo "ERROR: Failed to install package $ZAP_PKG_LUCI_FN"
		return 247
	fi
	echo "RESULT: (+) Packages successfully installed!"
fi
