import { Context, Schema, Time, Random, Logger } from 'koishi'
import { } from '@koishijs/plugin-rate-limit'

export const name = 'bella-sign-in'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

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

export function apply(ctx: Context) {
  // 数据库创建新表
  ctx.database.extend("bella_sign_in", {
    id: "string",
    time: "string",
    point: "unsigned",
    count: "unsigned",
    current_point: "unsigned"
  })

  ctx.command('bellasignin', '贝拉，签到!!', { minInterval: Time.minute }).alias('签到')
  .option('text','-t 纯文本输出')
  .action(async ({session,options}) => {
    let signTime =  Time.template('yyyy-MM-dd hh:mm:ss', new Date());
    let all_point = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    let time = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.time;
    let count = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.count;
    let current_point = (await ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.current_point;
    let signpoint = Random.int(1,100);
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
          return render(session.username,true,signpoint,1,signTime,signpoint,ctx);
    }
    if (Number(time.slice(8,10)) - Number(signTime.slice(8,10)) && !session.isDirect) {
      await ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), time: signTime, point: Number(all_point+signpoint), count: count+1, current_point: Number(signpoint) }]);
      logger.info(`${session.username}(${session.userId}) 签到成功！`)
      if (!session.isDirect && options.text)
        return <>
        <at id={session.userId} />签到成功!&#10;{signText}&#10;获得积分：{signpoint}
        </>
      else if (!session.isDirect) 
          return render(session.username,true,all_point,count,time,current_point,ctx);
    }
    if (!session.isDirect && options.text)
      return <>
      <at id={session.userId} />今天已经签到过了哦，明天再来吧！&#10;本次获得积分: {current_point? current_point:'暂无数据'}
      </>
    else if (!session.isDirect)
      return render(session.username,false,all_point,count,time,current_point,ctx);
  })

  ctx.command('bellasigninquery','贝拉签到积分查询',{ minInterval: Time.minute }).alias('签到查询').alias('积分查询')
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
      return render(session.username,false,all_point,count,time,current_point,ctx);
  })
  ctx.on('message',async (session)=>{
    var getword = await ctx.http.get('https://v1.hitokoto.cn/?c=b')
    // getword = JSON.parse(getword.toString());
    if (session.content=="TTTest")
      session.send((getword.hitokoto))
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

async function render(uname:string,signin:boolean,all_point:number,count:number,last_sign:string,current_point:string|number,ctx: Context) {
  var getword = await ctx.http.get('https://v1.hitokoto.cn/?c=b')
  let word = getword.hitokoto;
  let author = getword.from;
  return <html>
  <div style={{width:'720px'}}>
    <div style={{width: '720px'}}>
        <img style={{width: '100%',display: 'flex','align-items': 'center'}} src="https://api.iin0.cn/img/acc?type=webp" />
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
        max={String(levelJudge(all_point).level_line)}
        low={String((levelJudge(all_point).level_line)*0.4)}
        high={String((levelJudge(all_point).level_line)*0.6)}
        optimum={String((levelJudge(all_point).level_line)*0.7)}
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
        <div style={{width: '46%','font-size': '1.5rem'}}>
          <p><strong>{noonJudge()},{uname}</strong></p>
          <p>{word}</p>
          <p>---来自《{author}》</p>
        </div>
    </div>
    </div>
  </div>
  </html>
}

function levelJudge(all_point:number) {
  let lvl = {
    level: 0,
    level_line: 0
  }
  if (all_point <= 1000) {lvl.level = 1; lvl.level_line = 1000}
  if (all_point > 1000 && all_point <=3000) {lvl.level = 2; lvl.level_line = 3000}
  if (all_point > 3000 && all_point <=7000) {lvl.level = 3; lvl.level_line = 7000}
  if (all_point > 7000 && all_point <=15000) {lvl.level = 4; lvl.level_line = 15000}
  if (all_point > 15000 && all_point <=25000) {lvl.level = 5; lvl.level_line = 25000}
  if (all_point > 25000 && all_point <=40000) {lvl.level = 6; lvl.level_line = 40000}
  if (all_point > 40000) {lvl.level = 7; lvl.level_line = 60000}
  return lvl;
}

function noonJudge() {
  let date = new Date();
  let hour = date.getHours();
  if ( 0>=hour && hour< 6)  return '凌晨好';
  if ( 6>=hour && hour<11)  return '上午好';
  if (11>=hour && hour<14)  return '中午好';
  if (14>=hour && hour<18)  return '下午好';
  if (18>=hour && hour<20)  return '傍晚好';
  if (20>=hour && hour<=23) return '晚上好';
}
