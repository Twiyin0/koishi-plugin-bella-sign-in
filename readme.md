# koishi-plugin-bella-sign-in
## **更新本插件前请停止本插件**
[![npm](https://img.shields.io/npm/v/koishi-plugin-bella-sign-in?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-bella-sign-in)

贝拉bot的自用签到插件  
参考:  
* [SLGLS5357/koishi-plugin-signin-main](https://github.com/SLGLS5357/koishi-plugin-signin-main)
* [koishi官方文档](https://koishi.chat/zh-CN/guide/database/model.html)

## 配置说明
1、随机横图api目前只支持网络url,是必填项  
2、签到积分随机最大范围(最小为1)  

## 插件说明
* 1、每次签到获得的积分可自定义  
* 2、目前有10个签到等级对应关系如下  

| 等级 | 积分线  | 说明    |
|-----|---------|---------|
| 1   |   1000  | 1->2 级 |
| 2   |   3000  | 2->3 级 |
| 3   |   7000  | 3->4 级 |
| 4   |  15000  | 4->5 级 |
| 5   |  30000  | 5->6 级 |
| 6   |  50000  | 6->7 级 |
| 7   |  80000  | 7->8 级 |
| 8   | 170000  | 8->9 级 |
| 9   | 350000  | 9->10级 |
| 10  | 800000  | 10级封顶 |

* 3、抽奖的中奖概率为40%，中奖倍率以及概率如下  
0.2 0.5 0.8 1.2 1.5 2.0倍率的概率都是1/9, 3.0倍率的概率是5/90, 4.0倍率的概率是3/90  
* 4、打工获得积分的公式是：(有效时间(分钟)/2)*等级

## 注意
作者的图片api不打算完全公开，如果想用作者的api可以选择降级到v0.1.x或者通过v0.1.x源码自己找  
这个插件很吃欧气还很肝（）  

# CHANGELOG
## 1.0.2
### 修正
* 修正表示错误，修正文本错误
* 最高打工时间应该为9h

### 修改
* 积分商店可以连续购买了!（最多5次）

## 1.0.1
### 修复
* 把1.0.0的问题修复了

## 1.0.0
### 更新
* 把版本号更新到1.0.x（仅此而已）
### 新增
* 新增`积分商店`命令, 目前只有两个商品可以购买
* 新增等级，增加到10级了

### 变化
* 打工系统稍微有点变化：可以购买打工时长增加卡和打工积分翻倍卡

## 0.4.1
### 修改
* 修改了命令格式: /givepoint (count) (user)无用户则为自己补充
* 修改了负数判断，可以为负数

## 0.4.0
### 更新
* 更新一条命令: bella/givepoint 给目标&gt;count&lt;积分
### 修改
* 修改了点日期的ui

## 0.3.4
### 修改
* 修改count，判断抽奖积分是否小于0，小于则无效
我不知道为什么你们的负数会被判定成正整数  
## 0.3.3
### 修改
* 修改抽奖概率为自定义,中奖(抽中倍率)概率可以自定义了，概率详情如下见[v0.3.2](#032)

## 0.3.2
### 修改
* 修改小瑕疵
* 修改抽奖概率为6,4分,中奖概率为6，概率详情如下:  
0.2 0.5 0.8 1.2 1.5 2.0 倍率的概率都是1/9, 3.0倍率的概率是5/90, 4.0倍率的概率是3/90  1.0倍率概率是(1/9)+(1/18)+(7/90)  
最后，祝大家玩的开心=^v^=

## 0.3.1
### 修改
* 限制渲染图大小减小渲染时间，不知道为甚么，我明明限制的360px渲染出来的图却是720px的
* 改了点shi山

## v0.3.0
### 新增
* 新增打工系统

### 修改
* 由于判断私聊api使用的是新的api所以决定将兼容版本往上提
  
(-->下面日志也别看了<--)  
  
## v0.0.1
### 发布了第一个版本
* 暂无配置项
* 贝拉bot(作者的bot)定制
* v0.x.x

## v0.0.2
### 修改
* 修改了一下一言的字体大小
* 将主指令改为层级指令

## v0.1.0
### 新增
* 加入了赌狗系统
* 加了个shishan函数

### 修改
* 改动了一点shishan代码

## v0.1.1
### 修改
* 把一些冗长的代码简化了

## v0.2.0(已废弃)
### 增加
* 新增横图api配置项
* 新增可自定义签到最大最小值
### 修改/修复
* 改了下进度条UI
* 修复下签到成功次数和总积分不增加的问题
* 改了下等级数值

## v0.2.1(已废弃)
### 修改
* 修改了一下下逻辑错误

## v0.2.2
### 修改
* 修改了致命错误，我最大最小值没改！
