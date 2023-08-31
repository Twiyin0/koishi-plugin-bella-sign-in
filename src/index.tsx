import { Context, Schema, Time, Random, Logger } from 'koishi'
import { } from '@koishijs/plugin-rate-limit'

export const name = 'bella-sign-in'

export const usage = `
## 使用说明
1、随机横图api目前只支持网络url,是必填项  
2、签到积分随机最大范围(最小为1)  

## 注意
作者的api不打算完全公开，如果想用作者的api可以选择降级到v0.1.x或者通过v0.1.x源码自己找  
`

export interface Config {
  imgurl: string,
  signpointmax: number,
  signpointmin: number
}

export const Config: Schema<Config> = Schema.object({
  imgurl: Schema.string().role('link').required()
  .description('随机横图api'),
  signpointmin: Schema.number().default(1)
  .description('签到积分随机最小值'),
  signpointmax: Schema.number().default(100)
  .description('签到积分随机最大值')
})

export const using = ['database','puppeteer']

const logger = new Logger('[贝拉签到]>> ')

declare module 'koishi' {
  interface Tables {
    bella_sign_in: Bella_sign_in
  }
}

export interface Bella_sign_in {
  id: string
  time: string
  point: number
  count: number
  current_point: number
}

interface TimeGreeting {
  range: [number, number];
  message: string;
}

const timeGreetings: TimeGreeting[] = [
  { range: [ 0,  6], message: '凌晨好' },
  { range: [ 6, 11], message: '上午好' },
  { range: [11, 14], message: '中午好' },
  { range: [14, 18], message: '下午好' },
  { range: [18, 20], message: '傍晚好' },
  { range: [20, 24], message: '晚上好' },
];

interface LevelInfo {
  level: number;
  level_line: number;
}

const levelInfos: LevelInfo[] = [
  { level: 1, level_line:  1000 },
  { level: 2, level_line:  3000 },
  { level: 3, level_line:  7000 },
  { level: 4, level_line: 15000 },
  { level: 5, level_line: 30000 },
  { level: 6, level_line: 50000 },
  { level: 7, level_line: 80000 },
];

