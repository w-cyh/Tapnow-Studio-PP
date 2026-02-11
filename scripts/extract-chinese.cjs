/**
 * 中文文案提取脚本
 * 
 * 功能：
 * 1. 扫描 JSX 文件中的中文文本
 * 2. 生成翻译文件模板 (en.json)
 * 3. 生成待翻译列表
 * 
 * 使用方法：
 * node scripts/extract-chinese.js [inputFile] [outputDir]
 * 
 * 示例：
 * node scripts/extract-chinese.js src/App.jsx src/i18n/locales
 */

const fs = require('fs');
const path = require('path');

// 中文字符检测正则
const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

// 需要忽略的模式
const IGNORE_PATTERNS = [
    /console\.(log|warn|error|info|debug)/,  // console 语句
    /\/\/.*$/,                                 // 单行注释
    /\/\*[\s\S]*?\*\//,                       // 多行注释
    /^\s*\*.*$/,                              // JSDoc 注释行
    /className=/,                             // className 属性（可能包含中文描述）
    /data-testid=/,                           // 测试 ID
];

// 提取结果
const extractedTexts = new Map(); // 使用 Map 去重

/**
 * 检查字符串是否包含中文
 */
function containsChinese(str) {
    return CHINESE_REGEX.test(str);
}

/**
 * 清理提取的文本
 */
