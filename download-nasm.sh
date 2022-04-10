#!/usr/bin/env bash
#
# Download NASM binaries and release tarballs from the official site.
#
# Usage:
#
#     ./download-nasm.sh <version>

set -eu

NASM_WEBSITE=https://www.nasm.us/pub/nasm/releasebuilds/

usage() {
    awk 'NR == 3, /^$/ { print substr($0, 3) }' "$0"
}

die() {
    echo >&2 "Error: $*"
    echo >&2
    usage
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help) usage; exit;;
      --) shift; break;;
      -*) die "unknown option: $1";;
       *) break;;
    esac
done

if [[ $# -lt 1 ]]
then
    die "missing NASM version"
fi

version="$1"

download() {
    curl -fL --create-dirs \
        "$NASM_WEBSITE/$version/$1" \
        --output "releasebuilds/$version/$1" \
        --write-out "[+] %{http_code} %{filename_effective}"
    echo
}

download "nasm-${version}.tar.gz"
# TODO: download and unpack Linux RPM
download "macosx/nasm-${version}-macosx.zip"
download "win64/nasm-${version}-win64.zip"

