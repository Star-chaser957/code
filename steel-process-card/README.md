# 钢棒/型钢生产工艺卡系统

轻量型内部工艺卡管理系统 MVP，覆盖：

- 工艺卡列表查询
- 新建 / 编辑
- 工序动态启用
- 热处理多条明细
- 检验多选结构化保存
- 打印预览
- 浏览器打印 / 另存为 PDF

## 运行

```bash
npm install
npm run dev
```

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

## 技术栈

- 前端：React 19 + TypeScript + Vite + React Router
- 后端：Fastify + TypeScript
- 数据存储：SQLite 模型 + `sql.js` 文件持久化
- 打印：独立 HTML 打印模板 + 浏览器打印 / PDF

## 数据结构

- `process_cards`：工艺卡主表
- `operation_definitions`：工序定义表
- `operation_option_definitions`：工艺选项字典表
- `card_operations`：工艺卡工序实例
- `card_operation_selected_options`：工序勾选选项
- `operation_details`：工序参数 / 多明细

## 关键说明

- “编制 / 确认 / 审核 / 批准”仅作为普通字段保存，不做审批流。
- 热处理采用“一道工序 + 多条处理明细”建模。
- 检验采用结构化多选，支持按检验项目查询。
- 打印页与录入页分离，打印模板按 A4 竖版单页优先优化。

## 主要目录

```text
shared/                 共享类型与工序目录
server/                 Fastify 后端、SQLite schema、仓储层
src/                    React 前端页面与打印模板
docs/system-design.md   设计方案说明
```
