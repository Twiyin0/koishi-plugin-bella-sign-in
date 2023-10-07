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
  superuser: string[],
  imgurl: string,
  signpointmax: number,
  signpointmin: number,
  lotteryOdds: number,
}

export const Config: Schema<Config> = Schema.object({
  superuser: Schema.array(String)
  .description('超级用户id'),
  imgurl: Schema.string().role('link').required()
  .description('随机横图api'),
  signpointmin: Schema.number().default(1)
  .description('签到积分随机最小值'),
  signpointmax: Schema.number().default(100)
  .description('签到积分随机最大值'),
  lotteryOdds: Schema.percent().default(0.6)
  .description('抽奖指令中倍率的概率(默认0.6)')
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
  working: boolean
  stime: number
  wpoint: number
  wktimecard: number
  wktimespeed: boolean
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
  { level: 8, level_line:170000 },
  { level: 9, level_line:350000 },
  { level:10, level_line:800000 },
];

export function apply(ctx: Context,config: Config) {
  // 数据库创建新表
  ctx.database.extend("bella_sign_in", {
    id: "string",
    time: "string",
    point: "unsigned",
    count: "unsigned",
    current_point: "unsigned",
    working: "boolean",
    stime: "unsigned",
    wpoint: "unsigned",
    wktimecard: "unsigned",
    wktimespeed: "boolean"
  })
  // 主命令
  ctx.command('bella', '^v^贝拉签到-^-', { minInterval: Time.minute })
  .action(async ({session}) => {
    if (!session.isDirect)
      return <>
      signin 签到获得积分,别名:签到&#10;
      signinquery 签到信息查询,别名:签到查询&#10;
      lottery 积分抽奖,别名:抽奖&#10;
      workstart 开始打工(0.5~8(+9)小时),别名:开始打工&#10;
      workend 结束打工获取积分(与等级相关)别名:结束打工&#10;
      workcheck 查看打工情况,别名:打工查询&#10;
      givepoint 积分补充,给自己或别人补充积分&#10;
      shop   积分商店，可以买一些可用的东西&#10;
      </>
  })
  // 签到本体
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
          return render(session.username,true,signpoint,1,signTime,signpoint,ctx,config.imgurl);
    }
    if (Number(time.slice(8,10)) - Number(signTime.slice(8,10)) && !session.isDirect) {
      await ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), time: signTime, point: Number(all_point+signpoint), count: count+1, current_point: Number(signpoint) }]);
      logger.info(`${session.username}(${session.userId}) 签到成功！`)
      if (!session.isDirect && options.text)
        return <>
        <at id={session.userId} />签到成功!&#10;{signText}&#10;获得积分：{signpoint}
        </>
      else if (!session.isDirect) 
          return render(session.username,true,all_point+signpoint,count+1,signTime,signpoint,ctx,config.imgurl);
    }
    if (!session.isDirect && options.text)
      return <>
      <at id={session.userId} />今天已经签到过了哦，明天再来吧！&#10;本次获得积分: {current_point? current_point:'暂无数据'}
      </>
    else if (!session.isDirect)
      return render(session.username,false,all_point,count,time,current_point,ctx,config.imgurl);
  })
  // 查询命令
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
      当前积分: {all_point} &#10;
      签到次数: {count}&#10;
      本次签到时间: {time}&#10;
      本次获得积分: {current_point? current_point:'暂无数据'}
      </>
    else if (!session.isDirect) 
      return render(session.username,false,all_point,count,time,current_point,ctx,config.imgurl);
  })
  // 抽奖部分
  ctx.command('bella/lottery <count:number>', '贝拉抽奖！通过消耗签到积分抽奖', { minInterval: 0.2*Time.minute }).alias('抽奖')
  .action(async ({session},count:number) => {
    let all_point:number = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    if (!count || count<0) {logger.info(`用户{${session.username}(${session.userId})} 参数错误!`);return '请输入有效积分';}
    else if (all_point-count<0) {logger.info(`用户{${session.username}(${session.userId})} 积分不足!`); return '您的积分不足';}
    else {
      if(Random.bool(config.lotteryOdds)) {
        var result:any = rangePoint(count);
        await ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), point: Number(all_point-count+result.final_point) }]);
        logger.info(`用户{${session.username}(${session.userId})} 消耗${count}积分获得${result.final_point}积分!`);
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
  // 打工部分
  ctx.command('bella/workstart', '开始通过打工获取积分', { minInterval: 0.5*Time.minute }).alias('开始打工')
  .action(async ({session}) => {
    let working = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.working;
    let wktimecard = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimecard;
    let nowTime:number = Math.floor(Date.now()/1000/60)
    if (working) return <>{session.username}打工任务正在进行，可以使用"结束打工"结束任务</>
    else {
      await ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), working: true, stime: nowTime}]);
      return <>{session.username}打工开始^v^&#10;Tip: 打工时间最少半小时，最多为{8+wktimecard}小时哦~</>
    }
  })
  ctx.command('bella/workend', '结束打工', { minInterval: 0.3*Time.minute }).alias('结束打工')
  .action(async ({session}) => {
    let all_point = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    let working = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.working;
    let stime = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.stime;
    let wpoint = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wpoint;
    let wktimecard = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimecard;
    let wkspeed = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimespeed;
    let nowTime:number = Math.floor(Date.now()/1000/60)
    if(working) {
      await ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), working: false}]);
      var time:number = nowTime-stime;
      time = wktimecard? (time>=(8+wktimecard)*60? (8+wktimecard)*60:time):(time>=8*60? 8*60:time);
      var point:number = time<30? 0:(wkspeed? Math.floor((time)*(levelJudge(all_point).level)):Math.floor((time/2)*(levelJudge(all_point).level)));
      await ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), point: all_point+point, wpoint: wpoint+point}]);
      return <>{session.username}打工结束啦！&#10;本次打工{Math.floor(time/60)}小时{time%60}分钟&#10;获得积分:{point}</>
    }
    else
      return <>{session.username}还没有正在进行的打工任务哦,使用"开始打工"命令可以进行打工哦</>
  })
  // 打工查询
  ctx.command('bella/workcheck', '查询打工情况', { minInterval: 0.1*Time.minute }).alias('打工查询')
  .action(async ({session}) => {
    let all_point = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    let working = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.working;
    let stime = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.stime;
    let wpoint = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wpoint;
    let nowTime:number = Math.floor(Date.now()/1000/60)
    var time:number = nowTime-stime;
    let wktimecard = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimecard;
    let wkspeed = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimespeed;
    time = wktimecard? (time>=(8+wktimecard)*60? (8+wktimecard)*60:time):(time>=8*60? 8*60:time);
    return <>
    {session.username}{working? '正在打工':'当前没有打工'}&#10;
    打工时间: {working? `${Math.floor(time/60)}小时${time%60}分钟`:'暂无信息'}&#10;
    可获积分: {working? (time<30? 0:(wkspeed? Math.floor((time)*(levelJudge(all_point).level)):Math.floor((time/2)*(levelJudge(all_point).level)))):0}&#10;
    打工总获得积分: {wpoint? wpoint:0}
    </>
  })

  ctx.command('bella/givepoint <count:number> [user:user]', '给予用户积分', { authority: 3 }).alias('补充积分').alias('积分补充')
  .option('subtract', '-s 减积分')
  .action(async ({session,options}, count, user) => {
    let all_point = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    if (!user) user = session.userId;
    if (!count) return <>请输入有效数字</>
    if (options.subtract && all_point-count<=0) return <>对方没有这么多积分</>
    else if (config.superuser.includes(session.userId)) {
      await ctx.database.upsert('bella_sign_in', [{ id: (String(user.replace(/.*:/gi,''))), point: (options.subtract)? all_point-count:all_point+count}]);
      return <>成功给<at id={user.replace(/.*:/gi,'')}/>{(options.subtract)? "减去":"补充"}{count}点积分.</>
    }
    else {
      return <>没有权限!</>
    }
  })

  ctx.command('bella/shop', '贝拉商店').alias('积分商店')
  .action(async ({session})=>{
    var shoptimes = 5;
    await session.send(<>
      所有商品: &#10;
      序号  名称    价格（积分）&#10;
      1. 打工加时卡 3000&#10;
      2. 打工翻倍卡 6000&#10;
      请输入序号购买，$取消购买
      </>);
    while (shoptimes) {
      // 等待用户输入序号
      let sel = await session.prompt(30000);
      if (sel=='$') return <>取消购买，欢迎下次光临!</>
      else
        await session.send(<>{await shopJudge(ctx,session,Number(sel))}&#10;可以继续输入序号购买商品哦~(最多5次)</>);
      shoptimes--;
    }
    return <>连续购买次数上限，请重新使用"积分商店"命令</>
  })
}

