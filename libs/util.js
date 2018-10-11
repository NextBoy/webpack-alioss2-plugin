const md5 = require('md5')
const fs = require('fs')
const path = require('path')
const relative = require('relative')

function normalize(pathStr) {
  return pathStr.split(path.sep).join('/')
}

function createRelativePath(targetDir, localPath) {
  const file = fs.readFileSync(localPath)
  const relativePath = normalize(relative(path.dirname(targetDir), localPath))
  const keyRelativePath = normalize(relativePath.replace(/\./g, `-${md5(file + relativePath)}.`))

  return {relativePath, keyRelativePath, localPath}
}

module.exports = createRelativePath
