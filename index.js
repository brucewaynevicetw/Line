var linebot = require('linebot');
var express = require('express');
var path = require('path');

var bot = linebot({
    channelId: '1583075967',
    channelSecret: 'fd98c1e989089600f7223ffe65a97924',
    channelAccessToken: '7/ZEecmSwtxN9QbUsdce/MjcVJIoDPbZmlg/L5S9qlbGzty1lLXwVMTyQ4/3xbopAibOB0iyy3pkENzqG+qYHKwcpJXW0GFBhy7FGBbBAZfuzGtpfTRqBeI33BW4dL5m0oJGdGX7fTbnLDVtXqZYRQdB04t89/1O/w1cDnyilFU='
});

var message = {
    "你好":"我不好",
    "你是誰":"我是robot"
	"早":"早",
    "午安":"午安"
	"晚安":"晚安",
    "新年快樂":"新年快樂"
	"你住那裏":"我住JUST"
};

bot.on('message', function (event) {
    var respone;
    if(message[event.message.text]){
        respone = message[event.message.text];
    }else{
        respone = '我不懂你說的 ['+event.message.text+']';
    }
	console.log(event.message.text + ' -> ' + respone);
    bot.reply(event.replyToken, respone);
});

bot.on('beacon', function (event) {
    console.log('beacon: ' + event.beacon.type);
    var respone;
    switch(event.beacon.type){
        case 'enter':
            respone = '你進入教室';
            break;
        case 'leave':
            respone = '你離開教室';
            break;
        default:
            respone = '我壞掉了';
    }
    bot.reply(event.replyToken, respone);
});

const app = express();
const linebotParser = bot.parser();
app.post('/', linebotParser);

var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
});
