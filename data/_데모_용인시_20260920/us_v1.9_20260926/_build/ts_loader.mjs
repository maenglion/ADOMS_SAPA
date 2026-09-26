// 앱(3400) 계산 함수를 node 에서 그대로 부르기 위한 가벼운 로더(읽기 전용 측정용).
//  · "@/x" → 앱 폴더 기준 경로 · 확장자 없는 경로 → .ts/.tsx/index.ts · "server-only" → 빈 모듈
//  · .ts/.tsx 는 앱의 typescript 로 바로 옮긴다(형 검사 없음)
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./ts_hooks.mjs", pathToFileURL(import.meta.filename));
