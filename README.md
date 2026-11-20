# halo-plugin-3d

Halo 博客框架 **2.21.7** 的 3D 模型插件：在文章中插入并渲染 3D 模型，基于 **Three.js**，支持 **亮色 / 暗色**主题。

| 能力 | 说明 |
| --- | --- |
| 模型格式 | `.obj`（可搭配 `.mtl` 材质）、`.fbx`、`.glb` / `.gltf` |
| 选择方式 | 在编辑器里从「附件」中选择，支持搜索与直接上传 |
| 渲染 | Three.js（WebGL），支持鼠标旋转 / 缩放、自动旋转 |
| 主题 | 自动跟随站点亮/暗色，也可对单个模型强制指定 |
| 背景 | 透明 / 纯色 / 渐变三种样式 |
| 网格 | 可单独开关地面的参考网格 |
| 可配置 | 编辑器内可视化配置：自动旋转、网格显示、能否手动拖动、主题、背景、宽高 |

---

## 一、安装

1. 在插件目录下构建并打包（见「开发」一节），得到 `dist/PluginThreeD-1.0.0.jar`；
2. 进入 Halo 控制台 →「插件管理」→「插件商店 / 安装插件」→「上传插件」；
3. 选择 `PluginThreeD-1.0.0.jar` 上传，安装完成后**启用**插件。

> 插件要求 Halo `>= 2.21.0`（`plugin.yaml` 中的 `spec.requires`）。

## 二、使用

### 1. 准备模型文件

在「附件」里上传模型文件即可。推荐做法：

- **GLB**：单个文件，材质贴图都打包在里面，最省事，兼容性最好；
- **OBJ + MTL + 贴图**：把 `.obj`、`.mtl` 以及 `.mtl` 中引用的贴图（如 `map_Kd wood.png`）**一起上传到附件**。
  MTL 中写的是相对路径，运行时以 MTL 文件的地址为基准解析，因此同一批上传的贴图能被正确找到；
- **FBX**：单个文件，外部贴图同样建议一起上传。

### 2. 在文章中插入

编辑器里任选一种方式：

- 工具箱「+」→ **3D 模型**；
- 输入斜杠命令 `/3d`、`/3D 模型` 等关键字 → 选择「3D 模型」；
- 选中已插入的模型 → 悬浮菜单里可以「更换模型」。

弹出的**就是 Halo 自带的附件选择器**（和「插入附件」按钮用的是同一个），
里面会列出附件中的模型文件，支持关键字搜索、分组筛选，也可以直接上传后插入。
选中 `.obj` 时会接着询问是否选择 `.mtl` 材质文件（点取消可跳过）。

### 3. 调整展示效果

**方式一：悬浮菜单（快捷切换）**

选中模型后，悬浮菜单提供：

| 按钮 | 作用 |
| --- | --- |
| 更换模型 | 重新从附件中选择 |
| 设置 | 展开完整的配置面板（见下） |
| 主题 | 在「跟随站点 → 亮色 → 暗色」之间循环 |
| 自动旋转 | 开 / 关 |
| 网格 | 显示 / 隐藏地面参考网格 |
| 拖动 | 允许 / 禁止手动拖动与缩放 |
| 高度 | 在 320 / 420 / 560 / 680px 之间循环 |
| 删除 | 删除该模型 |

**方式二：设置面板（完整配置）**

点悬浮菜单的「设置」会在气泡菜单下方展开设置面板；
鼠标移到模型上时点右上角的齿轮按钮，则是在模型下方就地展开同一套面板：

| 分组 | 可配置项 |
| --- | --- |
| 模型 | 查看当前文件名、「更换」 |
| 外观 | 主题（跟随站点 / 亮色 / 暗色）、背景（透明 / 纯色 / 渐变）、显示网格 |
| 交互 | 自动旋转、允许手动拖动 / 缩放 |
| 尺寸 | 宽度预设（100% / 640 / 800 / 1000px）或自定义、高度预设（320 / 420 / 560 / 680px）或自定义 |

面板里的改动**会实时同步到编辑器中的预览**（不用保存即可看到效果），点「完成」收起面板。

## 三、亮色 / 暗色主题

每个模型块都有一个 `theme` 属性：

- `auto`（默认）：**跟随站点主题**，运行时会实时监听站点主题变化并自动切换；
- `light`：固定使用亮色灯光与背景；
- `dark`：固定使用暗色灯光与背景。

运行时判定站点主题的顺序：

1. `<html>` / `<body>` 上的主题属性：`data-theme`、`data-appearance`、`data-color-mode`、`data-mode`、`data-bs-theme`、`data-color-scheme`
   （值为 `dark` / `night` / `black` / `dim` 时判定为暗色）；
