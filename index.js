const express = require('express');
const bodyParser = require('body-parser');
const fireBaseCollector = require('./FireBaseCollector.js');
const path = require('path');
const clientSocket = {};
const io = require('socket.io');

const bot = require('linebot')({
    channelId: '1583075967',
    channelSecret: 'fd98c1e989089600f7223ffe65a97924',
    channelAccessToken: '7/ZEecmSwtxN9QbUsdce/MjcVJIoDPbZmlg/L5S9qlbGzty1lLXwVMTyQ4/3xbopAibOB0iyy3pkENzqG+qYHKwcpJXW0GFBhy7FGBbBAZfuzGtpfTRqBeI33BW4dL5m0oJGdGX7fTbnLDVtXqZYRQdB04t89/1O/w1cDnyilFU='
});

bot.on('message', function (event) {
    let requestMessage = event.message.text;
    let lineid = event.source.userId;
    if (requestMessage.indexOf("綁定") >= 0) {
        let bindId = requestMessage.replace("綁定", "");
        let user = fireBaseCollector.bind(lineid, bindId);
        if (user) {
            broadcast("user", {TYPE: "UPDATE_USER"});
            event.reply(["綁定成功!", "歡迎 " + user.NAME + " 使用該系統"]);
            let data = find(unknowjoinList, "LINEID", lineid);
            if (data) {
                unknowjoinList.splice(data[1], 1);
                fireBaseCollector.userEnter(lineid, data.TIME);
                let d = {
                    LINEID: lineid,
                    NAME: user.NAME,
                    NUMBER: user.NUMBER,
                    TIME: data.TIME
                };
                joinList.push(d);
                broadcast("online", {TYPE: "REMOVE", LINEID: lineid})
                broadcast("online", {TYPE: "ADD", UNKNOWN: false, DATA: d})
            }
        } else {
            event.reply("該綁定碼不存在或已經被綁定");
        }
        return;
    }
    fireBaseCollector.getResponeMessage(requestMessage,function (respone) {
        if(respone){
            bot.push(lineid, respone);
        }else{
            bot.push(lineid, "我看不懂你說的[ " + requestMessage + " ]");
        }
    });
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
app.post('/', bot.parser());
app.get('/', function (req, res) {
    res.sendfile(__dirname + '/views/index.html');
});
app.post('/data', [bodyParser.json(), bodyParser.urlencoded({extended: false})], function (req, res) {
    // console.log(req.body);
    let reqJson = req.body;
    if (!reqJson.TYPE) {
        res.status(501).send('Bad Request');
        return;
    }
    switch (reqJson.TYPE) {
        case "QUERY":
            let users = fireBaseCollector.getUsers();
            let sendData = [];
            users.forEach(function (e) {
                sendData.push({NAME: e.NAME, NUMBER: e.NUMBER, PASSWORD: e.PASSWORD, LINEID: e.LINEID, BIND: e.BIND});
            });
            res.send(sendData);
            break;
        case "ADD":
            fireBaseCollector.addUser(reqJson.DATA.NAME, reqJson.DATA.NUMBER, reqJson.DATA.PASSWORD);
            res.sendStatus(200);
            break;
        case "REMOVE":
            fireBaseCollector.removeUser(reqJson.USER.BIND);
            if (reqJson.USER.LINEID) {
                let data = find(joinList, "LINEID", reqJson.USER.LINEID);
                if (data) {
                    joinList.splice(data[1], 1);
                    broadcast("online", {TYPE: "REMOVE", LINEID: reqJson.USER.LINEID});
                    bot.getUserProfile(reqJson.USER.LINEID).then(function (profile) {
                        let d = {LINEID: reqJson.USER.LINEID, NAME: profile.displayName};
                        unknowjoinList.push(d);
                        broadcast("online", {TYPE: "ADD", UNKNOWN: true, DATA: d})
                    })
                }
            }
            res.sendStatus(200);
            break;
        case "ONLINE":
            res.send({
                JL: joinList,
                UK: unknowjoinList
            });
            break;
    }
});
app.set('/views', path.join(__dirname, 'views'));
app.use('/images', express.static(path.join(__dirname, 'images')));

const server = app.listen(process.env.PORT || 8080, function () {
    let port = server.address().port;
    console.log("App now running on port", port);
});

io.listen(server).sockets.on('connection', function (socket) {
    clientSocket[socket.id] = socket;
    // console.log('connection: ' + socket.id);
    socket.on('disconnect', function () {
        // console.log('disconnect: ' + socket.id);
        delete clientSocket[socket.id];
    });
});

function broadcast(channel, msg) {
    // console.log(msg);
    for (let id in clientSocket) {
        clientSocket[id].emit(channel, JSON.stringify(msg));
    }
}

var joinList = [];
var unknowjoinList = [];

bot.on('beacon', function (event) {
    let lineid = event.source.userId;
    // console.log(event.beacon.type + " - " + lineid);
    switch (event.beacon.type) {
        case 'enter':
            let user = fireBaseCollector.userEnter(lineid);
            // console.log("user : " + !!user);
            if (user) {
                if (!find(joinList, "LINEID", lineid)) {
                    let d = {LINEID: lineid, NAME: user.NAME, NUMBER: user.NUMBER, TIME: user.JOINTIME};
                    joinList.push(d);
                    broadcast("online", {TYPE: "ADD", UNKNOWN: false, DATA: d})
                }
            } else {
                if (!find(unknowjoinList, "LINEID", lineid)) {
                    event.source.profile().then(function (profile) {
                        let d = {LINEID: lineid, NAME: profile.displayName, TIME: new Date().getTime()};
                        unknowjoinList.push(d);
                        broadcast("online", {TYPE: "ADD", UNKNOWN: true, DATA: d})
                    })
                }
            }
            break;
        case 'leave':
            let data = find(unknowjoinList, "LINEID", lineid);
            if (data) {
                unknowjoinList.splice(data[1], 1);
            }
            data = find(joinList, "LINEID", lineid);
            if (data) {
                joinList.splice(data[1], 1);
            }
            fireBaseCollector.userLeave(lineid);
            broadcast("online", {TYPE: "REMOVE", LINEID: lineid})
            break;
    }
});

function find(arr, s, v) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i][s] === v) {
            return [arr[i], i];
        }
    }
    return null;
}
