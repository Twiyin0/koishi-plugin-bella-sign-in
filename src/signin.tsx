import { Context, Time, Random } from 'koishi'
import type {} from 'koishi-plugin-monetary'
import {
  getDiceCost,
  evaluateDice,
  MAX_DICE_COST,
  normalizeRpsChoice,
  parseDiceNotation,
  playRps,
  randomRpsChoice,
  rollDice,
  rpsLabels,
} from './entertainment'

declare module 'koishi' {
  interface Tables {
    bella_sign_in: Bella_sign_in
  }
}

export interface Bella_sign_in {
  id: string
  name: string
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

export const inject = {
  required: ['database'],
  optional: ['monetary']
}

// 参数: ctx:Context, config?:Config
export class Signin {
  public ctx:Context;
  public cfg:any;
  private rpsDrawUsers = new Set<string>();
  constructor(context:Context, config:any) {
    this.ctx = context;
    this.cfg = config;
    this.ctx.database.extend("bella_sign_in", {
      id: "string",
      name: "string",
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
  }

  //                  0:已签到, 1:签到成功, 2:未签到, 3:抽奖
  // { "cmd":"get", "status": 1, "getpoint": signpoint, "signTime": signTime, "allpoint": signpoint, "count": 1 };
  // 参数：session， 返回：json
  async callSignin(session) {
    var name:any;
    if (this.ctx.database && this.cfg.callme) name = session.username;
    if (!name && this.cfg.callme) name = session.author.name;
    else name = session.username;
    name = name.length>12? name.substring(0,12):name;

    let signTime =  Time.template('yyyy-MM-dd hh:mm:ss', new Date());
    const userData = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0];
    let all_point = userData?.point;
    let time = userData?.time;
    let count = userData?.count;
    let dbname = userData?.name;
    let signpoint = Random.int(this.cfg.signpointmin,this.cfg.signpointmax);
    let nowPoint = userData?.current_point;
    if (!dbname) await this.ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), name: name }]);
    if (!all_point && !time) {
        if (this.ctx.monetary) await this.ctx.monetary.gain(session.user.id, signpoint, "Bella");
        await this.ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), name: name, time: signTime, point: Number(signpoint), count: 1, current_point: Number(signpoint) }]);
        // logger.info(`${name}(${session.userId}) 第一次签到成功，写入数据库！`)
        return { "cmd":"get", "status": 1, "getpoint": signpoint, "signTime": signTime, "allpoint": signpoint, "count": 1 };
    }
    if (!time || time.slice(0, 10) !== signTime.slice(0, 10)) {
        if (this.ctx.monetary) await this.ctx.monetary.gain(session.user.id, signpoint, "Bella");
        await this.ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), name: name, time: signTime, point: Number((all_point || 0)+signpoint), count: (count || 0)+1, current_point: Number(signpoint) }]);
        // logger.info(`${name}(${session.userId}) 签到成功！`)
        return { "cmd":"get", "status": 1, "getpoint": signpoint, "signTime": signTime, "allpoint": (all_point || 0)+signpoint, "count": (count || 0)+1 };
    }
    return { "cmd":"get", "status": 0, "getpoint": nowPoint, "signTime": signTime, "allpoint": all_point, "count": count };
  }

  // 参数：session， 返回：json
  async signQuery(session) {
    const userData = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0];
    let all_point = userData?.point;
    let time = userData?.time;
    let count = userData?.count;
    let current_point = userData?.current_point;
    let nowTime =  Time.template('yyyy-MM-dd hh:mm:ss', new Date());
    if (!time || time.slice(0, 10) !== nowTime.slice(0, 10)) {
        return { "cmd":"query", "status": 2, "getpoint": current_point? current_point:0, "signTime": time? time:"暂无数据", "allpoint": all_point? all_point:0, "count": count? count:0 };
    }
    return { "cmd":"query", "status": 0, "getpoint": current_point? current_point:0, "signTime": time? time:"暂无数据", "allpoint": all_point? all_point:0, "count": count? count:0 };
  }

  // 参数：session，point 返回：<> <at />string </>
  async lottery(session, point) {
    let all_point:number = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    if (!point || point < 0 || isNaN(Number(point))) return "请输入有效积分";
    else if (all_point-point < 0) return "积分不足!";
    else {
    if(Random.bool(this.cfg.lotteryOdds)) {
        if (this.ctx.monetary) await this.ctx.monetary.cost(session.user.id, point, "Bella");
        var result:any = this.rangePoint(point);
        if (this.ctx.monetary) await this.ctx.monetary.gain(session.user.id, result.final_point, "Bella");
        await this.ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), point: Number(all_point-point+result.final_point) }]);
        return <>
        <at id={session.userId}/>&#10;
        {result.msg} &#10;
        消耗{point}积分抽得: {result.final_point}积分
        </>
    }
    else {
        if (this.ctx.monetary) await this.ctx.monetary.cost(session.user.id, point, "Bella");
        await this.ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), point: Number(all_point-point) }]);
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
  }

  async rockPaperScissors(session, choice: string, bet = 0) {
    const playerChoice = normalizeRpsChoice(choice)
    if (!playerChoice) return '请选择“石头”、“剪刀”或“布”。例如：猜拳 石头 100'

    bet = Number(bet ?? 0)
    const configuredMaxBet = Number(this.cfg.gameMaxBet ?? 1000)
    const maxBet = Number.isFinite(configuredMaxBet) ? Math.max(0, Math.floor(configuredMaxBet)) : 1000
    if (!Number.isInteger(bet) || bet < 0) return '押注积分必须是大于等于 0 的整数。'
    if (bet > maxBet) return `单次押注不能超过 ${maxBet} 积分。`

    let allPoint: number | undefined

    if (bet > 0) {
      const userData = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]
      if (!userData) return '请先签到一次，再来押积分猜拳哦。'
      allPoint = Number(userData.point || 0)
      if (allPoint < bet) return `积分不足！你目前有 ${allPoint} 积分。`
    }

    const userId = String(session.userId)
    const protectedRound = this.rpsDrawUsers.delete(userId)
    const computerChoice = randomRpsChoice(protectedRound ? playerChoice : undefined)
    const result = playRps(playerChoice, computerChoice)
    if (result.outcome === 'draw') this.rpsDrawUsers.add(userId)

    const resultText = result.outcome === 'win' ? '你赢啦！' : result.outcome === 'draw' ? '平局，下一拳必定分出胜负！' : '贝拉赢啦！'
    let pointText = '本局没有押注积分。'

    if (bet > 0) {
      if (result.outcome === 'win') {
        await this.ctx.database.upsert('bella_sign_in', [{ id: String(session.userId), point: allPoint! + bet }])
        if (this.ctx.monetary) await this.ctx.monetary.gain(session.user.id, bet, 'Bella')
        pointText = `赢得 ${bet} 积分，当前 ${allPoint! + bet} 积分。`
      } else if (result.outcome === 'lose') {
        await this.ctx.database.upsert('bella_sign_in', [{ id: String(session.userId), point: allPoint! - bet }])
        if (this.ctx.monetary) await this.ctx.monetary.cost(session.user.id, bet, 'Bella')
        pointText = `失去 ${bet} 积分，当前 ${allPoint! - bet} 积分。`
      } else {
        pointText = `平局退回 ${bet} 积分，当前仍有 ${allPoint} 积分。`
      }
    }

    return <>
      <at id={session.userId}/>&#10;
      你出了：{rpsLabels[playerChoice]}&#10;
      贝拉出了：{rpsLabels[result.computer]}&#10;
      {resultText} {pointText}
    </>
  }

  async diceGame(session, notation = '1d6') {
    const parsed = parseDiceNotation(notation)
    if (typeof parsed === 'string') return parsed

    const cost = getDiceCost(parsed)
    if (cost > MAX_DICE_COST) {
      return `本局需要 ${cost} 积分，超过单局 ${MAX_DICE_COST} 积分上限，请减少骰子数量或面数。`
    }

    const userData = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]
    if (!userData) return '请先签到一次，再来玩积分骰子哦。'
    const allPoint = Number(userData.point || 0)
    if (allPoint < cost) return `本局需要 ${cost} 积分，你目前只有 ${allPoint} 积分。`

    let dice = rollDice(parsed)
    let evaluation = evaluateDice(parsed, dice)
    while (!evaluation) {
      dice = rollDice(parsed)
      evaluation = evaluateDice(parsed, dice)
    }
    const { outcome, profit, reward } = evaluation
    const delta = reward - cost
    const finalPoint = allPoint + delta

    if (delta !== 0) {
      await this.ctx.database.upsert('bella_sign_in', [{ id: String(session.userId), point: finalPoint }])
      if (this.ctx.monetary) {
        if (delta > 0) await this.ctx.monetary.gain(session.user.id, delta, 'Bella')
        else await this.ctx.monetary.cost(session.user.id, Math.abs(delta), 'Bella')
      }
    }

    const outcomeText = outcome === 'win' ? '🎉 胜利' : outcome === 'draw' ? '🤝 平局' : '💥 失败'
    const rewardText = outcome === 'win'
      ? `返还本金并赢取 ${profit} 积分`
      : outcome === 'draw'
        ? `返还 ${reward} 积分（积分不变）`
        : `没有返奖（净亏 ${cost}）`

    return <>
      <at id={session.userId}/> 🎲 {parsed.count}d{parsed.sides}：[{dice.join(', ')}]，合计 {dice.reduce((sum, value) => sum + value, 0)}&#10;
      花费：{cost} 积分　点数组合权重：{(evaluation.percentile * 100).toFixed(2)}%&#10;
      结果：{outcomeText}&#10;
      {rewardText}&#10;
      当前积分：{finalPoint}
    </>
  }

  // 参数：session 返回：<>string</>
  async workstart(session) {
    var name:any;
    if (this.ctx.database && this.cfg.callme) name = session.user.name;
    if (!name && this.cfg.callme) name = session.author.name;
    else name = session.username;
    let working = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.working;
    let wktimecard = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimecard;
    let nowTime:number = Math.floor(Date.now()/1000/60)
    if (working) return <>{name}打工任务正在进行，可以使用"结束打工"结束任务</>
    else {
      await this.ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), working: true, stime: nowTime}]);
      return <>{name}打工开始^v^&#10;Tip: 打工时间最少半小时，最多为{8+wktimecard}小时哦~</>
    } 
  }

  // 参数：session 返回：<>string</>
  async workend(session) {
    var name:any;
    if (this.ctx.database && this.cfg.callme) name = session.user.name;
    if (!name && this.cfg.callme) name = session.author.name;
    else name = session.username;
    let all_point = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    let working = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.working;
    let stime = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.stime;
    let wpoint = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wpoint;
    let wktimecard = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimecard;
    let wkspeed = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimespeed;
    let nowTime:number = Math.floor(Date.now()/1000/60)
    if(working) {
      await this.ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), working: false}]);
      var time:number = nowTime-stime;
      time = wktimecard? (time>=(8+wktimecard)*60? (8+wktimecard)*60:time):(time>=8*60? 8*60:time);
      var point:number = time<30? 0:(wkspeed? Math.floor((time)*(this.levelJudge(all_point).level)):Math.floor((time/2)*(this.levelJudge(all_point).level)));
      await this.ctx.database.upsert('bella_sign_in', [{ id: (String(session.userId)), point: all_point+point, wpoint: wpoint+point}]);
      if (this.ctx.monetary) await this.ctx.monetary.gain(session.user.id, point, "Bella");
      
      return <>{name}打工结束啦！&#10;本次打工{Math.floor(time/60)}小时{time%60}分钟&#10;获得积分:{point}</>
    }
    else
      return <>{name}还没有正在进行的打工任务哦,使用"开始打工"命令可以进行打工哦</>
  }

  // 参数：session 返回：<>string</>
  async workcheck(session) {
    var name:any;
    if (this.ctx.database && this.cfg.callme) name = session.user.name;
    if (!name && this.cfg.callme) name = session.author.name;
    else name = session.username;
    let all_point = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    let working = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.working;
    let stime = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.stime;
    let wpoint = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wpoint;
    let nowTime:number = Math.floor(Date.now()/1000/60)
    var time:number = nowTime-stime;
    let wktimecard = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimecard;
    let wkspeed = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimespeed;
    time = wktimecard? (time>=(8+wktimecard)*60? (8+wktimecard)*60:time):(time>=8*60? 8*60:time);
    return <>
    {name}{working? '正在打工':'当前没有打工'}&#10;
    打工时间: {working? `${Math.floor(time/60)}小时${time%60}分钟`:'暂无信息'}&#10;
    可获积分: {working? (time<30? 0:(wkspeed? Math.floor((time)*(this.levelJudge(all_point).level)):Math.floor((time/2)*(this.levelJudge(all_point).level)))):0}&#10;
    打工总获得积分: {wpoint? wpoint:0}
    </>
  }

  // 参数：session，count，user 返回：<>string</>
  async givepoint(session, count?, user?) {
    let all_point = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
    if (!user) user = session.userId;
    if (!count) return <>请输入有效数字</>
    if (count<0 && all_point-Math.abs(count)<=0) return <>对方没有这么多积分</>
    else if (this.cfg.superuser.includes(session.userId)) {
      if (this.ctx.monetary) await this.ctx.monetary.gain(session.user.id, count, "Bella");
      await this.ctx.database.upsert('bella_sign_in', [{ id: (String(user.replace(/.*:/gi,''))), point: (count<0)? all_point-Math.abs(count):all_point+count}]);
      return <>成功给<at id={user.replace(/.*:/gi,'')}/>{(count<0)? "减去":"补充"}{count}点积分.</>
    }
    else {
      return <>没有权限!</>
    }
  }

  async shop(session) {
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
      if (sel=='$' || sel=='￥' || !sel) return <>取消购买，欢迎下次光临!</>
      else
        await session.send(<>{await this.shopJudge(session ,Number(sel))}&#10;可以继续输入序号购买商品哦~(最多5次)</>);
      shoptimes--;
    }
    return <>连续购买次数上限，请重新使用"积分商店"命令</>
  }

  async rankUsers(count) {
    const signinData = await this.ctx.database.get('bella_sign_in', {
      count: { $gt: 0 },
    })
    const sortedData = signinData.sort((a, b) => b.point - a.point)
    .slice(0, count)
    .map((item, index) => <tr style="background-color: #f2f2f2;">
    <td style="padding: 12px; border: 1px solid #ddd;">{index + 1}</td>
    <td style="padding: 12px; border: 1px solid #ddd;">{item.name? item.name:item.id}</td>
    <td style="padding: 12px; border: 1px solid #ddd;">{item.point}</td>
</tr>);
    // .map((item, index) => <p>{index + 1} &gt; {item.name? item.name:item.id} &gt; {item.point}</p>);
    // .map(item => ({ name: item.name? item.name:item.id, id: item.id, point: item.point }));
    return sortedData;
  }

  rangePoint(count:number) {
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

  levelJudge(all_point: number): LevelInfo {
    for (const levelInfo of levelInfos) {
      if (all_point <= levelInfo.level_line) {
        return levelInfo;
      }
    }
    
    return levelInfos[levelInfos.length - 1]; // Default to the last level
  }

  getGreeting(hour: number): string {
    const greeting = timeGreetings.find((timeGreeting) =>
        hour >= timeGreeting.range[0] && hour < timeGreeting.range[1]
    );
    
    return greeting ? greeting.message : '你好';
  }

  async shopJudge(session:any, select:number|string) {
    let wktimecard = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimecard;
    let wktimespeed = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.wktimespeed;
    let all_point = (await this.ctx.database.get('bella_sign_in', { id: String(session.userId) }))[0]?.point;
  
    if (Number(select)==1) {
      var point_condition = (all_point-3000 >= 0)? true:false;
      var shop_cnt = wktimecard<=8? true:false;
      if (point_condition && shop_cnt) {
        if (this.ctx.monetary) await this.ctx.monetary.cost(session.user.id, 3000, "Bella");
        await this.ctx.database.upsert('bella_sign_in', [{ id: String(session.userId), point: all_point-3000, wktimecard: wktimecard+1}]);
        return '购买成功！打工时长上限+1h(上限不得超过9h)'
      } else if (!point_condition) return '积分不足!';
      else return '购买次数达到上限'
    }
    if (Number(select)==2) {
      var point_condition = (all_point-6000 >= 0)? true:false;
      if (point_condition && !wktimespeed) {
        if (this.ctx.monetary) await this.ctx.monetary.cost(session.user.id, 3000, "Bella");
        await this.ctx.database.upsert('bella_sign_in', [{ id: String(session.userId), point: all_point-3000, wktimespeed: true}]);
        return '购买成功！打工获取积分翻倍（购买后永久生效）'
      } else if (wktimespeed) return '您已购买此商品'
      else return '积分不足!'
    }
  }
}