function cleanText(text) {
    return text
        .trim()
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 判断是否应该忽略此行
 */
function shouldIgnoreLine(line) {
    return IGNORE_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * 从 JSX 提取中文文本
 * 支持的模式：
 * 1. JSX 文本内容: >中文文本<
 * 2. 字符串属性: title="中文"
 * 3. 模板字符串: `包含中文的${变量}模板`
 * 4. 普通字符串: '中文字符串' 或 "中文字符串"
 */
function extractFromContent(content, filename) {
    const lines = content.split('\n');
    const results = [];

    lines.forEach((line, lineIndex) => {
        const lineNum = lineIndex + 1;

        // 跳过应该忽略的行
        if (shouldIgnoreLine(line)) {
            return;
        }

        // 提取模式
        const patterns = [
            // 1. JSX 文本内容 (完整标签间): >文本<
            {
                regex: />([^<>]*[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][^<>]*)</g,
                type: 'jsx-text',
                group: 1
            },
            // 2. 字符串属性值 (双引号): ="中文"
            {
                regex: /=["']([^"']*[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][^"']*)["']/g,
                type: 'attribute',
                group: 1
            },
            // 3. JSX 表达式中的字符串: {'中文'} 或 {"中文"}
            {
                regex: /\{["']([^"'{}]*[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][^"'{}]*)["']\}/g,
                type: 'jsx-expression',
                group: 1
            },
            // 4. 普通字符串变量: const x = '中文'
            {
                regex: /(?:const|let|var|return)\s+[^=]*=\s*["']([^"']*[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][^"']*)["']/g,
                type: 'variable',
                group: 1
            },
            // 5. 对象属性值: { key: '中文' }
            {
                regex: /:\s*["']([^"':,{}]*[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][^"':,{}]*)["']/g,
                type: 'object-value',
                group: 1
            },
            // 6. 数组元素: ['中文', ...]
            {
                regex: /\[["']([^"'\[\]]*[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][^"'\[\]]*)["']/g,
                type: 'array-element',
                group: 1
            },
            // 7. 函数参数: func('中文')
            {
                regex: /\(["']([^"'()]*[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][^"'()]*)["']/g,
                type: 'function-arg',
                group: 1
            },
            // 8. 三元表达式: ? '中文' : 或 : '中文'
            {
                regex: /[?:]\s*["']([^"'?:]*[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][^"'?:]*)["']/g,
                type: 'ternary',
                group: 1
            }
        ];

        patterns.forEach(({ regex, type, group }) => {
            let match;
            // 重置正则状态
            regex.lastIndex = 0;

            while ((match = regex.exec(line)) !== null) {
                const text = cleanText(match[group]);

                // 过滤条件
                if (!text || text.length < 2) continue;  // 太短的跳过
                if (!containsChinese(text)) continue;    // 必须包含中文
                if (text.includes('console.')) continue; // 跳过 console
                if (/^[0-9\s\.,，。！？!?]+$/.test(text)) continue; // 纯数字/标点

                if (!extractedTexts.has(text)) {
                    extractedTexts.set(text, {
                        text,
                        type,
                        occurrences: [{
                            file: filename,
                            line: lineNum,
                            context: line.trim().substring(0, 100)
                        }]
                    });
                } else {
                    extractedTexts.get(text).occurrences.push({
                        file: filename,
                        line: lineNum,
                        context: line.trim().substring(0, 100)
                    });
                }
            }
        });
    });

    return results;
}

/**
 * 生成翻译 JSON 文件
 */
function generateTranslationJSON() {
    const translations = {};

    // 按首字母/类型排序
    const sortedKeys = Array.from(extractedTexts.keys()).sort();

    sortedKeys.forEach(key => {
        translations[key] = ''; // 待翻译，值为空
    });

    return translations;
}

/**
 * 生成详细的翻译列表 (Markdown 格式)
 */
function generateTranslationList() {
    const lines = [
        '# 待翻译文案列表',
        '',
        `> 生成时间: ${new Date().toISOString()}`,
        `> 总计: ${extractedTexts.size} 条`,
        '',
        '---',
        ''
    ];

    // 按类型分组
    const byType = {};
    extractedTexts.forEach((info, text) => {
        const type = info.type;
        if (!byType[type]) byType[type] = [];
        byType[type].push({ text, ...info });
    });

    Object.entries(byType).forEach(([type, items]) => {
        lines.push(`## ${type} (${items.length} 条)`);
        lines.push('');
        lines.push('| 中文原文 | 出现次数 | 示例位置 |');
        lines.push('|----------|----------|----------|');

        items.forEach(item => {
            const escapedText = item.text.replace(/\|/g, '\\|').replace(/\n/g, '↵');
            const firstOccurrence = item.occurrences[0];
            lines.push(`| ${escapedText} | ${item.occurrences.length} | ${firstOccurrence.file}:${firstOccurrence.line} |`);
        });

        lines.push('');
    });

    return lines.join('\n');
}

/**
 * 主函数
 */
function main() {
    const args = process.argv.slice(2);
    const inputFile = args[0] || 'src/App.jsx';
    const outputDir = args[1] || 'src/i18n/locales';

    console.log('🔍 中文文案提取工具');
    console.log('==================');
    console.log(`📂 输入文件: ${inputFile}`);
    console.log(`📂 输出目录: ${outputDir}`);
    console.log('');

    // 读取文件
    const inputPath = path.resolve(inputFile);
    if (!fs.existsSync(inputPath)) {
        console.error(`❌ 文件不存在: ${inputPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(inputPath, 'utf-8');
    console.log(`📄 文件大小: ${(content.length / 1024).toFixed(2)} KB`);
    console.log(`📄 总行数: ${content.split('\n').length}`);
    console.log('');

    // 提取中文
    console.log('⏳ 正在提取中文文案...');
    extractFromContent(content, path.basename(inputFile));
    console.log(`✅ 提取完成，共发现 ${extractedTexts.size} 条不重复的中文文案`);
    console.log('');

    // 创建输出目录
    const outputPath = path.resolve(outputDir);
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }

    // 生成翻译 JSON
    const translations = generateTranslationJSON();
    const jsonPath = path.join(outputPath, 'en.extracted.json');
    fs.writeFileSync(jsonPath, JSON.stringify(translations, null, 2), 'utf-8');
    console.log(`📝 翻译模板已保存: ${jsonPath}`);

    // 生成翻译列表
    const list = generateTranslationList();
    const listPath = path.join(outputPath, 'translation-list.md');
    fs.writeFileSync(listPath, list, 'utf-8');
    console.log(`📝 翻译列表已保存: ${listPath}`);

    // 输出统计
    console.log('');
    console.log('📊 统计信息:');
    const byType = {};
    extractedTexts.forEach((info) => {
        byType[info.type] = (byType[info.type] || 0) + 1;
    });
    Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count} 条`);
    });

    console.log('');
    console.log('✨ 提取完成！');
    console.log('');
    console.log('下一步:');
    console.log('1. 查看 translation-list.md 了解所有待翻译文案');
    console.log('2. 编辑 en.extracted.json 填写翻译');
    console.log('3. 运行 replace-with-t.js 批量替换代码');
}

main();
