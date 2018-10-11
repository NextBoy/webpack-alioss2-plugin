function createServer(target) {
  const portfinder = require('portfinder')
  const express = require('express')
  const path = require('path')
  const os = require('os')
  const chalk = require('chalk')

  const app = express()
  const ip = Object.values(os.networkInterfaces())[0][1].address
  const route = path.basename(target)
  app.use(`/${route}`, express.static(target))

  return new Promise((resolve, reject) => {
    portfinder.getPortPromise()
      .then(port => {
        app.listen(port, '0.0.0.0')
        console.log(chalk.green.bold(`webpack-oss-plugin server is running  => http://${ip}:${port}`))
        resolve(`http://${ip}:${port}`)
      }).catch(error => {
      console.log('webpack-oss-plugin尝试为你启动一个服务器用来本地代理需要上传到OSS的图片，但是找不到空闲端口', error)
      reject()
    })
  })
}

module.exports = createServer
