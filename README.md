# light-tarot

从旧页面行为重新实现的塔罗阅读应用。保留原牌图、纸纹植物背景和页面顺序，不使用旧项目品牌。包含 78 张经确认可沿用的原图，无需从旧站加载资源。

## Windows 本地启动

1. 将源码 ZIP 解压。把其中的项目文件夹放到 `D:\workspace\tarot`，或者保留它为 `D:\workspace\tarot\light-tarot` 子文件夹。
2. 安装 Node.js 22 或更新版本。打开 PowerShell，在包含 `package.json` 的目录运行：

   ```powershell
   npm start
   ```

3. 打开 http://127.0.0.1:3000/ 。不要直接双击 `public\index.html`（它使用独立模块）。如只想免安装试用，请使用单独交付的 `light-tarot-preview.html`，该文件内嵌全部牌图且不联网。Chrome/Edge 对 file:// 文件的历史保存隔离以各自实现为准。

不需要 `npm install`。可执行 `npm test`；可运行 `node scripts/standalone.mjs light-tarot-preview.html` 重新生成独立离线页。

## 解读、历史和分享

- 默认是离线试读，免账号、零请求到旧站。按测试确认的牌阵结构抽牌，原图可正逆位呈现；离线正文按本轮牌位和牌义组合，页面会标明不是 AI 生成。未找回旧站的模型或内部算法。
- 旧问题仅保存在当前浏览器（最多 50 次），无账号和多设备同步；不导入旧站历史。可以回看同一次抽牌，或在确认后删除本地记录。
- 存长图分享先打开预览，可保存 PNG。原生转发取决于浏览器是否支持分享文件；不支持时可手动转发下载文件。预览图包含本轮问题和解读，转发前请检查。

## 可选：部署成在线解读

在服务端配置兼容 Chat Completions 的完整 HTTPS 请求地址、令牌和模型名：

```powershell
$env:TAROT_API_URL = "https://YOUR-PROVIDER.example/v1/chat/completions"
$env:TAROT_API_KEY = "<在本机安全配置，勿提交到源码>"
$env:TAROT_MODEL = "<模型名>"
npm start
```

先确认配置的模型确实可用。启用后页面会提示问题和本轮牌阵将发送到所配置的模型；密钥不会发到浏览器。模型失败时可重试，同一轮保留原牌；不把离线文案伪装成在线结果。服务默认只监听回环；通过 `HOST`/`PORT` 可调整，公开部署前加反代 HTTPS、认证和速率限制，避免他人耗用模型额度。不要上传密钥或复制旧站会话信息。当前未配置真实模型，不自动上线。

## 复刻边界

选阵和抽牌分离。新实现采用可维护的分流规则，匹配已知的示例：「今天的提示？」→ 问题解决（3）；「我今天最需要留意什么？」→ 直指核心（4）；行动计划、问题全景、发展路径（5）。不把输入长度或用户写明的牌数当作唯一触发条件。规则和模型提示词都不是旧站内部源码。从三／四／五张结果、长图预览到返回和历史，均按观察到的页面行为重建。分享长图为重绘的 PNG，未声称与旧站像素级相同。

## AI 管理后台 `/master`

前台没有管理入口。后台默认关闭；打开它需要同时设置一个 **至少 24 字符的管理员密码**和**独立的 32 字节加密密钥（标准 Base64）**。不要提交真实值，不要把密钥和加密文件放一起。已有 ZIP 中若没有 `master/`，请使用 GitHub 上更新后的源码。

### Windows 本机

在项目根目录的 PowerShell 中执行：

```powershell
# 生成仅供本次部署使用的高强度管理员密码和加密密钥。
$env:TAROT_MASTER_PASSWORD = node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"
$env:TAROT_MASTER_ENCRYPTION_KEY = node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
# 立即在可信的本机终端查看并保存到自己的密码管理器。不要发到聊天。
$env:TAROT_MASTER_PASSWORD
$env:TAROT_MASTER_ENCRYPTION_KEY
$env:TAROT_PUBLIC_ORIGIN = 'http://127.0.0.1:3000'
npm start
```

访问 `http://127.0.0.1:3000/master`，输入管理员密码。为所需的服务填模型 ID 和 Key；可以先留在离线，保存后点「测试已保存的连接」，测试通过再启用。未指定的服务不必填。测试会发一个固定请求，可能计费。Key 留空保留旧值，勾选清除再保存才会清除；旧 Key 不回显。

重启使用**原加密密钥**，而不是重跑生成命令。密码可单独改；换加密密钥会导致已有配置无法解密。默认加密文件是 `.tarot-data/providers.enc`。长期运行可设置 `TAROT_MASTER_DATA_DIR` 指向专用的绝对路径、持久化文件及限制目录权限（Windows 上配置 ACL）；单进程部署，重启后需要重新登录。

| 配置 | 凭据 | API |
|---|---|---|
| OpenAI | OpenAI Platform API Key | [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create) |
| Codex 模型 | 有对应模型权限的 OpenAI Platform API Key | [Responses API（例如 gpt-5-codex）](https://developers.openai.com/api/docs/models/gpt-5-codex) |
| DeepSeek | DeepSeek API Key | [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) |

Codex 配置不是用 ChatGPT/Codex 登录状态走订阅额度，不接收登录缓存或 OAuth 令牌。后台固定使用服务商官方 HTTPS 地址，不能填任意转发 URL；旧的 `TAROT_API_*` 自定义 Chat Completions 只在未通过后台保存时作为兼容入口。保存离线设置也会明确覆盖旧环境变量模式。

### 域名部署

GitHub 仓库不会启动 Node，也不会自动让域名生效。部署时把 `TAROT_PUBLIC_ORIGIN` 设为访问域名的 HTTPS 来源（如 `https://tarot.example.com`），保留回环监听，通过同机的 HTTPS 反向代理转发，保留原始 Host，不记录请求体。建议在边缘对 `/master` 再加访问限制，并为公开的 `/api/read` 配额控制。应用本身的在线请求默认最多每小时 60 次、同时 2 个；用 `TAROT_AI_HOURLY_LIMIT` 调整。单文件 HTML 不包含管理后台。

开发测试：`npm test`；`node scripts/check-master.mjs`（只使用本机端口和模拟服务，不需要真实 Key）；`node scripts/check-server.mjs`（验证旧环境变量模式与失败重试）。
