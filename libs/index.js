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
function deepMerge(obj1, obj2) {
    var key;
    for(key in obj2) {
        // 如果target(也就是obj1[key])存在，且是对象的话再去调用deepMerge，否则就是obj1[key]里面没这个对象，需要与obj2[key]合并
        obj1[key] = obj1[key] && obj1[key].toString() === "[object Object]" ?
            deepMerge(obj1[key], obj2[key]) : obj1[key] = obj2[key];
    }
    return obj1;
}

function createFatherKey(keysMap, length) {
    if (!length){
        return ''
    }
    return '.' + keysMap.slice(0, length).join('.')
}

function analyzeMap(relativePath, keyRelativePath, URI) {
    let obj = {}
    const keysMap = relativePath.replace(/\s/, '').replace(/(-|@)/g, '_').replace(/\..+$/, '').split('/')
    for(let i = 1; i <= keysMap.length; i++) {
        const fatherKey = createFatherKey(keysMap, i)
        const value = i === keysMap.length ? `"${(URI + keyRelativePath)}"` : '{}'
        const string = `obj${fatherKey}=${value}`
        eval(string)
    }
    return obj
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
        compiler.plugin('compile', async() => {
            console.log('compile done')
            if (this.createServer) {
                if (this.options.mapLocalRecords) {
                    const next = await this.uriReady()
                    await this.getLocalFiles(false)
                }
            }
        })
        compiler.plugin('compile', async () => {
            // 正式环境下优先生成图片配置文件
            //   if (process.env.NODE_ENV !== 'production') {
            //     return 0
            //   }
            if (!this.options.oss.region || !this.options.oss.accessKeyId) {
                console.log(chalk.red.bold(`[error]：请配置有效的OSS信息`))
                return 0
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
    getLocalFiles(useMd5 = true) {
        const targetDir = this.options.targetDir
        var patterns = `${targetDir}/**/*.**`
        const items = glob.sync(patterns, {matchBase: true}).filter(filePath => !/\.json/.test(filePath))
        let record = {}
        const result = items.map(filePath => {
            // mac和window都统一格式的相对路径
            // 返回一个唯一的相对路径和本地路径组成的对象
            const info = createRelativePath(targetDir, filePath, useMd5)
            let imgUri = this.getVisitOssURI(false)
            let recordImgPath = info.keyRelativePath
            if (this.options.mapLocalRecords) {
                recordImgPath = info.relativePath
                imgUri = this.getVisitOssURI(true)
            }
            record = deepMerge(record, analyzeMap(info.relativePath, recordImgPath, imgUri))
            return info
        })
        fs.writeFileSync(path.join(this.options.targetDir, './record.json'), JSON.stringify(record, null, 4))
        return result
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
            return 'undefined'
        }
        return `https://${this.options.oss.bucket}.${this.options.oss.region}.aliyuncs.com/`
    }

    uriReady () {
        return new Promise((resolve) => {
            let timer = setInterval(() =>{
                if (this.uri) {
                    clearInterval(timer)
                    resolve(true)
                }
            }, 100)
        })
    }
}
// 导出插件
module.exports = OSSWebpackPlugin;