2. `<html>` / `<body>` 上的 `dark` / `light` class（Tailwind `darkMode: "class"` 约定）；
3. 系统的 `prefers-color-scheme`。

以上任一项变化都会通过 `MutationObserver` 被监听，切换站点主题时模型会实时跟随。

> Halo 控制台自身没有暗色模式，因此编辑器里的预览默认按亮色渲染；把某个模型显式设置为「暗色」即可预览暗色效果。

## 四、文章里保存的内容

插入后文章中会写入如下 HTML：

```html
<div class="halo-3d-model"
     data-halo-3d-model="true"
     data-src="/upload/2026/11/model.glb"
     data-mtl-src=""
     data-name="model.glb"
     data-width="100%"
     data-height="420px"
     data-theme="auto"
     data-autorotate="true"
     data-background="solid"
     data-grid="true"
     data-controls="true"
     style="position:relative;display:block;width:100%;height:420px;overflow:hidden;margin:1rem auto;">
  <script src="/plugins/PluginThreeD/assets/console/halo-3d-runtime.js" defer="defer"></script>
</div>
```

各属性含义：

| 属性 | 取值 | 说明 |
| --- | --- | --- |
| `data-src` | URL | 模型文件地址（附件 permalink） |
| `data-mtl-src` | URL | OBJ 搭配的 MTL 材质地址，没有则为空 |
| `data-name` | 文本 | 模型文件名，用于展示 |
| `data-width` | CSS 长度 | 展示宽度 |
| `data-height` | CSS 长度 | 展示高度 |
| `data-theme` | `auto` / `light` / `dark` | 配色方案 |
| `data-autorotate` | `true` / `false` | 是否自动旋转 |
| `data-background` | `none` / `solid` / `gradient` | 背景样式（透明 / 纯色 / 渐变） |
| `data-grid` | `true` / `false` | 是否显示地面网格 |
| `data-controls` | `true` / `false` | 是否允许手动拖动 / 缩放 |

> **兼容旧内容**：早期版本用 `data-background="grid"` 同时表达「网格」和「背景」。
> 现在会自动把 `grid` 解析成「纯色背景 + 显示网格」，
> 而 `data-background="none"` 且没有 `data-grid` 的旧内容仍然不显示网格。

渲染脚本被放在 `div` 内部，这样**重新编辑文章时不会丢失**（编辑器会把它当作模型节点的一部分保存回去）。

### 主题要求

文章正文需要被**原样输出为 HTML**（绝大多数 Halo 主题都是这样做的）。如果你的主题对正文做了过滤，
导致 `script` 被剥离，可以把下面这行加到主题的 `footer`（或任意自定义模板）里，运行时同样会自动初始化页面中所有模型：

```html
<script src="/plugins/PluginThreeD/assets/console/halo-3d-runtime.js"></script>
```

## 五、开发

### 目录结构

```
halo-plugin-3d/
├── src/main/resources/
│   ├── plugin.yaml            # 插件清单
│   └── console/               # 构建产物（main.js / style.css / halo-3d-runtime.js）
├── scripts/package-plugin.mjs # 打包脚本
├── test/                      # 本地测试页（运行时 + 编辑器弹窗）
└── ui/                        # 前端工程
    ├── src/
    │   ├── index.ts           # 插件入口（注册编辑器扩展点）
    │   ├── tiptap/            # Tiptap 节点扩展
    │   ├── components/        # 节点视图、设置面板、图标
    │   ├── utils/             # 附件选择封装、插入/更换动作、节点定位
    │   ├── runtime/           # 公开站点运行时（three.js）
    │   ├── dev/               # 仅本地测试用，不会进入产物
    │   └── ...
    ├── vite.config.ts         # 控制台包
    ├── vite.runtime.config.ts # 公开站运行时包
    └── vite.harness.config.ts # 本地测试包（模拟 Halo 控制台）
```

### 构建与打包

```bash
cd ui
npm install
npm run build        # 同时构建控制台包与公开站运行时
npm run type-check   # 类型检查

cd ..
npm --prefix ui run package   # 生成 dist/PluginThreeD-1.0.0.jar
```

### 关键实现说明

- **编辑器扩展**：通过 `default:editor:extension:create` 扩展点注入 Tiptap 节点，
  工具箱 / 斜杠命令 / 悬浮菜单分别对应 `getToolboxItems`、`getCommandMenuItems`、`getBubbleMenu`；
