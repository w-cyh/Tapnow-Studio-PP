const fs = require('fs');
const path = require('path');

// 配置
const SRC_DIR = path.resolve(__dirname, '../src');
const EN_JSON_PATH = path.resolve(__dirname, '../src/i18n/locales/en.json');
const IGNORE_FILES = ['i18n', 'assets', '.test.', '.spec.'];

// 颜色输出
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m"
};

function main() {
    console.log(`${colors.cyan}🔍 开始扫描国际化问题...${colors.reset}\n`);

    // 1. 加载现有的英文翻译
    let enTranslations = {};
    if (fs.existsSync(EN_JSON_PATH)) {
        try {
            enTranslations = JSON.parse(fs.readFileSync(EN_JSON_PATH, 'utf-8'));
        } catch (e) {
            console.error(`${colors.red}❌ 无法读取 en.json: ${e.message}${colors.reset}`);
            return;
        }
    } else {
        console.warn(`${colors.yellow}⚠️ 未找到 en.json，将跳过缺失翻译检查。${colors.reset}`);
    }

    // 2. 扫描所有源文件
    const files = getAllFiles(SRC_DIR, ['.js', '.jsx', '.ts', '.tsx']);

    let hardcodedChineseCount = 0;
    let missingTranslationCount = 0;
    let checkedFiles = 0;

    files.forEach(file => {
        // 忽略即特定目录
        if (IGNORE_FILES.some(ignore => file.includes(ignore))) return;

        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(path.join(__dirname, '..'), file);
        checkedFiles++;

        // A. 检查硬编码中文 (未被 t() 包裹)
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
            if (trimmed.includes('console.log') || trimmed.includes('console.error')) return;

            // 匹配中文字符：\u4e00-\u9fa5
            const chineseRegex = /[\u4e00-\u9fa5]+/g;
            const matches = line.match(chineseRegex);

            if (matches) {
                matches.forEach(match => {
                    // 简单检查：如果在该行中，这个中文字符串周围没有 t( 和 )
                    if (line.includes(`t('${match}`) || line.includes(`t("${match}`) || line.includes(`t(\`${match}`)) {
                        return;
                    }
                    // 对于复杂情况（如变量拼接），这里只做基础告警

                    console.log(`${colors.yellow}⚠️  [硬编码中文] ${relativePath}:${index + 1}${colors.reset}`);
                    console.log(`   ${line.trim()}`);
                    console.log(`   ${colors.gray}疑似: "${match}"${colors.reset}\n`);
                    hardcodedChineseCount++;
                });
            }
        });

        // B. 检查缺失的翻译 Key (在 t() 中但不在 en.json 中)
        const tCallRegex = /[^a-zA-Z0-9]t\(['"`](.*?)['"`]\)/g;
        let match;
        while ((match = tCallRegex.exec(content)) !== null) {
            const key = match[1];
            if (key.includes('${') || key.includes('{{')) continue;

            // 检查中文 Key 是否有翻译
            const hasChinese = /[\u4e00-\u9fa5]/.test(key);

            if (hasChinese && !enTranslations[key]) {
                console.log(`${colors.red}❌ [缺失翻译] ${relativePath}${colors.reset}`);
                console.log(`   Key: "${key}"`);
                missingTranslationCount++;
            }
        }
    });

    console.log(`${colors.cyan}--- 扫描结果 ---${colors.reset}`);
    console.log(`已检查文件数: ${checkedFiles}`);
    console.log(`发现疑似硬编码中文: ${hardcodedChineseCount} 处`);
    console.log(`发现缺失翻译条目: ${missingTranslationCount} 个`);

    if (hardcodedChineseCount === 0 && missingTranslationCount === 0) {
        console.log(`${colors.green}✅ 完美！代码中看起来非常干净。${colors.reset}`);
    } else {
        console.log(`${colors.yellow}⚠️  请根据上述日志修复问题。${colors.reset}`);
    }
}

function getAllFiles(dirPath, extensions) {
    let files = [];
    try {
        const list = fs.readdirSync(dirPath);
        list.forEach(file => {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                files = files.concat(getAllFiles(filePath, extensions));
            } else {
                if (extensions.some(ext => file.endsWith(ext))) {
                    files.push(filePath);
                }
            }
        });
    } catch (e) {
        console.error(`Error scanning dir ${dirPath}:`, e);
    }
    return files;
}

main();
