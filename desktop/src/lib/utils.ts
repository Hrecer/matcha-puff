/**
 * shadcn/ui 的 className 合并工具。
 *
 * 【为什么直接转发 `cn` 包】
 * 新版 shadcn 组件（button/card/dialog… 共 16 个）已经从 `cn` 包 import，而不是从本文件。
 * `cn` 是 shadcn 官方发布的包（由 shadcn 维护，描述为
 * "Drop-in replacement for clsx + tailwind-merge"）。
 * 为了**只保留一套合并实现**（两套实现可能对同一批类名给出不同结果），
 * 这里直接转发它，而不是自己再写 clsx + tailwind-merge。
 *
 * 业务代码统一用 `@/lib/utils` 的 cn，替换实现只改这一处。
 * 注意：`shadcn add` 拉新组件时仍会从 `cn` import —— 转发到同一个包，行为一致，不必改。
 */
export { cn } from 'cn'
