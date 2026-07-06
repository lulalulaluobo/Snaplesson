# SnapLesson 📸📖

> 拍照即成课：用手机摄像头扫描英语文章，AI 自动生成带音频、字幕、单词解析的沉浸式英语精读课程。

## ✨ 核心功能

- **📸 拍照建课** — 拍照/上传图片，AI OCR 识别文字，自动生成课程
- **🔊 TTS 朗读** — 支持 Edge TTS / 云知声 / 小米 MIMO 多引擎语音合成
- **📝 逐句精读** — 英文高亮跟踪、双语/英文/中文/无字幕模式切换
- **📖 词汇学习** — 点击单词查字典，保存生词本
- **⭐ 例句收藏** — 收藏精彩例句，随时复习
- **👥 多用户** — 支持多人注册，课程可共享，各自管理自己的课程
- **🛡️ 管理后台** — 管理员配置 AI 模型、管理用户

## 🚀 快速开始

### 环境要求
- Node.js >= 22

### 安装与启动

```bash
# 1. 克隆项目
git clone https://github.com/lulalulaluobo/Snaplesson.git
cd Snaplesson

# 2. 安装依赖
npm install

# 3. 启动开发服务器（同时启动前端 + 后端）
npm run dev
```

访问 http://localhost:5180

### 首次使用

1. 使用默认管理员账户登录：`admin` / `admin123`（建议登录后立即修改密码）
2. 前往 **设置** 页面配置 AI 模型（OpenAI API Key、TTS 服务等）
3. 前往 **课程** 页面，点击 **📸 拍照/上传** 开始建课

## ⚙️ AI 服务配置

所有 API Key 均通过 Web 管理后台配置，安全存储在本地数据库，**不需要**配置 `.env` 文件。管理员支持配置多组接口作为快捷预设，普通用户可在创建课时时自由选择调用的预设通道。

| 功能 | 支持的服务 / 提供商 |
|------|-----------|
| 文本处理/翻译 | OpenAI / 兼容 API (支持多组预设列表) |
| 语音合成 (TTS) | Edge TTS（系统免费默认）、云知声 Maas、小米 MIMO |
| OCR 识别 | 云知声 Maas、小米 MIMO（支持 glm-5v-turbo）、智谱清言 GLM、Agnes AI (agnes-2.0-flash) |

## 📁 项目结构

```
SnapLesson/
├── apps/
│   ├── api/          # 后端 Node.js API 服务（端口 4180）
│   └── web/          # 前端 React + Vite（端口 5180）
├── resource/         # 运行时生成（课程文件 + 数据库，不入库）
├── .env.example      # 环境变量示例
└── package.json
```

## 🛠️ 技术栈

- **前端**：React 19 + TypeScript + Vite + Vanilla CSS
- **后端**：Node.js (ESM) + SQLite（内置，零依赖）
- **语音**：Web Audio API + Edge TTS / 云知声 / 小米 MIMO
- **PWA**：支持添加到手机主屏幕

## 📄 License

MIT
