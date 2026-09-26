#!/bin/sh
# 사용: sh run_measure.sh before|after [데이터 루트(없으면 앱 기본)]
B="$(cd "$(dirname "$0")" && pwd -W)"
APP="/c/1.업무/7.ADOMS 구현/20_개발/_데모_용인시_20260920/04_앱/adoms2_v4"
cd "$APP" && ADOMS_OPS_DIR="$2" ADOMS_APP_DIR="$(pwd -W)" node --import "file:///$B/ts_loader.mjs" "$B/measure.mjs" "$1"
