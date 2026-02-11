/**
 * i18n 翻译文件去重与规范化工具
 */

const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/i18n/locales/en.json');

console.log('🧹 正在清理翻译文件...');

try {
    // 读取文件内容
    let content = fs.readFileSync(filePath, 'utf-8');

    // 如果文件格式损坏（比如多个 { 或 }），先尝试简单修复
    content = content.trim();
    if (!content.startsWith('{')) content = '{' + content;
    if (!content.endsWith('}')) content = content + '}';

    /**
     * 由于 JSON.parse 会自动处理重复键（保留最后一个），
     * 我们通过这种方式自然去重。
     * 但为了保险，我们先用正则简单处理可能的语法错误
     */
    let data;
    try {
        data = JSON.parse(content);
    } catch (e) {
        console.error('❌ JSON 语法错误，尝试强制修复...', e.message);
        // 激进修复：移除所有可能的重复结构，重新包装
        // 这里采用一种安全的方式：逐行读取，手动构建对象
        data = {};
        const lines = content.split('\n');
        lines.forEach(line => {
            const match = line.match(/"(.*?)":\s*"(.*?)"/);
            if (match) {
                data[match[1]] = match[2];
            }
        });
    }

    // 排除元数据和特殊键
    const meta = {};
    const translations = {};

    Object.keys(data).forEach(key => {
        if (key.startsWith('_')) {
            meta[key] = data[key];
        } else {
            translations[key] = data[key];
        }
    });

    // 排序：按字母顺序排序，方便人类阅读和 Git 追踪
    const sortedKeys = Object.keys(translations).sort();
    const sortedTranslations = {};

    sortedKeys.forEach(key => {
        sortedTranslations[key] = translations[key];
    });

    // 合并并重新写入
    const finalData = {
        ...meta,
        ...sortedTranslations
    };

    fs.writeFileSync(filePath, JSON.stringify(finalData, null, 4), 'utf-8');

    console.log(`✅ 清理完成！`);
    console.log(`📊 当前总计条目: ${Object.keys(finalData).length}`);
} catch (err) {
    console.error('❌ 处理失败:', err);
}
