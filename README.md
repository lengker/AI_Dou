# 404号房间：你的数字分身

基于 PRD v2.1 开发的单机互动玩具 Web 应用。

## 运行

```bash
npm install
npm run setup    # 创建 public/DOU 资源链接（Windows junction）
npm run dev
```

浏览器打开 http://localhost:5173

## 功能概览

- 本地分身映射、双房间场景、桌宠行为
- 房间交互（电脑/床/冰箱/垃圾桶）、家具解锁、收藏系统
- 离线成长、新手探索指引、探索手册
- 街机小游戏入口（待替换新游戏）

## 素材

图片资源位于 `DOU/images/`，通过 `public/DOU` 软链接提供给 Vite 静态服务。

## 文档

- `DOU/summary/PRD.md` — 产品需求
- `DOU/summary/场景交互映射.md` — 热区与浮层映射
