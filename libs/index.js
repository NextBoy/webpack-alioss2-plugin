const glob = require('glob')
const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const connectOSS = require('./client')
const createRelativePath = require('./util')
const createServer = require('./server')



function normalize(pathStr) {
  return pathStr.split(path.sep).join('/')
}

class OSSWebpackPlugin {

  constructor(options) {
    this.options = options || {}
    if (!this.options.targetDir || !this.options.oss) {
      process.exit(1)
      console.error('OSSWebpackPlugin配置参数不完整')
    } else {
      this.client = connectOSS(this.options.oss)
      this.justUps = []
      this.warnSize = this.options.warnSize || 150
      this.createServer = this.options.createServer || false
      this.uri = ''
    }
  }
  apply(compiler) {
    compiler.plugin('environment', async() => {
      if (this.createServer) {
        this.uri = await createServer(this.options.targetDir)
      }
    })

    compiler.plugin('done', async (stats) => {
      if (!this.options.region || !this.options.accessKeyId) {
          console.log(chalk.red.bold(`[error]：请配置有效的OSS信息`))
      }
      try {
        const localFileArray = this.getLocalFiles()
        // const localFileKeys = localFileArray.map(item => item.keyRelativePath)
        const ossFileObjs = await this.getOSSFiles()
        const checkUp = await Promise.all(
          localFileArray.map(obj => {
            return (async () => {
              let allUps = [...Object.keys(ossFileObjs), ...this.justUps]
              const objectName = obj.keyRelativePath
              const localFile = obj.localPath
              const relativePath = obj.relativePath
              if (!allUps.includes(objectName)) {
                console.log(chalk.black.bgRedBright(`----${relativePath}没有在本地记录中，已进入上传队列...\n`))
                const up = await this.client.put(objectName, localFile)
                this.justUps.push(objectName)
                console.log(chalk.green.bold(`tips: => ${relativePath} upload success!`))
              }
              return Promise.resolve()
            })()
          })
        )
        const checkSize = await Promise.all(
          localFileArray.map(obj => {
            const localFile = obj.localPath
            const relativePath = obj.relativePath
            return new Promise((resolve, reject) => {
              fs.stat(localFile, (err, stats) => {
                if (!err) {
                  const size = Math.ceil(stats.size / 1000)
                  if (size > this.warnSize) {
                    console.log(chalk.red.bold(`[warn]：${relativePath} 文件超过报警阈值，文件大小为(${size}KB)`))
                  }
                  resolve()
                } else {
                  reject()
                }
              })
            })
          })
        )
        console.log(chalk.yellow.bold('success! 所有需要上传的图片已经校验完毕, 图片大小警告阈值为' + this.warnSize + 'KB'))
      } catch (err) {
        console.log('图片部署到OSS发生了错误')
        console.log(err)
      }
    });
    compiler.plugin('failed', (err) => {
      console.log(err)
      // 在 failed 事件中回调 failCallback
      // this.failCallback(err);
    });
  }
  getLocalFiles() {
    const targetDir = this.options.targetDir
    var patterns = `${targetDir}/**/*.**`
    return glob.sync(patterns, {matchBase: true})
      .map(filePath => {
        // mac和window都统一格式的相对路径
        // 返回一个唯一的相对路径和本地路径组成的对象
        return createRelativePath(targetDir, filePath)
      })
  }

  async getOSSFiles() {
    try {
      const res = await this.client.list({
        'max-keys': 1000
      })
      res.objects = res.objects || []
      const objects = {}
      res.objects.forEach(item => {
        const name = item.name
        const url = item.url.replace('http:', 'https:')
        objects[name] = url
      })
      // console.log(objects)
      return Promise.resolve(objects)
    }catch (e) {
      console.log(e)
      process.exit(1)
    }
  }

  getVisitFileName(localPath, mock = false) {
    const targetDir = this.options.targetDir
    const info = createRelativePath(targetDir, localPath)
    if (mock && this.createServer) {
      return info.relativePath
    } else if (mock && !this.createServer) {
      console.log('你并没有运行mock服务器，请尝试开启配置重新运行')
      process.exit(1)
      return ''
    }
    return info.keyRelativePath
  }

  getVisitOssURI (mock = false) {
    if (mock && this.createServer) {
      return this.uri + '/'
    } else if (mock && !this.createServer) {
      console.log('你并没有运行mock服务器，请尝试开启配置重新运行')
      process.exit(1)
      return ''
    }
    return `https://${this.options.oss.bucket}.${this.options.oss.region}.aliyuncs.com/`
  }
}
// 导出插件
module.exports = OSSWebpackPlugin;
