import * as fs from "fs";
import * as path from "path";

function walkDir(dir: string, callback: (filePath: string) => void) {
  if (!fs.existsSync(dir)) return;
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return;
  }
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (filePath.includes("node_modules") || filePath.includes(".git")) continue;
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else {
      callback(filePath);
    }
  }
}

console.log("Searching for any newly created PNG/JPG/JPEG files across the workspace...");
walkDir(".", (filePath) => {
  if (filePath.endsWith(".png") || filePath.endsWith(".jpg") || filePath.endsWith(".jpeg") || filePath.endsWith(".svg")) {
    console.log("Found:", filePath);
  }
});