export function apply(ctx: Context,config: Config) {
  // 数据库创建新表
  ctx.database.extend("bella_sign_in", {
    id: "string",
    time: "string",
    point: "unsigned",
    count: "unsigned",
    current_point: "unsigned"
  })

  ctx.command('bella/signin', '贝拉，签到!!', { minInterval: Time.minute }).alias('签到')
  .option('text','-t 纯文本输出')
  .action(async ({session,options}) => {
    let signTime =  Time.template('yyyy-MM-dd hh:mm:ss', new Date());
    let all_point = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    let time = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.time;
    let count = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.count;
    let current_point = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.current_point;
    let signpoint = Random.int(config.signpointmin,config.signpointmax);
    let signText = pointJudge(signpoint);
    if (!all_point && !time && !session.isDirect) {
      await ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), time: signTime, point: Number(signpoint), count: 1, current_point: Number(signpoint) }]);
      logger.info(`${session.username}(${session.userId}) 第一次签到成功，写入数据库！`)
      // 非私聊环境
      if (!session.isDirect && options.text)
        return <>
        <at id={session.userId} />签到成功!&#10;{signText}&#10;获得积分：{signpoint}
        </>
      else if (!session.isDirect) 
          return render(session.username,true,signpoint,1,signTime,signpoint,ctx,config);
    }
    if (Number(time.slice(8,10)) - Number(signTime.slice(8,10)) && !session.isDirect) {
      await ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), time: signTime, point: Number(all_point+signpoint), count: count+1, current_point: Number(signpoint) }]);
      logger.info(`${session.username}(${session.userId}) 签到成功！`)
      if (!session.isDirect && options.text)
        return <>
        <at id={session.userId} />签到成功!&#10;{signText}&#10;获得积分：{signpoint}
        </>
      else if (!session.isDirect) 
          return render(session.username,true,all_point+signpoint,count+1,signTime,signpoint,ctx,config);
    }
    if (!session.isDirect && options.text)
      return <>
      <at id={session.userId} />今天已经签到过了哦，明天再来吧！&#10;本次获得积分: {current_point? current_point:'暂无数据'}
      </>
    else if (!session.isDirect)
      return render(session.username,false,all_point,count,time,current_point,ctx,config);
  })

  ctx.command('bella/signinquery','贝拉签到积分查询',{ minInterval: Time.minute }).alias('签到查询').alias('积分查询')
  .option('text','-t 纯文本输出')
  .action(async ({session,options}) => {
    let all_point = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    let time = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.time;
    let count = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.count;
    let current_point = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.current_point;
    if (!session.isDirect && options.text)
      return <>
      <at id={session.userId} />签到信息如下: &#10;
      签到总积分: {all_point} &#10;
      签到次数: {count}&#10;
      本次签到时间: {time}&#10;
      本次获得积分: {current_point? current_point:'暂无数据'}
      </>
    else if (!session.isDirect) 
      return render(session.username,false,all_point,count,time,current_point,ctx,config);
  })
  // 抽奖部分
  ctx.command('bella/lottery <count:number>', '贝拉抽奖！通过消耗签到积分抽奖').alias('抽奖')
  .action(async ({session},count) => {
    let all_point:number = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    if (!count) {logger.info(`用户{${session.username}(${session.userId})} 参数错误!`);return '请输入消耗的积分';}
    else if (all_point-count<0) {logger.info(`用户{${session.username}(${session.userId})} 积分不足!`); return '您的积分不足';}
    else {
      if(Random.bool(0.4))  {
        var result:any = rangePoint(count);
        await ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), point: Number(all_point-count+result.final_point) }]);
        logger.info(`用户{${session.username}(${session.userId})} 消耗${count}积分抽取${result.final_point}!`);
        return <>
        <at id={session.userId}/>&#10;
        {result.msg} &#10;
        消耗{count}积分抽得: {result.final_point}积分
        </>
      }
      else {
        await ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), point: Number(all_point-count) }]);
        logger.info(`用户{${session.username}(${session.userId})} 白给${count}积分!`);
        return <>
        <at id={session.userId}/>&#10;
        获得积分:0&#10;
        {Random.pick([
          <>赌狗赌狗，赌到最后一无所有！</>
          ,<>哦吼，积分没喽！</>
          ,<>谢谢你的积分！</>
          ,<>积分化作了尘埃</>
          ,<>哈哈！大大大非酋</>
          ,<>杂鱼♡~大哥哥连这点积分都赌掉了呢~</>
          ,<>杂鱼♡~杂鱼♡~</>
          ,<>摸摸，杂鱼大哥哥不哭~</>
        ])}
        </>
      }
    }
  })
}

function pointJudge(point:number) {
  let msg = '喵？';
  if (point<=10) msg = Random.pick(['今天运势不佳捏','你脸好黑嗷','哇啊啊，非酋！','欸欸欸！怎么会这样呢']);
  if (point>10&&point<=40) msg = Random.pick(['今天脸比较黑嗷','早上忘记洗脸脸了嘛','出门捡不到一块钱呢']);
  if (point>40&&point<=70) msg = Random.pick(['一般一般','感觉良い！！','小手一撑，与世无争！']);
  if (point>70&&point<=90) msg = Random.pick(['哇哦，今天也是元气满满的一天呢','出门会不会捡到一块钱捏','这就去垃圾堆翻翻看有没有金项链！']);
  if (point>90) msg = Random.pick(['大……大欧皇！！','欧狗！吃俺一矛！','可恶，这事居然被你撞上了！','要娶上富婆了嘛！']);
  return msg;
}

