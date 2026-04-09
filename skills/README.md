# qskills 公共技能库

本目录包含可被 qskills 工具管理的技能包。

## 技能列表

| 技能名称 | 版本 | 描述 | 标签 |
|----------|------|------|------|
| qskills | 1.0.3 | AI 技能管理工具 | cli, skill-management, ai-tools |
| code-review | 1.0.0 | 代码审查技能 | code-review, quality, security |

## 技能目录结构

每个技能遵循以下标准格式：

```
skill-name/
├── SKILL.md        # 技能说明文档（必需）
├── skill.json      # 技能元数据（必需）
└── [其他文件]      # 可选资源文件
```

## 安装技能

```bash
# 安装单个技能到指定环境
qskills s add ./skills/qskills -n qskills -e claude

# 安装技能到所有环境
qskills s add ./skills/qskills -n qskills --all

# 使用短命令
qskills s add ./skills/code-review -n code-review --all
```

## 创建新技能

1. 创建技能目录：`mkdir skills/your-skill`
2. 创建 `SKILL.md` 文件，描述技能功能和使用方法
3. 创建 `skill.json` 文件，填写元数据
4. 使用 `qskills s add` 添加到系统中

## 技能元数据格式 (skill.json)

```json
{
  "id": "skill-id",
  "name": "skill-name",
  "version": "1.0.0",
  "description": "技能描述",
  "author": "作者",
  "tags": ["tag1", "tag2"],
  "type": "folder",
  "entry": "SKILL.md",
  "files": ["SKILL.md"],
  "source": "public",
  "environment": "common",
  "createdAt": "2026-04-09",
  "updatedAt": "2026-04-09"
}
```
