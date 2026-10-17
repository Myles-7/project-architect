# 想做一个独属于我和对象的网站，可以进行实时的互动 — TECHNICAL_GUIDE.md

### 项目概述与愿景 (mostly-clear)
- **[Confirmed: User]** 想做一个独属于我和对象的网站，可以进行实时的互动，想要实现以下功能
双人虚拟同居室 (Live Chibi Room)，为我和她定制专属的形象，在自定义装扮的房间能够做很多事情，可以实时显示对方正在忙什么，比如我要去吃饭，就点击吃饭，我的形象人物就会到达餐厅显示吃饭的动作，在后期可以拓展更多的功能
该功能为首要的，后面再逐个拓展功能（比如恋爱时光轴  双人交换日记  专属影像馆  同步观影/歌单  AI 记忆回顾等等） *(Source: Decision dec-01)*
- **[Confirmed: User]** 应用管理格式 (SQLite) 并提供完整导出 *(Source: Decision dec-1788174997705)*
- **[Confirmed: User]** 单屏自由工作台 (Canvas/Dashboard) *(Source: Decision dec-1788175247236)*
- **[Confirmed: User]** Web 浏览器网页端 *(Source: Decision dec-1788175429087)*

### 目标用户与痛点 (mostly-clear)
- **[Confirmed: User]** 系统仅支持严格的“双人绑定”模式，不考虑多设备、多家庭或多人社交的扩展。 *(Source: Decision dec-1787926591471-i0ne)*
- **[Confirmed: User]** 仅用于个人使用，没有作为产品 *(Source: Decision dec-1787926701962)*
- **[Confirmed: User]** 仅供我和对象两个人私密使用，是专属的情侣空间。不需要做多用户注册或外部社交系统，核心聚焦在我们两人的实时状态同步、形象动作与房间装扮互动。” *(Source: Decision dec-1787927707969)*
- **[Confirmed: User]** 假设该项目在生命周期内完全不考虑商业化、多用户注册及外部社交功能扩展。 *(Source: Decision dec-1787929920564-mgcz)*

### MVP 范围与边界 (mostly-clear)
- **[Confirmed: User]** 严格聚焦单一核心痛点闭环 *(Source: Decision dec-1787926815353)*
- **[Confirmed: User]** 首期仅提供 1 个默认房间布局和 5-10 件基础像素家具，暂不支持多房间切换。 *(Source: Decision cand-mtd3dday-1e9n)*
- **[Confirmed: User]** 中等丰富预设（3-5套可选形象，6-8个日常与娱乐动作） *(Source: Decision dec-1788175387721)*

### 核心功能特性 (mostly-clear)
- **[Confirmed: User]** 实时状态展示以“无干扰陪伴”为主，不强制要求持续高频的网络同步，允许离线状态下的行为缓存。 *(Source: Decision cand-mtd1a82r-ycpj)*
- **[Confirmed: User]** 专属影像馆初期不提供云端大容量存储，以展示本地索引或链接外部媒体源为主。 *(Source: Decision dec-1787926617721-6uyx)*
- **[Confirmed: User]** 接入主流大模型云端服务 *(Source: Decision dec-1787928007029)*
- **[Confirmed: User]** 单人状态展示和双人交集的互动动作 *(Source: Decision dec-1787928079080)*
- **[Confirmed: User]** 建议先用可验证的首发边界收敛“核心功能”，将非必要内容延后。 *(Source: Decision dec-1787928107126)*
- **[Confirmed: User]** 双人交换日记功能采用双方轮流编写、写完并“寄出”后对方才能解锁查看的交换模式。 *(Source: Decision cand-mtd3cjey-i4na)*
- **[Confirmed: User]** 提供 5-6 种常见生活动作（发呆、吃饭、学习工作、洗澡、睡觉、出门） *(Source: Decision dec-1788175034491)*
- **[Confirmed: User]** AI记忆回顾功能将放在第二阶段（二期）进行开发与对接 *(Source: Decision cand-mth5g554-suhs)*
- **[Confirmed: User]** (Recommended) 最终一致性（最后释放拖拽的玩家位置为最终状态） *(Source: Decision dec-1788175475486)*
- **[Confirmed: User]** 当双方不在线时，暂时缓存在本地，并在双方同时在线时通过 WebSocket 自动增量对齐同步状态与家具布置。 *(Source: Decision cand-mth5jkd0-8zw5)*
- **[Confirmed: User]** 【离线缓存与自动同步】允许离线进行装扮或更改状态，数据暂存在浏览器。一旦双方连接建立，自动以最新的时间戳对齐，合并双方的修改。 *(Source: Decision dec-1788175838104)*
- **[Confirmed: User]** 在首期虚拟同居室上线并稳定后，再逐步引入恋爱时光轴、双人交换日记、专属影像馆、同步观影/歌单以及 AI 记忆回顾等功能。 *(Source: Decision cand-mth5vxib-uxe9)*
- **[Confirmed: User]** 接入的主流大模型云端服务由用户自行提供 API Key，系统本身不内置付费的大模型额度。 *(Source: Decision dec-1788177740260-89mc)*

