const express = require('express');
const { use } = require('express/lib/application');
const res = require('express/lib/response');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const cors = require('cors');
app.use(cors({ origin: '*', credentials: false }));

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const uuid = require('uuid');

const users = [];
const rooms = [];

app.post('/api/update-username', (req, res) => {
    const userId = req.query.userId;
    const userName = req.query.userName;
    if (users.findIndex(u => u.userId === userId) >= 0) {
        users.find(u => u.userId === userId).userName = userName;
    }
    res.send("ok");
});

app.get('/api/list-users', (req, res) => {
    const searchText = req?.query?.searchText || '';
    res.send(users
        .filter(u => !searchText || u.userName.toLowerCase().indexOf(searchText.toLowerCase()) != -1));
});

app.post('/api/create-room', (req, res) => {
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

app.get('/api/join-room', (req, res) => {
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

app.get('/api/ready', (req, res) => {
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
        res.send(room);

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

    winUser.score += 1;
    if (winUser.score == 5) {
        winUser.winSet += 1;
        if(winUser.winSet == 2){
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
app.get('/api/get-room', (req, res) => {
    const room = rooms.find(x => x.id == req.query.roomId);
    res.send(room);
});
app.post('/api/ready-to-next-game', (req, res) => {
    const userId = req.query.userId;
    const roomId = req.query.roomId;

    let room = rooms.find(x => x.roomId == roomId);
    if (room) {
        let userReady = rooms.users.find(x => x.id == userId)
        userReady.readyToNextGame = true;

        if(room.users[0].readyToNextGame && room.users[1].readyToNextGame){
            io.to(room.users[0].userId).emit('ready-to-play-next-game', '');
            io.to(room.users[1].userId).emit('ready-to-play-next-game', '');
        }
    }
});

app.post('/api/quit', (req, res) => {
    const roomId = req.query.roomId;
    const userId =  req.query.userId;
    const room = rooms.find(x => x.id == roomId);
    const winUser = room.users.find(x => x.userId == userId);

    io.to(winUser.userId).emit('user-quit', '');
    room.users = [];
    room.users.push(winUser);

    res.send(room);
});



io.on('connection', (socket) => {
    console.log(`Socket ${socket.id} connect`);
    users.push({
        userId: socket.id,
        userName: '',
        winSet: 0,
        score: 0,
        ready: false,
        readyToNextGame: false,
        joinDate: new Date().toLocaleString(),
    });

    console.log(`User ${socket.id} joined`);

    socket.on('disconnect', (socket) => {
        console.log(`${socket.id} disconnect`);
        const index = users.indexOf(x=>x.userId == socket.id);
        if (index > -1) { // only splice array when item is found
            users.splice(index, 1); // 2nd parameter means remove one item only
            console.log(`User ${socket.id} left`);
        }
        const room =  rooms.find(x => x.users.indexOf(x => x.userId == socket.id) != -1);
        if(room && room.users.length == 2){
            room.users = room.users.filter(x => x.userId == socket.id);
            io.to(room.users[0].userId).emit('user-disconnect','');
        }
    });


});

server.listen(9000, () => {
    console.log('listening on *:9000');
});