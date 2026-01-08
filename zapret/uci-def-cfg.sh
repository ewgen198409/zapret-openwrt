#!/bin/sh
# Copyright (c) 2024 remittor

. /opt/zapret/comfunc.sh

# create empty txt files into ipset directory
[ ! -f "/opt/zapret/ipset/zapret-hosts-google.txt"     ] && touch "/opt/zapret/ipset/zapret-hosts-google.txt"
#[ ! -f "/opt/zapret/ipset/zapret-hosts-auto.txt"      ] && touch "/opt/zapret/ipset/zapret-hosts-auto.txt"
[ ! -f "/opt/zapret/ipset/zapret-hosts-user.txt"       ] && touch "/opt/zapret/ipset/zapret-hosts-user.txt"
[ ! -f "/opt/zapret/ipset/zapret-hosts-user-ipban.txt" ] && touch "/opt/zapret/ipset/zapret-hosts-user-ipban.txt"
#[ ! -f "/opt/zapret/ipset/zapret-ip.txt"              ] && touch "/opt/zapret/ipset/zapret-ip.txt"
[ ! -f "/opt/zapret/ipset/zapret-ip-user.txt"          ] && touch "/opt/zapret/ipset/zapret-ip-user.txt"
[ ! -f "/opt/zapret/ipset/zapret-ip-user-exclude.txt"  ] && touch "/opt/zapret/ipset/zapret-ip-user-exclude.txt"
[ ! -f "/opt/zapret/ipset/zapret-ip-user-ipban.txt"    ] && touch "/opt/zapret/ipset/zapret-ip-user-ipban.txt"
[ ! -f "/opt/zapret/ipset/cust1.txt"                   ] && touch "/opt/zapret/ipset/cust1.txt"

# create or merge uci-config
$ZAPRET_BASE/renew-cfg.sh
	