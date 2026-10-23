/** Thay `{khoá}` bằng giá trị trong `values`; ném lỗi nếu thiếu (để chữ người chơi không lộ placeholder). */
export const fillTemplate = (text: string, values: Readonly<Record<string, unknown>>): string =>
  text.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = values[key];
    if (v === undefined) throw new Error(`Missing template value "${key}" in "${text}"`);
    return String(v);
  });
