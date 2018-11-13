const md5 = require('md5')
const fs = require('fs')
const path = require('path')
const relative = require('relative')

function normalize(pathStr) {
  return pathStr.split(path.sep).join('/')
}
function createRelativePath(targetDir, localPath, useMd5 = true) {
  const file = fs.readFileSync(localPath)
  const relativePath = normalize(relative(path.dirname(targetDir), localPath))
  let keyRelativePath = relativePath
  if (useMd5) {
    keyRelativePath = normalize(relativePath.replace(/\./g, `-${md5(file)}.`))
  }
  return {relativePath, keyRelativePath, localPath}
}

module.exports = createRelativePath
