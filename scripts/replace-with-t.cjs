/**
 * 批量替换脚本 - 将中文文本替换为 t() 函数调用
 * 
 * 功能：
 * 1. 读取翻译 JSON 文件，获取所有已翻译的 Key
 * 2. 在源代码中查找这些中文文本
 * 3. 替换为 t('中文文本') 格式
 * 
 * 使用方法：
 * node scripts/replace-with-t.js [inputFile] [translationFile] [--dry-run]
 * 
 * 参数：
 * --dry-run   仅预览替换，不实际修改文件
 * --backup    替换前创建备份
 * 
 * 示例：
 * node scripts/replace-with-t.js src/App.jsx src/i18n/locales/en.json --dry-run
 * node scripts/replace-with-t.js src/App.jsx src/i18n/locales/en.json --backup
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    // 需要排除的模式（不替换）
    excludePatterns: [
        /console\.(log|warn|error|info|debug)\s*\(/,  // console 语句
        /^\s*\/\//,                                    // 注释行
        /^\s*\*/,                                      // JSDoc 注释
        /^\s*\/\*/,                                    // 多行注释开始
        /className\s*=/,                               // className (保留)
        /data-[\w-]+\s*=/,                             // data-* 属性
        /aria-[\w-]+\s*=/,                             // aria-* 属性
        /^\s*import\s+/,                               // import 语句
        /^\s*export\s+/,                               // export 语句
    ],

    // 已经被 t() 包裹的不再替换
    alreadyWrappedPattern: /t\s*\(\s*['"`]/
};

/**
 * 检查行是否应该被排除
 */
function shouldExcludeLine(line) {
    return CONFIG.excludePatterns.some(pattern => pattern.test(line));
}

/**
 * 检查文本是否已经被 t() 包裹
 */
function isAlreadyWrapped(lineContent, matchIndex) {
    // 检查匹配位置前面是否有 t( 模式
    const before = lineContent.substring(Math.max(0, matchIndex - 10), matchIndex);
    return /t\s*\(\s*['"`]$/.test(before);
}

/**
 * 转义正则特殊字符
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 替换策略
 */
const REPLACEMENT_STRATEGIES = [
    // 策略 1: JSX 文本内容 >中文< -> >{t('中文')}<
    {
        name: 'jsx-text',
        createPattern: (text) => new RegExp(`>\\s*(${escapeRegex(text)})\\s*<`, 'g'),
        replace: (match, text) => `>{t('${text.replace(/'/g, "\\'")}')}<`
    },

    // 策略 2: 字符串属性 title="中文" -> title={t('中文')}
    {
        name: 'string-attribute',
        createPattern: (text) => new RegExp(`(\\w+)\\s*=\\s*["'](${escapeRegex(text)})["']`, 'g'),
        replace: (match, attr, text) => `${attr}={t('${text.replace(/'/g, "\\'")}')}`
    },

    // 策略 3: JSX 表达式 {'中文'} -> {t('中文')}
    {
        name: 'jsx-expression-single',
        createPattern: (text) => new RegExp(`\\{\\s*'(${escapeRegex(text)})'\\s*\\}`, 'g'),
        replace: (match, text) => `{t('${text.replace(/'/g, "\\'")}')}`,
    },

    // 策略 4: JSX 表达式 {"中文"} -> {t('中文')}
    {
        name: 'jsx-expression-double',
        createPattern: (text) => new RegExp(`\\{\\s*"(${escapeRegex(text)})"\\s*\\}`, 'g'),
        replace: (match, text) => `{t('${text.replace(/'/g, "\\'")}')}`
    },

    // 策略 5: 单引号字符串 '中文' -> t('中文')
    // 注意：只在特定上下文中替换，避免破坏对象属性
    {
        name: 'single-quote-string',
        createPattern: (text) => new RegExp(`(?<!\\w)\\s*'(${escapeRegex(text)})'(?!\\s*:)`, 'g'),
        replace: (match, text) => ` t('${text.replace(/'/g, "\\'")}')`,
        skipIfBefore: [/:\s*$/, /\w$/],  // 跳过对象属性值、变量名后
    },

    // 策略 6: 双引号字符串 "中文" -> t('中文')
    {
        name: 'double-quote-string',
        createPattern: (text) => new RegExp(`(?<!\\w)\\s*"(${escapeRegex(text)})"(?!\\s*:)`, 'g'),
        replace: (match, text) => ` t('${text.replace(/'/g, "\\'")}')`,
        skipIfBefore: [/:\s*$/, /\w$/],
    }
];

/**
 * 处理单个文件
 */
function processFile(inputFile, translations, options) {
    const { dryRun, backup } = options;

    console.log(`\n📂 处理文件: ${inputFile}`);

    const content = fs.readFileSync(inputFile, 'utf-8');
    const lines = content.split('\n');

    const replacements = [];
    let modifiedContent = content;

    // 对每个翻译 Key 进行替换
    const keys = Object.keys(translations).filter(k => !k.startsWith('_')); // 排除元数据字段

    console.log(`   找到 ${keys.length} 个翻译 Key`);

    keys.forEach(text => {
        REPLACEMENT_STRATEGIES.forEach(strategy => {
            const pattern = strategy.createPattern(text);
            let match;

            while ((match = pattern.exec(modifiedContent)) !== null) {
                const lineIndex = modifiedContent.substring(0, match.index).split('\n').length - 1;
                const line = lines[lineIndex] || '';

                // 检查排除条件
                if (shouldExcludeLine(line)) continue;
                if (isAlreadyWrapped(modifiedContent, match.index)) continue;

                replacements.push({
                    original: match[0],
                    replacement: match[0].replace(pattern, strategy.replace),
                    line: lineIndex + 1,
                    strategy: strategy.name,
                    text
                });
            }
        });
    });

    // 去重并应用替换
    const uniqueReplacements = [];
    const seen = new Set();

    replacements.forEach(r => {
        const key = `${r.original}|${r.line}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueReplacements.push(r);
        }
    });

    console.log(`   发现 ${uniqueReplacements.length} 处可替换`);

    if (uniqueReplacements.length === 0) {
        console.log('   ⚠️ 没有找到可替换的内容');
        return { replacements: [], modified: false };
    }

    // 按策略分组显示
    const byStrategy = {};
    uniqueReplacements.forEach(r => {
        if (!byStrategy[r.strategy]) byStrategy[r.strategy] = [];
        byStrategy[r.strategy].push(r);
    });

    console.log('\n   📊 替换统计:');
    Object.entries(byStrategy).forEach(([strategy, items]) => {
        console.log(`      - ${strategy}: ${items.length} 处`);
    });

    if (dryRun) {
        console.log('\n   🔍 预览模式 (前 20 条):');
        uniqueReplacements.slice(0, 20).forEach((r, i) => {
            console.log(`      ${i + 1}. [L${r.line}] "${r.original}" -> "${r.replacement}"`);
        });
        if (uniqueReplacements.length > 20) {
            console.log(`      ... 以及其他 ${uniqueReplacements.length - 20} 条`);
        }
        return { replacements: uniqueReplacements, modified: false };
    }

    // 创建备份
    if (backup) {
        const backupPath = inputFile + '.backup.' + Date.now();
        fs.writeFileSync(backupPath, content, 'utf-8');
        console.log(`   📦 备份已创建: ${backupPath}`);
    }

    // 应用替换 (从后向前，避免位置偏移)
    uniqueReplacements
        .sort((a, b) => b.line - a.line)
        .forEach(r => {
            modifiedContent = modifiedContent.replace(r.original, r.replacement);
        });

    // 写入文件
    fs.writeFileSync(inputFile, modifiedContent, 'utf-8');
    console.log(`   ✅ 文件已更新`);

    return { replacements: uniqueReplacements, modified: true };
}

/**
 * 主函数
 */
function main() {
    const args = process.argv.slice(2);

    // 解析参数
    const dryRun = args.includes('--dry-run');
    const backup = args.includes('--backup');
    const inputFile = args.find(a => !a.startsWith('--') && a.endsWith('.jsx')) || 'src/App.jsx';
    const translationFile = args.find(a => !a.startsWith('--') && a.endsWith('.json')) || 'src/i18n/locales/en.json';

    console.log('🔄 中文文案批量替换工具');
    console.log('========================');
    console.log(`📂 源文件: ${inputFile}`);
    console.log(`📂 翻译文件: ${translationFile}`);
    console.log(`🔧 模式: ${dryRun ? '预览 (dry-run)' : '实际替换'}`);
    console.log(`🔧 备份: ${backup ? '是' : '否'}`);

    // 读取翻译文件
    const translationPath = path.resolve(translationFile);
    if (!fs.existsSync(translationPath)) {
        console.error(`\n❌ 翻译文件不存在: ${translationPath}`);
        console.log('请先运行 extract-chinese.js 生成翻译模板');
        process.exit(1);
    }

    let translations;
    try {
        translations = JSON.parse(fs.readFileSync(translationPath, 'utf-8'));
    } catch (e) {
        console.error(`\n❌ 翻译文件解析失败: ${e.message}`);
        process.exit(1);
    }

    // 处理文件
    const result = processFile(path.resolve(inputFile), translations, { dryRun, backup });

    console.log('\n✨ 完成！');

    if (dryRun) {
        console.log('\n💡 提示: 这是预览模式，没有实际修改文件。');
        console.log('   移除 --dry-run 参数可进行实际替换。');
        console.log('   建议添加 --backup 参数在替换前创建备份。');
    }
}

main();
