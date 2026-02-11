const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../src/App.jsx');
console.log(`正在处理文件: ${targetFile}`);

let content = fs.readFileSync(targetFile, 'utf8');
let originalContent = content;

// 需要强制替换的精确映射表
// 注意：顺序很重要，长词在前
const replacements = [
    { zh: '智能分镜', en: 'Smart Storyboard' },
    { zh: '未命名分镜', en: 'Untitled Scenes' },
    { zh: '未命名项目', en: 'Untitled Project' },
    { zh: '程序拆分', en: 'Rule Split' },
    { zh: 'LLM拆分', en: 'LLM Split' },
    { zh: 'AI 拆解结果', en: 'AI Analysis Result' },
    { zh: '添加空白镜头', en: 'Add Blank Shot' },
    { zh: '服务器地址', en: 'Server Address' },
    { zh: '自动保存（新图片）', en: 'Auto Save (New Images)' },
    { zh: '保存到本地', en: 'Save to Local' },
    { zh: '点击选择或拖入视频', en: 'Click or Drag Video Here' },
    { zh: '支持 MP4/WEBM，拖拽或 Ctrl+V 不可用', en: 'Supports MP4/WEBM (Drag/Ctrl+V not supported)' },
    { zh: '点击「自动抽帧」即可生成缩略图', en: 'Click "Auto Extract" to generate thumbnails' },
    { zh: '自动抽帧', en: 'Auto Extract' },
    { zh: '图片预览', en: 'Image Preview' },
    { zh: '复制链接', en: 'Copy Link' },
    { zh: '发送到画布', en: 'Send to Canvas' },
    { zh: '发送到对话', en: 'Send to Chat' },
    { zh: '选择图片', en: 'Select Image' },
    { zh: 'AI 绘图', en: 'AI Image' },
    { zh: 'AI 视频', en: 'AI Video' },
    { zh: '全选', en: 'Select All' },
    { zh: '暂定', en: 'Pending' },
    { zh: '参数', en: 'Params' },
    { zh: '批量', en: 'Batch' },
    { zh: '导入', en: 'Import' },
    { zh: '脚本', en: 'Script' },
    { zh: '测试', en: 'Test' },
    { zh: '性能模式', en: 'Performance Mode' },
    { zh: '管线', en: 'Pipeline' },
    { zh: '并行', en: 'Parallel' },
    { zh: '清空排队', en: 'Clear Queue' },
    { zh: '终止全部', en: 'Terminate All' },
    { zh: '总生成', en: 'Total' },
    { zh: '每批', en: 'Per Batch' },
    { zh: '批次', en: 'Batches' },
    { zh: '排队', en: 'Queued' },
    { zh: '轮', en: 'Rounds' },
    { zh: '运行', en: 'Run' },
    { zh: '文→图', en: 'Text to Image' },
    { zh: '用时', en: 'Time' },
    { zh: '默认使用 history', en: 'Default use history' },

    // Model Library
    { zh: '+ 添加参数', en: '+ Add Parameter' },
    { zh: '系统调用模型ID', en: 'System Model ID' },
    { zh: '显示名（仅展示）', en: 'Display Name (Show Only)' },
    { zh: '模型ID（系统调用）', en: 'Model ID (System Call)' },
    { zh: '自定义参数', en: 'Custom Params' },
    { zh: '未设置自定义参数', en: 'No custom params set' },
    { zh: '请求模板', en: 'Request Template' },
    { zh: '请求路径', en: 'Request Path' },
    { zh: '方法', en: 'Method' },
    { zh: '请求头 (JSON)', en: 'Headers (JSON)' },
    { zh: '请求体 (JSON / Raw)', en: 'Body (JSON / Raw)' },
    { zh: '变量示例', en: 'Variable Examples' },
    { zh: '保存模板', en: 'Save Template' },
    { zh: '统一维护模型能力与限制，供应商模型可直接引用。', en: 'Unified maintenance of model capabilities and limits; vendor models can be referenced directly.' },

    // Basic Settings
    { zh: 'GLOBAL API KEY （可选，全局默认 KEY）', en: 'GLOBAL API KEY (Optional, global default)' },
    { zh: '实验室功能', en: 'Laboratory Features' },
    { zh: '保存历史资产', en: 'Save History Assets' },
    { zh: '保存项目时将历史图片/视频写入文件，体积会增大。', en: 'Save history images/videos to file when saving project (increases file size).' },
    { zh: '本地服务地址', en: 'Local Service Address' },
    { zh: '本地缓存已关闭', en: 'Local cache disabled' },
    { zh: '用于连接本地后端服务，支持大文件保存和处理。', en: 'Connects to local backend for large file saving/processing.' },
    { zh: '其他设置', en: 'Other Settings' },
    { zh: '撤销/重做步数', en: 'Undo/Redo Steps' },
    { zh: '设置可撤销的最大步数（粘贴图片、删除节点等操作）', en: 'Max undo steps (paste images, delete nodes, etc.)' },
    { zh: '即梦图生图使用本地文件', en: 'Jimeng img2img uses local files' },
    { zh: '启用后，即梦模型的图生图功能将强制使用本地文件（FormData），URL图片会自动下载转换为本地文件', en: 'Forces Jimeng img2img to use local files (FormData); URL images auto-downloaded.' },
    { zh: '启用本地缓存', en: 'Enable Local Cache' },
    { zh: '关闭后不再使用本地缓存并隐藏提示条', en: 'Hide banner and disable cache when off' },
    { zh: '启用缓存时重新下载', en: 'Re-download when caching' },
    { zh: '开启后会忽略已存在文件', en: 'Ignore existing files if enabled' },
    { zh: 'PNG 转 JPG（省空间）', en: 'Convert PNG to JPG (Save Space)' },
    { zh: 'PIL 未安装，PNG 转 JPG 不可用', en: 'PIL not installed, Convert unavailable' },
    { zh: '刷新缓存（重新下载到新路径）', en: 'Refresh Cache (Re-download to new path)' },
    { zh: '提示：设置路径后点击刷新缓存可将素材保存到新文件夹', en: 'Tip: Click Refresh Cache after changing path' },
    { zh: '全部重建历史缩略图', en: 'Rebuild All Thumbnails' },
    { zh: '本次生成', en: 'Current Session' },
    { zh: '图片保存路径', en: 'Image Save Path' },
    { zh: '浏览', en: 'Browse' },
    { zh: '视频保存路径', en: 'Video Save Path' },
    { zh: '本地缓存已连接 - 图片将优先从本地读取', en: 'Local cache connected - Images will be read from local first' },
    { zh: '本地缓存未连接', en: 'Local cache disconnected' },
    { zh: '极致模式', en: 'Ultra Mode' },
    { zh: '性能模式', en: 'Performance Mode' },
    { zh: '文→图', en: 'Text to Image' },
    { zh: '图→图', en: 'Image to Image' },
    { zh: ' · 用时 ', en: ' · Time ' },
    { zh: '自动保存 (新图片)', en: 'Auto Save (New Images)' },
    { zh: '保存到本地', en: 'Save to Local' },
    { zh: '全选', en: 'Select All' },
    { zh: '暂定', en: 'Pending' },
    { zh: 'LLM拆分', en: 'LLM Split' },
    { zh: '取消', en: 'Cancel' },
    { zh: '取消全选', en: 'Deselect All' },
    { zh: '运行', en: 'Run' },
    { zh: '更换', en: 'Change' },
    { zh: '更换视频', en: 'Change Video' },
    { zh: '局部重绘', en: 'Inpainting' },
    { zh: '或拖放图片到此处', en: 'Or drag and drop image here' },
    { zh: '或 Ctrl+V 粘贴', en: 'Or Ctrl+V to paste' },
    { zh: '取消全选', en: 'Deselect All' },
    { zh: '批量素材管理', en: 'Batch Asset Manager' },
    { zh: '批量删除', en: 'Batch Delete' },
    { zh: '清理缓存', en: 'Clear Cache' },
    { zh: '图→视', en: 'Image→Video' },
    { zh: '文→视', en: 'Text→Video' },
    { zh: '文→图', en: 'Text→Image' },
    { zh: '图→图', en: 'Image→Image' },
    { zh: '请求头（JSON）', en: 'Headers (JSON)' },
    { zh: '请求体（JSON / Raw）', en: 'Body (JSON / Raw)' },
    { zh: '变量示例', en: 'Variable Examples' },
    { zh: '全比例', en: 'All Ratios' },
    { zh: '导出包含：全局 Key、Provider 配置、模型库、所有模型配置（含 Key）', en: 'Export includes: Global Key, Provider Config, Model Library, All Model Configs (New Keys)' },
    { zh: '模型库：', en: 'Library: ' },
    { zh: '未引用', en: 'Unlinked' },
    { zh: '接口：', en: 'Provider: ' },
    { zh: '之前生成', en: 'Previous Session' },
    { zh: '提示：映射名称仅用于显示，真实调用使用的是模型ID；若为空列表则使用默认限制。', en: 'Tip: Mapping prompt name is for display only, Model ID is for actual call; empty list uses default limits.' },
    { zh: '暂无分镜，请添加或同步分析结果', en: 'No shots yet, please add or sync analysis results' },
    { zh: '已选中', en: 'Selected' },
    { zh: '项', en: 'items' },
    { zh: '请求体类型', en: 'Body Type' },
    { zh: '重选', en: 'Reselect' },
    { zh: '等待', en: 'Waiting' },
    { zh: '已就绪', en: 'Ready' }
];