### 主要用户旅程与流程 (mostly-clear)
- **[Confirmed: User]** 都支持 *(Source: Decision dec-1787928287797)*
- **[Confirmed: User]** 首发优先实现基础双人在线状态与单向高频动作广播“核心流程”，暂不做复杂物理碰撞与链式互动。 *(Source: Decision dec-1788175096215)*

### 页面结构与信息架构 (mostly-clear)
- **[Confirmed: User]** 用户通过主流现代浏览器访问网站，不需要下载安装包。 *(Source: Decision dec-1787926601266-u9ir)*

### UX 体验与 UI 方向 (mostly-clear)
- **[Confirmed: User]** 房间装扮首期采用二维像素风（2D Pixel Art）或可爱插画风（Chibi 风格），支持点击拖拽布置家具。 *(Source: Decision cand-mtd1a82r-70ax)*
- **[Confirmed: User]** MVP版本先是系统内置，后期通过上传形象图生成不同动作切图 *(Source: Decision dec-1787927683349)*
- **[Confirmed: User]** 手机移动端网页优先 *(Source: Decision dec-1787928299138)*
- **[Confirmed: User]** 界面默认语言为简体中文。 *(Source: Decision dec-1787928542659-3liz)*
- **[Confirmed: User]** 假设首个版本内置的像素风家具素材直接使用开源免费或免版税的素材包（如 Itch.io 上的像素风资源），而不是自己从零绘制。 *(Source: Decision dec-1787928556815-zezz)*
- **[Confirmed: User]** 默认采用温馨、暖色调的可爱插画或像素色系。 *(Source: Decision dec-1787928560841-bgs3)*
- **[Confirmed: User]** MVP 首期仅提供 1 个默认房间布局和 5-10 件基础像素家具，暂不支持多房间切换。 *(Source: Decision dec-1787929909202-nhuy)*
- **[Confirmed: User]** 当其中一方离线（断开网络或关闭网页）时，另一方房间中的对应形象自动切换为挂机动画状态（如在床上睡觉或坐在沙发上发呆），而不是从房间中直接消失或保持离线前的动作不动。 *(Source: Decision cand-mtd3cjey-maee)*
- **[Confirmed: User]** 首期 MVP 版本的系统内置形象直接提供 4-6 套已经绘制好的可爱 Chibi 完整角色形象供双方选择，暂不支持精细的发型、五官和服饰拆分拼装。 *(Source: Decision cand-mtd3cjey-j8iz)*
- **[Confirmed: User]** 当对方离线时，其形象在房间内自动切换为睡觉或在沙发上发呆的挂机动画。 *(Source: Decision cand-mtd3dday-ji58)*
- **[Confirmed: User]** 首期角色形象直接提供 4-6 套绘制好的完整 Chibi 形象，不支持发型和衣服的自由拆装。 *(Source: Decision cand-mtd3dday-k6yo)*
- **[Confirmed: User]** 首个版本内置的像素风家具与角色素材直接使用开源免费或免版税的素材包。 *(Source: Decision dec-1788174812279-mew0)*
- **[Confirmed: User]** 首期内置的 4-6 套 Chibi 形象将配备基础的动态动作帧序列图（Spritesheet，即包含人物连续动作的一整张图），直接以动画帧循环播放实现动效。 *(Source: Decision cand-mth5603x-qwa2)*
- **[Confirmed: User]** 使用 HTML5 Canvas 或轻量级 2D 渲染库（如 PixiJS）来绘制像素房间和角色动作。 *(Source: Decision cand-mth5aqmx-yxum)*
- **[Confirmed: User]** 播放行走或滑行路径动画 *(Source: Decision dec-1788175333293)*
- **[Confirmed: User]** 直线滑行/行走动画（形象从旧位置直线走到新位置，再切换动作） *(Source: Decision dec-1788175490482)*
- **[Confirmed: User]** 形象动作切图在前端采用精灵图（Sprite Sheets）方式打包与加载。 *(Source: Decision cand-mth5qyw6-t54y)*
- **[Confirmed: User]** 首期采用预设的像素动作序列，用户通过选择不同的衣服颜色或发型来进行基础的形象定制。 *(Source: Decision cand-mth5z6pl-l657)*
- **[Confirmed: User]** 首期虚拟同居室采用固定大小的单房间网格布局，不提供多房间或超大地图滚动。 *(Source: Decision dec-1788177632889-huog)*
- **[Confirmed: User]** 暂定默认：当一方在后台或锁屏状态时，网站的实时消息与互动通知机制尚未明确。 *(Source: Decision dec-1788177646738-u8ud)*
- **[Confirmed: User]** 暂定默认：尚未明确在一方锁屏或切后台时，如何同步或通知对方的消息与状态。 *(Source: Decision dec-1788177654529-i2gw)*
- **[Confirmed: User]** 优先适配移动端浏览器，确保随时随地可以方便地更新状态，同时兼容桌面端浏览器的正常访问。 *(Source: Decision dec-1788177699894-qxhe)*
- **[Confirmed: User]** MVP 版本内置的虚拟形象动作动画以简单的 2D 序列帧或静态切图形式存在，通过替换图片源实现状态切换。 *(Source: Decision dec-1788177707438-h3ol)*
- **[Confirmed: User]** 移动端网页主要采用竖屏交互布局。 *(Source: Decision dec-1788177713252-5iqg)*
- **[Confirmed: User]** 当其中一方离线（关闭网页或断网）时，其虚拟形象在对方屏幕上自动切换为睡觉或在沙发上发呆的挂机动画。 *(Source: Decision dec-1788177732029-6ubx)*
- **[Confirmed: User]** 首发内置 2-3 套精美默认形象与“UX/UI 方向”素材，暂缓自由文件上传与复杂编辑器。 *(Source: Decision dec-1788177753472-defs)*
- **[Confirmed: User]** 首个版本内置的像素风家具与角色素材直接使用开源免费或免版税的素材包。 *(Source: Decision dec-1788177765880-3g26)*

