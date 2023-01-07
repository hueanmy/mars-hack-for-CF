const express = require('express');
const { use } = require('express/lib/application');
const res = require('express/lib/response');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});
const uuid = require('uuid');

const users = [
    {
        userId: "123",
        userName: "hehe",
        winSet: 0,
        score: 0,
        ready: false,
        readyToNextGame: false,
    },
    {
        userId: "12345",
        userName: "abc",
        winSet: 0,
        score: 0,
        ready: false,
        readyToNextGame: false,
    }
];
const rooms = [];

app.post('/update-username', (req, res) => {
    const userId = req.query.userId;
    const userName = req.query.userName;
    if (users.findIndex(u => u.userId === userId) >= 0) {
        users.find(u => u.userId === userId).userName = userName;
    }
    res.send("ok");
});

app.get('/list-users', (req, res) => {
    const searchText = req?.query?.searchText || '';
    res.send(users
        .filter(u => !searchText || u.userName.toLowerCase().indexOf(searchText.toLowerCase()) != -1));
});

app.post('/create-room', (req, res) => {
    const userId = req.query.userId;
    let user = users.find(x=>x.userId == userId);
    const newRoom = {
        id: uuid.v4(),
        users: [
            {
                userId: userId,
                userName: user.userName,
                winSet: 0,
                score: 0,
                ready: false,
                readyToNextGame: false,
            }
        ],
    };
    rooms.push(newRoom);
    res.send(newRoom)
});

app.get('/join-room', (req, res) => {
    const userId = req.query.userId;
    const roomId = req.query.roomId;

    let room = rooms.find(x => x.id == roomId);
    if (room) {
        if (room.users.length == 1 && room.users[0].userId != userId) {
            // happy

            let user = users.find(x=>x.userId == userId);
            room.users.push(user);
            // io.to(room.users[0].userId).emit('ready', '');
            // io.to(room.users[1].userId).emit('ready', '');
            res.send("ok");

        } else
            res.send("fail");
    }

});

app.get('ready', (req, res) => {
    const userId = req.query.userId;
    const roomId = req.query.roomId;

    let room = rooms.find(x => x.roomId == roomId);
    if (room) {
        let user = room.users.find(x=>x.id == userId);
        user.ready = true;

        if(room.users[0].ready && room.users[1].ready){
            io.to(room.users[0].userId).emit('ready-to-play', '');
            io.to(room.users[1].userId).emit('ready-to-play', '');
        }
    }
});

app.post('/invite', (req, res) => {
    const userId = req.query.userId;
    const inviteUserId = req.query.inviteUserId;
    const roomId = req.query.roomId;
    let room = rooms.find(x => x.roomId == roomId);
    let inviteUser = users.find(x => x.id == inviteUserId);
    if (room && inviteUser) {
        io.to(inviteUserId).emit('invite', JSON.stringify({ inviteUser: users.find(x => x.id == userId), roomId: roomId }));
    }
    res.send("ok");
});

app.post('/lose', (req, res) => {
    //1 user thua => cần cập nhật lại data cho cả 2
    const loseUserId = req.query.userId;

    const roomId = req.query.roomId;
    let room = rooms.find(x => x.id == roomId);

    let winUser = room.users.find(x => x.userId != loseUserId);
    let loseUser = room.users.find(x => x.userId == loseUserId);
    console.log(winUser);
    console.log(loseUser);

    winUser.score += 1;
    if (winUser.score == 5) {
        winUser.winSet += 1;
        if(winUser.winSet == 3){
            //win usser ca game
            io.to(winUser.userId).emit('win', '');
            io.to(loseUser.userId).emit('lose', '');

            winUser.winSet = 0;
            loseUser.winSet = 0;
            winUser.score = 0;
            loseUser.score = 0;
        }
        else {
            winUser.score = 0;
            loseUser.score = 0;

            io.to(winUser.userId).emit('reset', '');
            io.to(loseUser.userId).emit('reset', '');
            
        }
    }
    
    res.send(room);
});
app.get('/get-room', (req, res) => {
    const room = rooms.find(x => x.id == req.query.roomId);
    res.send(room);
});
app.post('/ready-to-next-game', (req, res) => {
    const userId = req.query.userId;
    const roomId = req.query.roomId;

    let room = rooms.find(x => x.roomId == roomId);
    if (room) {
        let userReady = rooms.users.find(x => x.id == userId)
        userReady.readyToNextGame = true;

        if(room.users[0].readyToNextGame && room.users[1].readyToNextGame){
            io.to(room.users[0]).emit('ready-to-play-next-game', '');
            io.to(room.users[1]).emit('ready-to-play-next-game', '');
        }
    }
});

app.post('/quit', (req, res) => {
    //1 user quit trận đấu => user kia thắng luôn
});



io.on('connection', (socket) => {
    users.push({
        id: socket.id,
        name: '',
        socket: socket
    });

    socket.on('disconnect', () => {
        //1. xoá user
        //xử lý giống như quit: user kia thắng luôn
    });


});

server.listen(9000, () => {
    console.log('listening on *:9000');
});