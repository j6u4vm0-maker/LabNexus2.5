
import fs from 'fs';
import path from 'path';

const lockFilePath = path.join(process.cwd(), 'package-lock.json');
if (!fs.existsSync(lockFilePath)) {
    console.error('找不到 package-lock.json');
    process.exit(1);
}

const lockFile = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
const packages = lockFile.packages || {};

const versionMap = {};

for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
    if (pkgPath === '') continue; // skip root
    
    // Extract name from path (node_modules/abc -> abc)
    const name = pkgPath.replace(/.*node_modules\//, '');
    const version = pkgInfo.version;
    
    if (!version) continue;
    
    if (!versionMap[name]) {
        versionMap[name] = new Set();
    }
    versionMap[name].add(version);
}

const duplicates = [];
for (const [name, versions] of Object.entries(versionMap)) {
    if (versions.size > 1) {
        duplicates.push({ name, versions: Array.from(versions) });
    }
}

// Check for heavy data/scripts in node_modules
function checkNodeModulesDir() {
    const nmPath = path.join(process.cwd(), 'node_modules');
    if (!fs.existsSync(nmPath)) return [];
    
    const results = [];
    // Just looking for suspicious patterns like documentation, test folders in prod dependencies
    // But let's focus on version duplicates first as they are most common.
    return results;
}

console.log(JSON.stringify({
    duplicateCount: duplicates.length,
    duplicates: duplicates.sort((a, b) => b.versions.length - a.versions.length).slice(0, 20),
    totalPackages: Object.keys(versionMap).length
}, null, 2));
