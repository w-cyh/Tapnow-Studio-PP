# 模型配置说明书（Model Template README）

> 用途：统一说明「模型库 / 请求模板 / 异步任务 / input 参数」的使用方法。

---

## 1. 基础概念

- **Provider**：供应商（如 BizyAir / ModelScope / SiliconFlow）。
- **模型 ID（系统调用）**：真实调用的 `model` / `modelId`。
- **显示名（仅展示）**：UI 展示用名称。
- **接口类型**：OpenAI / Gemini / ModelScope。
- **模型类型**：Chat / Image / ChatImage / Video。

> ChatImage：可在 Chat 面板与 Image 生成中双向使用。

---

## 2. 自定义参数 + input 规则

### 2.1 自定义参数
- 每个模型库条目可以添加 **自定义参数**。
- 参数值会注入到请求模板的 `{{paramName}}` 变量。

### 2.2 input 输入框规则
- **参数名或参数值**包含 `input / 输入` 即可触发前端输入框。
- 示例参数名：
  - `bizyairSteps_input`
  - `modelscopeImageCount_input`

### 2.3 多图输入变量
当节点前置有多张输入图时，可使用以下变量：
- `{{imageUrl1}}` / `{{imageUrl2}}` / `{{imageUrl3}}` / `{{imageUrl4}}`
- `{{imageUrls.0}}` / `{{imageUrls.1}}`（数组索引）

> BizyAir 工作流字段示例：
> `"431:LoadImage.image": "{{imageUrl1}}"`
> `"430:LoadImage.image": "{{imageUrl2}}"`

---

## 3. 请求模板（Request Template）

### 3.1 最常用变量
- `{{modelName}}` 模型 ID
- `{{prompt}}` 提示词
- `{{ratio}}` 比例
- `{{size}}` / `{{resolution}}`
- `{{duration}}` / `{{duration:number}}`
- `{{seed}}`
- `{{imageUrl}}` / `{{imageUrls}}`
- `{{imageBlob}}` / `{{imageDataUrl}}`（用于 multipart 或 raw）

### 3.2 BizyAir 应用（AI App）示例
```json
{
  "web_app_id": {{bizyairWebAppId:number}},
  "suppress_preview_output": false,
  "input_values": {
    "45:JjkText.text": "{{prompt}}",
    "4:KSampler.steps": {{bizyairSteps:number}},
    "36:EmptySD3LatentImage.width": {{bizyairWidth:number}},
    "36:EmptySD3LatentImage.height": {{bizyairHeight:number}}
  }
}
```

### 3.3 BizyAir 工作流（Workflow）示例
```json
{
  "web_app_id": {{bizyairWebAppId:number}},
  "suppress_preview_output": false,
  "input_values": {
    "431:LoadImage.image": "{{imageUrl1}}",
    "430:LoadImage.image": "{{imageUrl2}}",
    "587:BizyAir_NanoBananaPro.prompt": "{{prompt}}",
    "587:BizyAir_NanoBananaPro.aspect_ratio": "{{ratio}}",
    "587:BizyAir_NanoBananaPro.resolution": "{{size}}"
  }
}
```

> 参考：`docs/api/模型库测试方法.md`、`docs/api/bizyair_implementation_plan.md`

---

## 4. 异步任务（Async Config）

### 4.1 基础流程
- create 请求 -> 返回 requestId
- status 请求 -> 判断状态
- outputs 请求 -> 返回图片数组

### 4.2 通用字段建议
- `statusPath`: 返回状态字段路径
- `successValues`: 成功状态枚举
- `failureValues`: 失败状态枚举
- `outputsPath`: 输出数组路径
- `outputsUrlField`: url 字段名

### 4.3 BizyAir 推荐模板
- create: `/w/v1/webapp/task/openapi/create`
- status: `/w/v1/webapp/task/openapi/query`
- outputs: `/w/v1/webapp/task/openapi/result`

### 4.4 Provider 异步开关 vs asyncConfig
- **Provider 异步开关（forceAsync）**：仅影响内置接口分支（如 ModelScope / Z-Image），会自动加 `?async=true` 或走固定异步流程。
- **模型库 asyncConfig**：用于“请求模板”提交后自定义轮询（create → status → outputs），适配 BizyAir / RunningHub / 本地 ComfyUI 等。

> 结论：**自定义模板与第三方异步任务必须用 asyncConfig**；Provider 异步仅是内置分支的加速开关。

---

## 5. 多图并发建议
- **优先用 Batch 并发**（最稳定、通用）。
- API 多图仅在上游支持时启用：
  - `n / num_images / batch_size`

> 详见：`docs/improve/multi_image_concurrency_plan.md`

---

## 6. Comfy 接入规划
- 本地 ComfyUI：通过 Local Middleware（BizyAir 风格）
- RunningHub：与本地模式结构接近，可复用 asyncConfig

> 详见：`docs/api/local comfyui codex improve.md`
