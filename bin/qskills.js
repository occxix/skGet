#!/usr/bin/env node

import { program } from '../dist/index.js';
import { checkFirstRun } from '../dist/core/init.js';

// 首次使用检测
await checkFirstRun();

// 解析命令行参数
program.parse(process.argv);
