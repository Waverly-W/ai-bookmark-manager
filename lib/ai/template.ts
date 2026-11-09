/**
 * 一次性替换 `{name}` 占位符。
 *
 * 用替换函数而不是替换字符串，避免值里的 `$&`、`$'` 等被 String.prototype.replace
 * 当成特殊模式；单次扫描也保证替换进去的值（例如标题里恰好含有 `{title}`）不会被二次替换。
 * 未提供的占位符原样保留。
 */
export const fillTemplate = (template: string, values: Record<string, string>): string =>
    template.replace(/\{(\w+)\}/g, (match, key: string) =>
        Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
    );
