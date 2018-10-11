# webpack-alioss2-plugin
一个方便上传图片到阿里云OSS的插件，特别适合微信小程序开发，将图片自动上传到阿里云OSS，并且为了减少OSS的流量消耗，在本地开发期间可以启用本地服务器
模拟线上进行访问，省下OSS的流量费用。在开发小程序的时候，需要配合url-loader或者file-loader一起使用。


功能：
 - 提供图片自动上传到阿里云OSS的功能
 - 在本地启动node服务器模拟预览

**为了方便大家，这里顺便提供一个基于mpvue的项目模板，已经加入了该配置，
并且已经加入了小程序分包功能，你只需要去webpack.base.conf.js文件中配置你的OSS参数就行**

[mpvue项目模板地址](https://github.com/NextBoy/oss-mpvue-quickstart)

## Install
```bash
npm install webpack-alioss2-plugin --save-dev
```
## use
以mpvue项目模板为例子，在webpack.base.conf.js中配置引入
```ecmascript 6
var OSSWebpackPlugin = require('webpack-alioss2-plugin')
const OSSPlugin = new OSSWebpackPlugin({
  targetDir: path.resolve(__dirname, '../oss-upload'), // 目标文件夹
  warnSize: 200, // 图片报警阈值，单位为KB
  createServer: process.env.NODE_ENV === 'development', // 是否开启本地服务器代理图片
  // oss的相关参数这里不做解释，请自行按照阿里云的OSS数据进行配置即可
  // 特别提醒： accessKeySecret 和 accessKeyId 是特别重要的信息，请不要随便泄露
  oss: {
    region: 'xxxxx',
    accessKeyId: 'xxxxxx',
    accessKeySecret: xxxxxx',
    bucket: 'xxxxxx'
  }
})
```
- 在webpack.base.conf.js中修改url-loader或者file-loader的配置
```
{
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        loader: 'file-loader',
        options: {
          emitFile: false, // 禁止webpack生成图片到dist目录
          name: function (file) {
            // 开发环境下访问本地
            return OSSPlugin.getVisitFileName(file, process.env.NODE_ENV === 'development')

          },
          publicPath: function (fileName) {
            // 开发环境下访问本地
            return OSSPlugin.getVisitOssURI(process.env.NODE_ENV === 'development') + fileName
          }
        }
      }
```
- 作为webpack.base.conf.js中添加该插件实例到plugins数组中
```
plugins: [
    OSSPlugin, // oss插件
    new MpvuePlugin(),
    new CopyWebpackPlugin([{
      from: '**/*.json',
      to: ''
    }], {
      context: 'src/'
    }),
    new CopyWebpackPlugin([
      {
        from: path.resolve(__dirname, '../static'),
        to: path.resolve(__dirname, '../dist/static'),
        ignore: ['.*']
      }
    ])
  ]

```


### 注意事项 （matters need attention）

请将所有的图片放置在统一的文件夹中，例如 oss-upload

如果你是使用mpvue进行小程序开发，请注意：
由于mpvue-loader的原因，如果需要引用图片，应该在代码中进行import，再进行赋值使用否则file-loader和url-loader无法处理到该图片
example:

```
<template>
  <div class="container">
    <img :src="img">
  </div>
</template>

<script>
import card from '@/components/card'
// 引入图片
import img from 'root/oss-upload/global/filter-condition/time.png'

export default {
  data () {
    return {
      list: [],
      img // 图片变量
    }
   }
  }
```

- 放心地在CSS代码中使用本地路径的背景图片（前提是放在要上传的文件夹中），file-loader会自动转化
example

```
background: url("../../oss-upload/global/search/search-hot.png") 100% 100%;
```