// 辅助函数 //
function pointJudge(point:number) {
  let msg = '喵？';
  if (point<=10) msg = Random.pick(['今天运势不佳捏','你脸好黑嗷','哇啊啊，非酋！','欸欸欸！怎么会这样呢']);
  if (point>10&&point<=40) msg = Random.pick(['今天脸比较黑嗷','早上忘记洗脸脸了嘛','出门捡不到一块钱呢']);
  if (point>40&&point<=70) msg = Random.pick(['一般一般','感觉良い！！','小手一撑，与世无争！']);
  if (point>70&&point<=90) msg = Random.pick(['哇哦，今天也是元气满满的一天呢','出门会不会捡到一块钱捏','这就去垃圾堆翻翻看有没有金项链！']);
  if (point>90) msg = Random.pick(['大……大欧皇！！','欧狗！吃俺一矛！','可恶，这事居然被你撞上了！','要娶上富婆了嘛！']);
  return msg;
}

async function render(uname:string,signin:boolean,all_point:number,count:number,last_sign:string,current_point:string|number,ctx: Context,cfg:string) {
  var getword = await ctx.http.get('https://v1.hitokoto.cn/?c=b')
  let word = getword.hitokoto;
  let author = getword.from;
  let lvline = levelJudge(all_point).level_line;
  return <html style={{width:'360px'}}>
  <div style={{width:'100%'}}>
    <div style={{width: '100%'}}>
        <img style={{width: '100%'}} src={cfg} />
    </div>
    <div style={{width: '100%',margin: '5px'}}>
    <div style={{width: '100%',height:'4.0rem',display: 'flex'}}>
        <div style={{width: '65%',height: '100%'}}>
            <p style={{color:'black','font-size': '1.6rem'}}><strong>{signin? '签到成功!':'本次已签!'}</strong></p>
        </div>
        <div style={{width: '35%',height: '100%'}}>
            <p style={{'font-size': '1.8rem','margin-left': '0%'}}> {`${new Date().getMonth()+1}月${new Date().getDate()}日`} </p>
        </div>
    </div>
    <div style={{width: '100%',height: 'auto'}}>
        <label for="fuel" style={{color: 'rgb(204, 84, 14)','font-size': '1.4rem'}}>level {levelJudge(all_point).level}</label>
        <meter id="fuel" style={{width: '97%',height: '32px'}}
        min="0"
        max={String(lvline)}
        low={String(lvline*0.7)}
        high={String(lvline*0.8)}
        optimum={String(lvline*0.85)}
        value={String(all_point)}
      ></meter>
    </div>
    <div style={{width: '100%',display: 'flex'}}>
        <div style={{width: '50%','font-size': '1.1rem'}}>
            <p>
            本次获得积分: {current_point}<br/>
            当前积分: {all_point}<br/>
            签到等级: {levelJudge(all_point).level}<br/>
            签到次数: {count}<br/>
            本次签到时间:<br/>{last_sign}</p>
        </div>
        <div style={{width: '46%','font-size': '1.0rem'}}>
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
  var cnt = Random.int(0,8)  // 0.2 0.5 0.8 1.2 1.5 2.0 3.0 4.0 1.0
  let result = {
    final_point: 0,
    msg: 'string'
  }
  switch(cnt) {
    case 0: result = {final_point: Math.floor(count*0.2), msg: "哈哈，赌狗！"}; break;
    case 1: result = {final_point: Math.floor(count*0.5), msg: "伤害减半！"};   break;
    case 2: result = {final_point: Math.floor(count*0.8), msg: "不过如此"};     break;
    case 3: result = {final_point: Math.floor(count*1.2), msg: "运气不错！"};   break;
    case 4: result = {final_point: Math.floor(count*1.5), msg: "哇哦！欧皇！"}; break;
    case 5: result = {final_point: Math.floor(count*2.0), msg: "双倍泰裤辣！"}; break;
    case 6: result.final_point = (Random.bool(0.5))? Math.floor(count*3.0):count; result.msg = (result.final_point-count)? "3倍！这是甚么运气！": "欸嘿，虚晃一枪!"; break;
    case 7: result.final_point = (Random.bool(0.3))? Math.floor(count*4.0):count; result.msg = (result.final_point-count)? "太可怕了！是有什么欧皇秘诀吗": "欸嘿，虚晃一枪!"; break;
    default: result.final_point = count; result.msg = "欸嘿，虚晃一枪!"; break;
  }

  return result;
}

async function shopJudge(ctx:Context, session:any, select:number|string) {
  let wktimecard = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimecard;
  let wktimespeed = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimespeed;
  let all_point = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;

  if (Number(select)==1) {
    var point_condition = (all_point-3000 >= 0)? true:false;
    var shop_cnt = wktimecard<=8? true:false;
    if (point_condition && shop_cnt) {
      await ctx.database.upsert('bella_sign_in', [{ id: String(session.userId), point: all_point-3000, wktimecard: wktimecard+1}]);
      return '购买成功！打工时长上限+1h(上限不得超过9h)'
    } else if (!point_condition) return '积分不足!';
    else return '购买次数达到上限'
  }
  if (Number(select)==2) {
    var point_condition = (all_point-6000 >= 0)? true:false;
    if (point_condition && !wktimespeed) {
      await ctx.database.upsert('bella_sign_in', [{ id: String(session.userId), point: all_point-3000, wktimespeed: true}]);
      return '购买成功！打工获取积分翻倍（购买后永久生效）'
    } else if (wktimespeed) return '您已购买此商品'
    else return '积分不足!'
  }
}
