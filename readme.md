# koishi-plugin-bella-sign-in

[![npm](https://img.shields.io/npm/v/koishi-plugin-bella-sign-in?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-bella-sign-in)

贝拉bot的自用签到插件  
参考:  
* [SLGLS5357/koishi-plugin-signin-main](https://github.com/SLGLS5357/koishi-plugin-signin-main)
* [koishi官方文档](https://koishi.chat/zh-CN/guide/database/model.html)

## 使用说明
1、随机横图api目前只支持网络url,是必填项  
2、签到积分随机最大范围(最小为1)  

## 注意
作者的api不打算完全公开，如果想用作者的api可以选择降级到v0.1.x或者通过v0.1.x源码自己找  

# CHANGELOG

## v0.0.1
### 发布了第一个版本
* 暂无配置项
* 贝拉bot(作者的bot)定制

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

## v0.3.0
### 新增
* 新增打工系统

### 修改
* 由于判断私聊api使用的是新的api所以决定将兼容版本往上提
