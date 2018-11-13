function createServer(target) {
  const portfinder = require('portfinder')
  const express = require('express')
  const path = require('path')
  const os = require('os')
  const chalk = require('chalk')
  function getIPAdress(){
        var interfaces = os.networkInterfaces();
        for(var devName in interfaces){
            var iface = interfaces[devName];
            for(var i=0;i<iface.length;i++){
                var alias = iface[i];
                if(alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal){
                    return alias.address;
                }
            }
        }
        console.log('没有获取到ip，可能导致手机无法预览')
        return 'localhost'
    }
  const app = express()
  const ip = getIPAdress()
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
