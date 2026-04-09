#!/usr/bin/env node

/**
 * 一键发布脚本
 * 
 * 功能：
 * - 运行测试
 * - 构建项目
 * - 更新版本号
 * - 创建 Git 标签
 * - 发布到 npm
 * - 推送到远程仓库
 * 
 * 用法：
 *   node scripts/release.js [patch|minor|major|beta]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
  } catch (error) {
    if (!options.allowFail) {
      log(`\n❌ 命令执行失败: ${command}`, 'red');
      process.exit(1);
    }
    return null;
  }
}

function execSilent(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    return null;
  }
}

// 检查工作目录状态
function checkWorkingDirectory() {
  log('\n📋 检查工作目录...', 'cyan');
  
  const status = execSilent('git status --porcelain');
  if (status && status.trim()) {
    log('❌ 工作目录有未提交的更改', 'red');
    log('请先提交或暂存更改:', 'yellow');
    log('  git add .');
    log('  git commit -m "your message"');
    process.exit(1);
  }
  
  log('✓ 工作目录干净', 'green');
}

// 检查当前分支
function checkBranch() {
  const branch = execSilent('git rev-parse --abbrev-ref HEAD')?.trim();
  log(`\n📍 当前分支: ${branch}`, 'cyan');
  
  if (branch !== 'main' && branch !== 'master') {
    log('⚠️  不在 main/master 分支，确定要继续吗？', 'yellow');
    log('建议切换到 main 分支: git checkout main', 'yellow');
  }
  
  return branch;
}

// 拉取最新代码
function pullLatest(branch) {
  log('\n⬇️  拉取最新代码...', 'cyan');
  exec(`git pull origin ${branch}`);
  log('✓ 代码已更新', 'green');
}

// 运行测试
function runTests() {
  log('\n🧪 运行测试...', 'cyan');
  exec('npm test');
  log('✓ 测试通过', 'green');
}

// 构建项目
function buildProject() {
  log('\n🔨 构建项目...', 'cyan');
  exec('npm run build');
  log('✓ 构建完成', 'green');
}

// 获取当前版本
function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
  return pkg.version;
}

// 更新版本号
function updateVersion(type, isBeta = false) {
  const currentVersion = getCurrentVersion();
  log(`\n📦 当前版本: ${currentVersion}`, 'cyan');
  
  let newVersion;
  
  if (isBeta) {
    // Beta 版本：从当前版本创建或递增 beta
    const baseVersion = currentVersion.split('-')[0];
    const betaMatch = currentVersion.match(/-beta\.(\d+)/);
    const betaNum = betaMatch ? parseInt(betaMatch[1]) + 1 : 0;
    newVersion = `${baseVersion}-beta.${betaNum}`;
    
    // 手动更新 package.json
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    pkg.version = newVersion;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    
    log(`📦 新版本: ${newVersion}`, 'green');
  } else {
    // 正式版本：使用 npm version
    let versionCmd = `npm version ${type} -m "chore: release v%s"`;
    const result = execSilent(versionCmd);
    if (result) {
      // npm version 返回带 v 前缀的版本号，去掉 v
      newVersion = result.trim().replace(/^v/, '');
      log(`📦 新版本: ${newVersion}`, 'green');
    } else {
      log('❌ 版本更新失败', 'red');
      process.exit(1);
    }
  }
  
  return newVersion;
}

// 检查 npm 登录状态
function checkNpmLogin() {
  log('\n🔐 检查 npm 登录状态...', 'cyan');
  
  const whoami = execSilent('npm whoami');
  if (whoami && !whoami.includes('ENEEDAUTH')) {
    log(`✓ 已登录为: ${whoami.trim()}`, 'green');
    return true;
  }
  
  log('⚠️  未登录 npm', 'yellow');
  log('请先登录: npm login', 'yellow');
  return false;
}

// 发布到 npm
function publishToNpm(isBeta = false) {
  log('\n🚀 发布到 npm...', 'cyan');
  
  const tag = isBeta ? ' --tag beta' : '';
  const cmd = `npm publish${tag}`;
  
  exec(cmd);
  log('✓ 发布成功', 'green');
}

// 推送到远程仓库
function pushToRemote(newVersion, branch, isBeta = false) {
  log('\n⬆️  推送到远程仓库...', 'cyan');
  
  // 推送代码
  exec(`git push origin ${branch}`);
  
  // 推送标签（仅正式版本）
  if (!isBeta) {
    exec(`git push origin v${newVersion}`);
    log('✓ 标签已推送', 'green');
  }
  
  log('✓ 代码已推送', 'green');
}

// 创建 Git 标签（beta 版本）
function createBetaTag(version) {
  log('\n🏷️  创建 Git 标签...', 'cyan');
  exec(`git tag v${version}`);
  log('✓ 标签已创建', 'green');
}

// 提交 beta 版本更改
function commitBetaVersion(version) {
  exec('git add package.json');
  exec(`git commit -m "chore: release v${version}"`);
  log('✓ 版本更改已提交', 'green');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const type = args[0] || 'patch';
  
  const validTypes = ['patch', 'minor', 'major', 'beta'];
  if (!validTypes.includes(type)) {
    log(`\n❌ 无效的版本类型: ${type}`, 'red');
    log(`有效类型: ${validTypes.join(', ')}`, 'yellow');
    process.exit(1);
  }
  
  const isBeta = type === 'beta';
  
  log('\n╔══════════════════════════════════════╗', 'cyan');
  log('║       skget 一键发布脚本        ║', 'cyan');
  log('╚══════════════════════════════════════╝', 'cyan');
  
  log(`\n发布类型: ${isBeta ? 'Beta 版本' : type}`, 'blue');
  
  // 执行发布流程
  checkWorkingDirectory();
  const branch = checkBranch();
  
  // 询问是否继续（非 main 分支）
  if (branch !== 'main' && branch !== 'master') {
    log('\n按 Ctrl+C 取消，或按 Enter 继续...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    await new Promise(resolve => {
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        resolve();
      });
    });
  }
  
  pullLatest(branch);
  runTests();
  buildProject();
  
  const newVersion = updateVersion(type, isBeta);
  
  // Beta 版本需要额外步骤
  if (isBeta) {
    commitBetaVersion(newVersion);
    createBetaTag(newVersion);
  }
  
  // 检查 npm 登录
  const isLoggedIn = checkNpmLogin();
  if (!isLoggedIn) {
    log('\n请登录后重新运行发布脚本', 'yellow');
    process.exit(1);
  }
  
  publishToNpm(isBeta);
  pushToRemote(newVersion, branch, isBeta);
  
  log('\n╔══════════════════════════════════════╗', 'green');
  log('║           🎉 发布成功！              ║', 'green');
  log('╚══════════════════════════════════════╝', 'green');
  
  log(`\n版本: ${newVersion}`, 'cyan');
  log(`安装: npx skget@${isBeta ? 'beta' : 'latest'} --help`, 'cyan');
  log(`npm:  https://www.npmjs.com/package/skget`, 'cyan');
}

main().catch(error => {
  log(`\n❌ 发布失败: ${error.message}`, 'red');
  process.exit(1);
});
