const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "frontend", "dist");
const dest = path.join(__dirname, "..", "backend", "dist");

if (!fs.existsSync(src)) {
  console.error("前端未构建，请先运行 npm run build:frontend");
  process.exit(1);
}

// 清理旧文件
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true });
}

// 复制
fs.cpSync(src, dest, { recursive: true });
console.log(`✅ 前端构建产物已复制到 ${dest}`);
