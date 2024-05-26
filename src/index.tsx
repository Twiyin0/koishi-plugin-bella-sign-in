import { Context, Schema, h, Random, Logger } from 'koishi'
import { pathToFileURL } from 'url'
import { resolve } from 'path'
import {} from "koishi-plugin-puppeteer";
import { Page } from "puppeteer-core";
import { Signin } from './signin';
import { jryspro } from './jryspro';
import fs from 'fs'
import path from 'path'

export const name = 'bella-sign-in'

export const usage = `
## 更新插件前请停止运行插件
插件配置项可能会有改动，不停止插件直接更新可能会导致koishi炸掉  

## 使用说明
插件内置4张涩图，可以开箱即用  
imgurl支持本地文件夹绝对路径和http(s) url直接返回图片的api  
随机文件夹内图片时请注意路径\`C:/user/path/to/\`不要把后面的/忘了   

## api说明
* api url以 #e# 结尾可以在末尾添加更新时间戳(例子后面等价的数字为当前时间戳)  
* 例: https://api.example.com/img?#e#  ==等价于== https://api.example.com/img?271878  
* 例: https://api.example.com/img?type=acc&v=#e#  ==等价于== https://api.example.com/img?type=acc&v=271878  
`

export interface Config {
  superuser: string[],
  imgurl: string,
  signpointmax: number,
  signpointmin: number,
  lotteryOdds: number,
  callme: boolean,
  waittip: boolean,
}

export const Config: Schema<Config> = Schema.object({
  superuser: Schema.array(String)
  .description('超级用户id'),
  imgurl: Schema.string().role('link')
  .description('随机横图api'),
  signpointmin: Schema.number().default(1)
  .description('签到积分随机最小值'),
  signpointmax: Schema.number().default(100)
  .description('签到积分随机最大值'),
  lotteryOdds: Schema.percent().default(0.6)
  .description('抽奖指令中倍率的概率(默认0.6)'),
  callme: Schema.boolean().default(false)
  .description("启用callme(需要安装callme插件)"),
  waittip: Schema.boolean().default(false)
  .description("启用渲染提示"),
})

export const inject = ['database','puppeteer']

const logger = new Logger('[贝拉签到]>> ');