- **附件选择复用 Halo 自带的**：插件**不自己造附件列表弹窗**，而是调用 Halo 默认编辑器
  已有的全局编辑器命令 `editor.commands.openAttachmentSelector(callback, { accepts, min, max })`
  （Halo 2.21.7 源码：`ui/src/components/editor/DefaultEditor.vue`）。
  好处是弹窗由 Halo 自己渲染，样式、层级、遮罩天然正确，
  附件分组 / 策略 / 搜索 / 分页 / 上传等功能也全部开箱即用；
- **设置面板也不用弹窗**：Halo 的悬浮菜单按钮 `action` 支持**返回一个组件**，
  返回后组件会渲染在气泡菜单的下拉层里
  （Halo 源码：`ui/packages/editor/src/components/bubble/BubbleItem.vue`）。
  插件的完整设置面板就走这条路；模型右上角的齿轮按钮则是在节点视图里就地展开同一套面板；
- **媒体类型过滤**：`accepts` 同时要满足 Halo 两端的匹配规则——
  服务端是**前缀匹配**（`model/*` → `model/`），客户端是**正则匹配**（`model/*` → `model/.*`），
  因此 `model/*` 两边都成立；`.obj` / `.mtl` / `.fbx` 浏览器会报 `application/octet-stream`，一并带上；
  选中后还会再按**文件扩展名**精确校验一次，拦住选错的文件；
- **运行时体积**：three.js 及其加载器只打包在 `halo-3d-runtime.js` 中（gzip 约 178 KB），
  控制台插件包本身只有约 19 KB，编辑器预览时按需从 `/plugins/PluginThreeD/assets/console/` 加载运行时；
- **性能**：视口外的模型自动暂停渲染，`ResizeObserver` 跟随容器尺寸，`OrbitControls` 带阻尼；
  改属性时走 `runtime.mount()` 的热更新路径，不会重新下载模型。

### 本地测试

```bash
node test/server.mjs 4321
# 浏览器打开 http://127.0.0.1:4321/          → 公开站运行时（OBJ/MTL、亮暗主题、网格、旧内容兼容）
# 浏览器打开 http://127.0.0.1:4321/editor.html → 编辑器集成测试
```

`test/editor.html` 是一个**集成测试**，不是界面预览：

- 加载 Halo **真实的** `@halo-dev/richtext-editor`（真正的 Tiptap 编辑器）
  与 `@halo-dev/components`；
- 注册一个和 Halo `custom-attachment-extension` **完全一致**的 `openAttachmentSelector` 命令桩；
- 用 Halo 自己的 `RichTextEditor` 组件把编辑器挂进 Vue 应用
  （和 `DefaultEditor.vue` 的结构一致，节点视图依赖组件树上下文）；
- 走一遍「点工具箱 → 选附件 → 文档里出现模型节点 → 选材质 → 气泡菜单 → 设置面板」的完整链路，
  最后输出 26 项断言的结果。

> ⚠ 上一版的测试页在 HTML 里**手写了一份 `.modal-wrapper` 的 CSS**，
> 于是「弹窗显示正常」完全是那页自己造出来的假象，真实控制台里的问题一个都测不出来。
> 这一版已经彻底移除所有自写的弹窗 CSS。

测试用模型文件在 `test/fixtures/`（`cube.obj` + `cube.mtl`），公开站运行时测试用的是同一份文件。

测试包由 `ui/vite.harness.config.ts` 构建：

```bash
cd ui && npx vite build --config vite.harness.config.ts
```

## 六、已知限制与排错

- 模型文件解析失败（例如 OBJ 索引越界导致顶点出现 NaN）时会提示「模型文件解析失败」，此时请检查模型文件本身；
- FBX / GLTF 中引用外部贴图时，需要把贴图也上传到附件并保证相对路径可解析；
- 运行时地址为站点根路径下的 `/plugins/PluginThreeD/assets/console/`，若站点部署在子路径下需自行调整；
- **附件选择器是 Halo 自带的**，因此选择文件时需要有附件查看 / 管理权限；
  另外 Halo 的附件选择器**只在「确认选择」时回调**，点「取消」不会触发任何回调——
  这意味着「选择 OBJ 后追加 MTL 材质」这一步如果点取消，材质就是空的（模型本身已经插入成功）；
- **如果点了「插入 3D 模型」还是没反应**：本版本起所有失败路径都会弹 `Toast` 错误提示，
  同时浏览器控制台（DevTools → Console）会打印 `[halo-plugin-3d]` 开头的错误。
  把这段日志反馈出来即可定位——控制台侧的任何异常都不会再被静默吞掉。

## 七、许可证

GPL-3.0