let totalReplacements = 0;

replacements.forEach(({ zh, en }) => {
    // 1. 替换属性值: attribute="中文" -> attribute={t('中文')}
    // 允许的属性名: title, label, name, placeholder, content, value, projectTitle, header 等
    // 也要支持无属性名的情况（作为 JSX 文本）

    // 1.1 JSX 文本: >中文< -> >{t('中文')}< 
    // 使用正则时注意转义
    const escapedZh = zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // JSX Text
    const jsxRegex = new RegExp(`>(\\s*)${escapedZh}(\\s*)<`, 'g');
    content = content.replace(jsxRegex, (match, before, after) => {
        // 只有当不已经被 {t(...)} 包裹时才替换
        // 但正则只匹配 >中文<，所以应该安全
        totalReplacements++;
        return `>${before}{t('${zh}')}${after}<`;
    });

    // 1.2 属性值: property="中文" -> property={t('中文')}
    // 这里我们放宽属性名限制，匹配任何看起来像属性的东西
    const attrRegex = new RegExp(`([a-zA-Z0-9_]+)="(${escapedZh})"`, 'g');
    content = content.replace(attrRegex, (match, attr, val) => {
        // 排除已经在这个脚本里被替换过的（虽然 replace 是同步的，应该不会重叠）
        // 排除特定的非 UI 属性？一般中文不太会出现在非 UI 属性里（除了 id 可能？）
        totalReplacements++;
        return `${attr}={t('${zh}')}`;
    });

    // 1.3 对象字面量: key: "中文" -> key: t('中文')
    // 针对 projectTitle: 'AI 拆解结果' 这种
    // 我们需要小心不要替换 import 或其他常量定义，但在 const x = { a: "中文" } 里通常是安全的
    // 限制 key 的名字以增强安全性
    const objRegex = new RegExp(`(title|label|name|desc|description|header|tooltip|text|content|placeholder|value|projectTitle)\\s*:\\s*['"]${escapedZh}['"]`, 'g');
    content = content.replace(objRegex, (match, key) => {
        totalReplacements++;
        return `${key}: t('${zh}')`;
    });
});

if (content !== originalContent) {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log(`✅ 成功替换了 ${totalReplacements} 处遗漏的中文。`);
} else {
    console.log('⚠️ 没有发现需要替换的内容。');
}