### 技术底线与运行约束 (mostly-clear)
- **[Confirmed: User]** 有没有能够实现的GitHub项目，可以进行数据无感传输 *(Source: Decision dec-1787927766238)*
- **[Confirmed: User]** 采用无服务器的对等网络直连方式，在双方浏览器同时打开时进行实时状态同步。 *(Source: Decision cand-mtd2dmp0-cso0)*
- **[Confirmed: User]** 支持将双人空间的互动数据、恋爱日记和时光轴一键导出为标准的 JSON 或 Markdown 文件包。 *(Source: Decision cand-mtd2dmp0-04rk)*
- **[Confirmed: User]** 基于用户无感传输的需求，首期可以选用基于 WebSocket 连接的轻量 Node.js 服务器作为中转站，配合 SQLite 或 LocalForage 进行本地数据缓存与快速还原。 *(Source: Decision cand-mtd2f6qa-5wun)*
- **[Confirmed: User]** 为了在公网环境下保持私密，网站首期不引入繁琐的用户账号注册系统，而是通过统一的预共享安全令牌 (Pre-Shared Token) 或访问密码来进行设备的首次双人绑定。 *(Source: Decision cand-mtd2f6qa-72m0)*
- **[Confirmed: User]** 使用轻量 WebSocket 中转服务进行数据转发，配合本地缓存来实现双人无感状态同步。 *(Source: Decision cand-mtd2j21i-ouuf)*
- **[Confirmed: User]** 首期采用基于 WebSocket 连接的轻量 Node.js 服务器作为信令与状态中转站。 *(Source: Decision cand-mtd2r6uh-f2vd)*
- **[Confirmed: User]** 双人绑定采用预共享安全令牌 (Pre-Shared Token) 或访问密码，代替注册系统。 *(Source: Decision cand-mtd2r6uh-z0dm)*
- **[Confirmed: User]** 首期前端动画与房间装扮交互框架建议采用轻量级的 Canvas 渲染库（如 PixiJS）或直接使用原生 DOM 拖拽与 CSS 动画。 *(Source: Decision cand-mtd2w8bs-7mvx)*
- **[Confirmed: User]** 假设双方的浏览器均支持现代 Web API（如 WebSocket、LocalStorage/IndexedDB）。 *(Source: Decision dec-1787929917067-q309)*
- **[Confirmed: User]** 假设只需兼容支持标准 HTML5 Drag and Drop API 和 WebSocket 协议的现代主流移动及桌面浏览器（如 Chrome、Safari、Edge），不考虑旧版浏览器的兼容。 *(Source: Decision dec-1787929924926-kv27)*
- **[Confirmed: User]** 假设只需兼容支持标准 HTML5 Drag and Drop API 和 WebSocket 协议的现代主流浏览器。 *(Source: Decision dec-1787929929563-oldl)*
- **[Confirmed: User]** 首次建立双人连接时，不使用任何注册流程，而是由双方在各自的设备上输入相同的“自定义暗号”（如纪念日或悄悄话）来完成安全通道的建立与绑定。 *(Source: Decision cand-mtd3cjey-gv8l)*
- **[Confirmed: User]** 本地优先为主，可选端到端加密同步服务 *(Source: Decision dec-1788175018679)*
- **[Confirmed: User]** 离线编辑的时光轴和日记在联网后，以生成时间戳为准自动双向合并，如有同一天的日记则并列显示 *(Source: Decision cand-mth5g554-1dmd)*
- **[Confirmed: User]** 利用双人绑定直连的特性，在设备连接时自动比对并补全双方本地数据，建立双机互备机制防范浏览器缓存清理风险。 *(Source: Decision cand-mth5jkd0-gcyz)*
- **[Confirmed: User]** 【支持个人第三方网盘备份】允许绑定自己的 WebDAV（如坚果云）或云存储，静默将本地数据库上传到自己的云盘中。 *(Source: Decision dec-1788175790663)*
- **[Confirmed: User]** 本地数据持久化在前端首选 LocalForage，Node.js 服务端暂存数据则选用 SQLite。 *(Source: Decision cand-mth5qyw6-oxsp)*
- **[Confirmed: User]** (推荐) 直接由双方在网页端的设置面板中手动输入各自的 API Key，保存在本地浏览器中 *(Source: Decision dec-1788176026346)*
- **[Confirmed: User]** 虽然不注册账号，但由中转 Node.js 服务器在后台自动保存一份经过预共享令牌加密的双人数据副本 *(Source: Decision dec-1788176058970)*
- **[Confirmed: User]** 统一配置在部署网站的云端服务器环境变量中 *(Source: Decision dec-1788176195153)*
- **[Confirmed: User]** 双人进行实时互动时，两台设备均处于可用 Internet 的网络环境中，不考虑完全离线的局域网直连。 *(Source: Decision dec-1788177679844-1j42)*
- **[Confirmed: User]** 实时状态同步采用标准的 WebSocket 协议进行全双工通信。 *(Source: Decision dec-1788177721190-tkza)*
- **[Confirmed: User]** 由于采用轻量 WebSocket 服务器或 WebRTC 直连，双方在不同网络环境下的实时状态同步延迟可以容忍在数秒之内。 *(Source: Decision dec-1788177759415-l68l)*

### 交付计划与阶段里程碑 (mostly-clear)
- **[Confirmed: User]** (推荐) 实时状态同步闭环：两台手机成功绑定后，一人改变状态动作（如点击吃饭），另一人的手机网页上能即时同步更新对应的形象动作。 *(Source: Decision dec-1787928810533)*
- **[Confirmed: User]** 【动作同步 + 房间家具保存 + 时光轴日志】除了核心同步和家具保存外，系统还要能生成当天的动作日志（如“对方下午学习了两小时”）。 *(Source: Decision dec-1788175846980)*
- **[Confirmed: User]** 除了动作同步外，还需包含至少 5 种可拖拽布置并同步的家具才能验收 *(Source: Decision dec-1788176202328)*