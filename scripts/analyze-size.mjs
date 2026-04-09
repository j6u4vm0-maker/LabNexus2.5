
import fs from 'fs';
import path from 'path';

function getFiles(dir, allFiles = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            if (file === 'node_modules' || file === '.next' || file === '.git') continue;
            getFiles(name, allFiles);
        } else {
            const stats = fs.statSync(name);
            allFiles.push({
                path: name,
                size: stats.size
            });
        }
    }
    return allFiles;
}

const projectRoot = process.cwd();
console.log(`Analyzing directory: ${projectRoot}`);

const allFiles = getFiles(projectRoot);
allFiles.sort((a, b) => b.size - a.size);

console.log('\nTop 30 Largest Files (excluding node_modules, .next, .git):');
allFiles.slice(0, 30).forEach(f => {
    const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
    console.log(`${sizeMB} MB - ${path.relative(projectRoot, f.path)}`);
});

// Also check folder sizes
function getFolderSize(dir) {
    let size = 0;
    if (!fs.existsSync(dir)) return 0;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            size += getFolderSize(name);
        } else {
            size += fs.statSync(name).size;
        }
    }
    return size;
}

const foldersToCheck = ['node_modules', '.next', 'plm_data', 'tmp', 'scripts', '.gemini', '.idx'];
console.log('\nFolder Sizes:');
foldersToCheck.forEach(folder => {
    const size = getFolderSize(path.join(projectRoot, folder));
    console.log(`${(size / (1024 * 1024)).toFixed(2)} MB - ${folder}`);
});