export function apply(ctx: Context, config: Config) {
      // 构建signin类
  const signin = new Signin(ctx, config);
  // 主命令
  ctx.command("bella", "贝拉菜单").alias("贝拉菜单")
  .action(async ({session}) => {
    return <>
      bellaBot&gt;&gt;贝拉菜单&lt;&lt;bellaBot&#10;
      signin---&gt;每日签到,别名: 签到&#10;
      workstart---&gt;开始打工&#10;别名: 开始打工&#10;
      最少30分钟，最多8(+9)小时&#10;
      workstop---&gt;停止打工&#10;别名: 结束打工&#10;
      workstatus---&gt;打工状态&#10;别名: 打工查询&#10;
      lottery---&gt;抽奖,别名: 抽奖&#10;
      用法: 抽奖 20&&#10;
      shop---&gt;积分商店,别名: 商店&#10;
      givepiontshop---&gt;积分补给&#10;别名: 积分补充(仅允许超级用户)&#10;
      用法: 积分补充 123 @xxxxx
      rank---&gt;积分排行榜,别名: 积分榜
    </>
  })

  // 签到命令
  ctx.command("bella/signin", "贝拉签到").alias("签到")
  .option('text','-t 纯文本输出')
  .userFields(['name'])
  .action(async ({session, options}) => {
    const jrys = new jryspro();
    const date = new Date();
    const jrysData:any = await jrys.getJrys(session.userId? session.userId:2333);

    var name:any;
    if (ctx.database && config.callme) name = session.username;
    if (!name && config.callme) name = session.author.name;
    else name = session.username;
    name = name.length>12? name.substring(0,12):name;
    
    let bgUrl;
    let etime = (new Date().getTime())%25565;
    let filePath = resolve(__dirname, "./index/defaultImg/").replaceAll("\\", '/');
    if (!config.imgurl) bgUrl = pathToFileURL(resolve(__dirname, filePath+"/"+(Random.pick(await getFolderImg(filePath))))).href;
    else if(config.imgurl.match(/http(s)?:\/\/(.*)/gi))  bgUrl = (config.imgurl.match(/^http(s)?:\/\/(.*)#e#$/gi))? config.imgurl.replace('#e#',etime.toString()) : config.imgurl;
    else bgUrl = pathToFileURL(resolve(__dirname, (config.imgurl + Random.pick(await getFolderImg(config.imgurl))))).href;

    // 数据结构 { "cmd":"get", "status": 1, "getpoint": signpoint, "signTime": signTime, "allpoint": signpoint, "count": 1 };
    const getSigninJson = await signin.callSignin(session);
    let lvline = signin.levelJudge(Number(getSigninJson.allpoint)).level_line;

    if (options.text) return <><at id={session.userId} />{getSigninJson.status? "签到成功！" : "今天已经签到过啦！"},本次签到获得积分:{getSigninJson.getpoint}</>

    if (config.waittip) await session.send("请稍等，正在渲染……");

    let page: Page;
    try {
      let templateHTML = fs.readFileSync(path.resolve(__dirname, "./index/template.txt"), "utf-8");
      let template = templateHTML.replace("##todayExp##", getSigninJson.getpoint.toString()).replace("##totalExp##", getSigninJson.allpoint.toString())
      .replace("##level##", (signin.levelJudge(Number(getSigninJson.allpoint))).level.toString())
      .replace("##bgUrl##", bgUrl)
      .replace("##avatarUrl##", session.platform == 'qq'? `http://q.qlogo.cn/qqapp/${session.bot.config.id}/${session.event.user?.id}/640`:session.author.avatar)
      .replace("##signinText##", getSigninJson.status? "签到成功！" : "今天已经签到过啦！").replace("##date##", (date.getMonth()+1) + "/" + date.getDate())
      .replace("##hello##", signin.getGreeting(date.getHours())).replace("##user##", name)
      .replace("##persent##", (Number(getSigninJson.allpoint)/lvline*100).toFixed(3).toString()).replace("##signTxt##", jrysData.signText).replace("##fortunate##", jrysData.fortuneSummary)
      .replace("##luckystar##", jrysData.luckyStar)

      await fs.writeFileSync(path.resolve(__dirname, "./index/index.html"), template);

      page = await ctx.puppeteer.page();
      await page.setViewport({ width: 600, height: 1080 * 2 });
      await page.goto(`file:///${resolve(__dirname, "./index/index.html")}`);
      await page.waitForSelector("#body");
      const element = await page.$("#body");
      return h.image(await element.screenshot({
              encoding: "binary"
            }), "image/png")
    } catch (err) {
      logger.error(`[bella-sign-in Error]:\r\n`+err);
      return <>哪里出的问题！md跟你爆了！</>
    }
  })

  // 抽奖部分
  ctx.command('bella/lottery <count:number>', '贝拉抽奖！通过消耗签到积分抽奖', { minInterval: 0.2*60000 }).alias("抽奖")
  .userFields(['name'])
  .action(async ({session},count:number) => {
    const result = await signin.lottery(session, count);
    return result;
  })

  // 打工部分
  ctx.command('bella/workstart', '开始通过打工获取积分', { minInterval: 0.2*60000 }).alias("开始打工").alias("打工开始")
  .userFields(['name'])
  .action(async ({session}) => {
    const result = await signin.workstart(session);
    return result;
  })
  ctx.command('bella/workend', '结束打工', { minInterval: 0.2*60000 }).alias("结束打工").alias("打工结束")
  .userFields(['name'])
  .action(async ({session}) => {
    const result = await signin.workend(session);
    return result;
  })
  // 打工查询
  ctx.command('bella/workcheck', '查询打工情况', { minInterval: 0.1*60000 }).alias("打工查询")
  .userFields(['name'])
  .action(async ({session}) => {
    const result = await signin.workcheck(session);
    return result;
  })
  // 积分补充
  ctx.command('bella/givepoint__ <count:number> [user:user]', '给予用户积分').alias("积分补充").alias("给积分")
  .option('subtract', '-s 减积分')
  .action(async ({session,options}, count, user) => {
    if (options.subtract) count = -count;
    if (config.superuser.includes(session.userId)) {
      const result = await signin.givepoint(session, count, user);
      return result;
    } else return <>杂鱼大哥哥没有权限呢~♥</>
  })
  // 积分商店
  ctx.command('bella/shop', '贝拉商店').alias("积分商店").alias("积分商城")
  .action(async ({session})=>{
    const result = await signin.shop(session);
    return result;
  })

  ctx.command('bella/rank [userCount:number]', '查看积分排行榜(显示前n位最多50)').alias("积分榜").alias("排行榜")
  .action(async (_, userCount)=>{
    let ucnt = userCount? userCount<50? userCount:50:10;
    const result = await signin.rankUsers(ucnt);
    return <html style="font-family: Arial, sans-serif; background-color: #f4f4f9; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center;max-width: 360px;">
      <table style="border-collapse: collapse; width: 95%; margin: 20px 0; font-size: 18px; text-align: left;height: 95vh">
      <caption style="caption-side: top; font-size: 24px; margin-bottom: 10px; font-weight: bold;">排行榜</caption>
      <thead>
        <tr>
          <th style="padding: 12px; border: 1px solid #ddd; background-color: #4CAF50; color: white;">排名</th>
          <th style="padding: 12px; border: 1px solid #ddd; background-color: #4CAF50; color: white;">用户</th>
          <th style="padding: 12px; border: 1px solid #ddd; background-color: #4CAF50; color: white;">积分</th>
        </tr>
      </thead>
      <tbody>
        {result}
      </tbody>
      </table>
    </html>
  })
}

async function getFolderImg(folder:string) {
  let imgfilename = await readFilenames(folder);
  const filteredArr = imgfilename.filter((filename) => {
    return /\.(png|jpg|jpeg|ico|svg)$/i.test(filename);
  });
  return filteredArr;
}

// 递归获取文件夹内所有文件的文件名
async function readFilenames(dirPath:string) {
  let filenames = [];
  const files = fs.readdirSync(dirPath);
  files.forEach((filename) => {
    const fullPath = path.join(dirPath, filename);
    if (fs.statSync(fullPath).isDirectory()) {
      filenames = filenames.concat(readFilenames(fullPath));
    } else {
      filenames.push(filename);
    }
  });
  return filenames;
}

