# 发布指南

## 快速发布

### 一键发布脚本

```bash
# 补丁版本 (1.0.0 -> 1.0.1)
npm run release:patch

# 次要版本 (1.0.0 -> 1.1.0)
npm run release:minor

# 主要版本 (1.0.0 -> 2.0.0)
npm run release:major

# Beta 版本
npm run release:beta
```

脚本会自动执行：
1. 运行测试
2. 构建项目
3. 更新版本号
4. 创建 Git 标签
5. 发布到 npm
6. 推送到远程仓库

---

## 发布前检查清单

- [ ] 代码已提交到 Git
- [ ] 所有测试通过：`npm test`
- [ ] 构建成功：`npm run build`
- [ ] 本地测试正常：`node bin/skget.js --help`
- [ ] 更新 CHANGELOG（如有重大变更）
- [ ] 检查发布内容：`npm pack --dry-run`

---

## 手动发布流程

### 1. 准备工作

```bash
# 确保在 main 分支
git checkout main
git pull origin main

# 安装依赖
npm install

# 运行测试
npm test

# 构建
npm run build
```

### 2. 登录 npm

```bash
npm login
# 输入用户名、密码、邮箱

# 验证登录状态
npm whoami
```

### 3. 检查包名

```bash
npm search skget
```

如果包名已被占用，可使用作用域：
```json
{
  "name": "@your-username/skget"
}
```

### 4. 本地测试

```bash
# 打包
npm pack

# 全局安装测试
npm install -g skget-1.0.0.tgz

# 测试命令
skget --help
skget skill list

# 卸载测试版本
npm uninstall -g skget
```

### 5. 发布

```bash
# 正式发布
npm publish

# 或发布作用域包（公开）
npm publish --access public

# 发布 beta 版本
npm publish --tag beta

# 发布 next 版本
npm publish --tag next
```

### 6. 验证

```bash
# 等待几分钟后测试
npx skget --help
```

---

## 版本管理

### 版本号规则 (SemVer)

| 类型 | 说明 | 示例 |
|------|------|------|
| `patch` | Bug 修复 | 1.0.0 → 1.0.1 |
| `minor` | 新功能（向后兼容） | 1.0.0 → 1.1.0 |
| `major` | 破坏性变更 | 1.0.0 → 2.0.0 |
| `prerelease` | 预发布版本 | 1.0.0 → 1.1.0-beta.0 |

### 手动更新版本

```bash
# 补丁版本
npm version patch -m "chore: release v%s"

# 次要版本
npm version minor -m "chore: release v%s"

# 主要版本
npm version major -m "chore: release v%s"

# 预发布版本
npm version prerelease --preid=beta -m "chore: release v%s"
```

### 完整发布流程

```bash
# 1. 更新版本
npm version minor

# 2. 推送代码和标签
git push --follow-tags

# 3. 发布
npm publish
```

---

## 发布目标

### npm (默认)

```bash
npm publish
```

### GitHub Packages

1. 配置 `package.json`：
```json
{
  "name": "@your-username/skget",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

2. 创建 `.npmrc`：
```
@your-username:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

3. 发布：
```bash
npm publish
```

### 从 GitHub 直接使用

```bash
# 最新版本
npx github:your-username/skget skill list

# 指定版本
npx github:your-username/skget#v1.0.0 skill list

# 指定分支
npx github:your-username/skget#develop skill list
```

---

## CI/CD 自动发布

### GitHub Actions 配置

创建 `.github/workflows/publish.yml`：

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test
        run: npm test

      - name: Publish
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 配置 NPM_TOKEN

1. 访问 npm → Access Tokens → Generate New Token
2. 选择 `Automation` 类型
3. 复制 Token
4. GitHub 仓库 → Settings → Secrets → Actions
5. 添加 `NPM_TOKEN` 变量

---

## 发布后操作

1. **创建 GitHub Release**
   - 访问仓库 → Releases → Draft a new release
   - 选择标签，填写更新日志

2. **更新文档**
   - 更新 README.md
   - 更新 CHANGELOG.md

3. **通知用户**
   - 发布公告
   - 更新社交媒体

---

## 回滚发布

### 撤销特定版本

```bash
# 撤销 24 小时内的版本
npm unpublish skget@1.0.1
```

### 撤销整个包

```bash
# 需要等待 24 小时生效
npm unpublish skget --force
```

### 弃用版本

```bash
# 标记为已弃用（不删除）
npm deprecate skget@1.0.0 "此版本有严重 bug，请升级"
```

---

## 常见问题

### Q: 包名已存在

使用作用域：
```json
{
  "name": "@your-username/skget"
}
```

发布时：
```bash
npm publish --access public
```

### Q: 发布权限错误

```bash
# 检查当前用户
npm whoami

# 重新登录
npm logout
npm login
```

### Q: 2FA 验证失败

```bash
npm publish --otp=123456
```

### Q: 发布后无法安装

等待 npm 同步（通常几分钟）：
```bash
# 使用官方源
npm install skget --registry https://registry.npmjs.org
```

### Q: 版本已存在

```bash
# 更新版本号后重试
npm version patch
npm publish
```

---

## 相关文档

- [README](../README.md)
- [测试报告](TEST_REPORT_20260409.md)
- [技术规格](TECH_SPEC_skget_20260409.md)
