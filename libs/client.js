let OSS = require('ali-oss')
const chalk = require('chalk')

// async function listBuckets() {
//     try {
//         let res = await client.listBuckets()
//         console.log(res.buckets)
//     }catch (err) {
//         console.log(err)
//     }
// }
// listBuckets()

module.exports = function (config) {
  // 连接阿里云OSS
  let client = new OSS(config)
  const bucket = config.bucket
// 指定操作的bucket
  client.useBucket(bucket)
  console.log(chalk.yellow.bold(`----当前bucket: ${bucket}----`))
  return client
}