async function render(uname:string,signin:boolean,all_point:number,count:number,last_sign:string,current_point:string|number,ctx: Context,cfg:Config) {
  var getword = await ctx.http.get('https://v1.hitokoto.cn/?c=b')
  let word = getword.hitokoto;
  let author = getword.from;
  let lvline = levelJudge(all_point).level_line;
  return <html>
  <div style={{width:'720px'}}>
    <div style={{width: '720px'}}>
        <img style={{width: '100%',display: 'flex','align-items': 'center'}} src={cfg.imgurl} />
    </div>
    <div style={{width: '720px',margin: '1rem'}}>
    <div style={{width: '100%',height:'6.2rem',display: 'flex'}}>
        <div style={{width: '75%',height: '100%'}}>
            <p style={{color:'black','font-size': '2.5rem'}}><strong>{signin? '签到成功!':'本次已签!'}</strong></p>
        </div>
        <div style={{width: '25%',height: '100%'}}>
            <p style={{'font-size': '2.7rem','margin-left': '40%'}}> {`${new Date().getMonth()+1}/${new Date().getDate()}`} </p>
        </div>
    </div>
    <div style={{width: '720px',height: 'auto'}}>
        <label for="fuel" style={{color: 'rgb(204, 84, 14)','font-size': '1.8rem'}}>level {levelJudge(all_point).level}</label>
        <meter id="fuel" style={{width: '96%',height: '52px'}}
        min="0"
        max={String(lvline)}
        low={String(lvline*0.7)}
        high={String(lvline*0.8)}
        optimum={String(lvline*0.85)}
        value={String(all_point)}
      ></meter>
    </div>
    <div style={{width: '720px',display: 'flex'}}>
        <div style={{width: '50%','font-size': '1.8rem'}}>
            <p>本次获得积分: {current_point}<br/>
            签到总积分: {all_point}<br/>
            签到等级: {levelJudge(all_point).level}<br/>
            签到次数: {count}<br/>
            本次签到时间: {last_sign}</p>
        </div>
        <div style={{width: '46%','font-size': '1.4rem'}}>
          <p><strong>{getGreeting(new Date().getHours())},{uname}</strong></p>
          <p>{word}</p>
          <p>---来自《{author}》</p>
        </div>
    </div>
    </div>
  </div>
  </html>
}

function levelJudge(all_point: number): LevelInfo {
  for (const levelInfo of levelInfos) {
    if (all_point <= levelInfo.level_line) {
      return levelInfo;
    }
  }
  
  return levelInfos[levelInfos.length - 1]; // Default to the last level
}

function getGreeting(hour: number): string {
  const greeting = timeGreetings.find((timeGreeting) =>
    hour >= timeGreeting.range[0] && hour < timeGreeting.range[1]
  );

  return greeting ? greeting.message : '你好';
}

function rangePoint(count:number) {
  var cnt = Random.pick([0,1,2,3,4,5,6,7,8])  // 0.2 0.5 0.8 1.2 1.5 2.0 3.0 4.0
  let result = {
    final_point: 0,
    msg: 'string'
  }
  switch(cnt) {
    case 0: result.final_point = Math.floor(count*0.2); result.msg = "哈哈，赌狗！"; break;
    case 1: result.final_point = Math.floor(count*0.5); result.msg = "伤害减半！";break;
    case 2: result.final_point = Math.floor(count*0.8); result.msg = "不过如此";break;
    case 3: result.final_point = Math.floor(count*1.2); result.msg = "运气不错！";break;
    case 4: result.final_point = Math.floor(count*1.5); result.msg = "哇哦！欧皇！";break;
    case 5: result.final_point = Math.floor(count*2.0); result.msg = "双倍泰裤辣！";break;
    case 6: result.final_point = (Random.bool(0.5))? Math.floor(count*3.0):count; result.msg = (result.final_point-count)? "3倍！这是甚么运气！": "欸嘿，虚晃一枪!";break;
    case 7: result.final_point = (Random.bool(0.2))? Math.floor(count*4.0):count; result.msg = (result.final_point-count)? "太可怕了！是有什么欧皇秘诀吗": "欸嘿，虚晃一枪!";break;
    default: result.final_point = count; result.msg = "欸嘿，虚晃一枪!";break;
  }
  return result;
}
