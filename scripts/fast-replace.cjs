/**
 * 自动批量替换工具 V3 - 增强版
 * 功能：处理更多代码模式，包括对象属性、数组、三元表达式等
 */

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2] || 'src/App.jsx';
const translationFile = process.argv[3] || 'src/i18n/locales/en.json';
const dryRun = process.argv.includes('--dry-run');
const backup = process.argv.includes('--backup');

console.log('🚀 自动批量替换工具 V3');
console.log('======================');
console.log(`📂 源文件: ${inputFile}`);
console.log(`📂 翻译文件: ${translationFile}`);
console.log(`🔧 模式: ${dryRun ? '预览' : '实际替换'}`);
console.log('');

const translations = JSON.parse(fs.readFileSync(translationFile, 'utf-8'));
const keys = Object.keys(translations)
    .filter(k => !k.startsWith('_'))
    .sort((a, b) => b.length - a.length);

let content = fs.readFileSync(inputFile, 'utf-8');
const originalContent = content;

let replacedTotal = 0;
const summary = {};

keys.forEach(text => {
    if (text.length < 2) return;

    let count = 0;
    const escapedText = escapeRegex(text);

    // 模式 1: JSX 文本 >中文<
    const jsxPattern = new RegExp(`>(\\s*)${escapedText}(\\s*)<`, 'g');
    if (jsxPattern.test(content)) {
        content = content.replace(jsxPattern, (match, before, after) => {
            count++;
            return `>${before}{t('${text}')}${after}<`;
        });
    }

    // 模式 2: 常见 JSX 属性 title="中文"
    const attrPattern = new RegExp(`(title|placeholder|alt|label|name|message)="(${escapedText})"`, 'g');
    if (attrPattern.test(content)) {
        content = content.replace(attrPattern, (match, attr, txt) => {
            count++;
            return `${attr}={t('${text}')}`;
        });
    }

    // 模式 3: 对象属性或变量赋值 label: "中文" 或 const x = "中文"
    // 限定在常见的 UI 词汇关键词后面，避免误伤
    const objPattern = new RegExp(`(label|name|text|title|desc|message|value|content|placeholder)\\s*:\\s*['"]${escapedText}['"]`, 'g');
    if (objPattern.test(content)) {
        content = content.replace(objPattern, (match, key) => {
            count++;
            return `${key}: t('${text}')`;
        });
    }

    // 模式 4: 函数调用 showToast("中文")
    const funcPattern = new RegExp(`(showToast|alert|confirm|message\\.\\w+)\\(\\s*['"]${escapedText}['"]\\s*\\)`, 'g');
    if (funcPattern.test(content)) {
        content = content.replace(funcPattern, (match, func) => {
            count++;
            return `${func}(t('${text}'))`;
        });
    }

    // 模式 5: 简单的 React 表达式中的字符串 {'中文'}
    const exprPattern = new RegExp(`\\{\\s*['"]${escapedText}['"]\\s*\\}`, 'g');
    if (exprPattern.test(content)) {
        content = content.replace(exprPattern, () => {
            count++;
            return `{t('${text}')}`;
        });
    }

    if (count > 0) {
        summary[text] = count;
        replacedTotal += count;
    }
});

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log(`✅ 扫描完成，共找到 ${replacedTotal} 处可替换位置`);

if (replacedTotal > 0) {
    if (!dryRun) {
        if (backup) {
            fs.writeFileSync(inputFile + '.backup.' + Date.now(), originalContent, 'utf-8');
        }
        fs.writeFileSync(inputFile, content, 'utf-8');
        console.log('✅ 文件已更新！');
    } else {
        console.log('💡 预览模式，未修改文件');
    }
}

console.log('✨ 完成！');
