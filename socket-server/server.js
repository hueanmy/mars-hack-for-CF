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
const rooms = [
    {
        id: "test",
        users: [
            {
                userId: "u1",
                userName: "uuu1",
                winSet: 0,
                score: 0,
                ready: false,
                readyToNextGame: false,
            },
            {
                userId: "u2",
                userName: "uuu2",
                winSet: 0,
                score: 0,
                ready: false,
                readyToNextGame: false,
            },
        ]
    }
];

app.post('/api/update-username', (req, res) => {
    try {
        const userId = req.query.userId;
        const userName = req.query.userName;

        if (users.findIndex(u => u.userName.toLowerCase() === userName.toLowerCase()) != -1) {
            res.send("duplicate username");
        }
        else if (users.findIndex(u => u.userId === userId) != -1) {
            users.find(u => u.userId === userId).userName = userName;
        }
    }
    catch (e) {
        console.log(`Err: ${e}`);
        res.send("Error", e);
    }

    res.send("ok");
});

app.get('/api/list-users', (req, res) => {
    try {
        const searchText = req?.query?.searchText || '';
        const isOnlyFreeUser = req?.query?.isOnlyFreeUser == 'true' ? true : false;
        console.log(req?.query, isOnlyFreeUser)
        const userIdInRooms = [];
        rooms.forEach(room => {
            userIdInRooms.push(...room.users.map(u => u.userId));
        });
        res.send(users
            .filter(u => u.userName != '' && (!searchText || u.userName.toLowerCase().indexOf(searchText.toLowerCase()) != -1))
            .filter(u2 => isOnlyFreeUser !== true || userIdInRooms.indexOf(u2.userId) < 0));
    }
    catch (e) {
        console.log(`Err: ${e}`);
        res.send(users);
    }
});

app.post('/api/create-room', (req, res) => {
    try {
        const userId = req.query.userId;
        let user = users.find(x => x.userId == userId);
        if (user) {
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
        } else {
            res.send('cant not create room');
        }
    }
    catch (e) {
        console.log(`Err: ${e}`);
        res.send("Error", e);
    }
});

app.get('/api/join-room', (req, res) => {
    try {
        const userId = req.query.userId;
        const roomId = req.query.roomId;

        if (rooms.find(x => x.id == roomId)) {
            if (rooms.find(x => x.id == roomId).users.length == 1) {
                // happy

                let user = users.find(x => x.userId == userId);
                rooms.find(x => x.id == roomId).users.push(JSON.parse(JSON.stringify(user)));
                io.to(rooms.find(x => x.id == roomId).users[0].userId).emit('user-join-room', '');
                io.to(rooms.find(x => x.id == roomId).users[1].userId).emit('user-join-room', '');
                res.send("ok");
                console.log('/api/join-room', rooms.find(x => x.id == roomId));
            }
            else {
                res.send("fail");
            }
        }
    }
    catch (e) {
        console.log(`Err: ${e}`);
        res.send("Error", e);
    }
});

app.get('/api/ready', (req, res) => {
    try {
        console.log('ready', req.query);

        const userId = req.query.userId;
        const roomId = req.query.roomId;

        console.log('ready - room', rooms.find(x => x.id == roomId));
        if (rooms.find(x => x.id == roomId)) {
            let user = rooms.find(x => x.id == roomId).users.find(x => x.userId == userId);
            if (user) {
                console.log('ready - user', user);
                user.ready = true;
                if (rooms.find(x => x.id == roomId).users.length == 2 && rooms.find(x => x.id == roomId).users[0].ready && rooms.find(x => x.id == roomId).users[1].ready) {
                    io.to(rooms.find(x => x.id == roomId).users[0].userId).emit('ready-to-play', '');
                    io.to(rooms.find(x => x.id == roomId).users[1].userId).emit('ready-to-play', '');
                }
                room.users.forEach((u) => {
                    io.to(u.userId).emit('user-ready', '');
                })
                console.log('ready -users', rooms.find(x => x.id == roomId).users)
                res.send(rooms.find(x => x.id == roomId));
            }
        }
        else {
            res.send('cant find room');
        }
    }
    catch (e) {
        console.log(`Err: ${e}`);
        res.send("Error", e);
    }
});

app.post('/api/invite', (req, res) => {
    try {
        const userId = req.query.userId;
        const inviteUserId = req.query.inviteUserId;
        const roomId = req.query.roomId;
        let room = rooms.find(x => x.id == roomId);
        let inviteUser = users.find(x => x.userId == inviteUserId);
        if (room && inviteUser) {
            io.to(inviteUserId).emit('invite', JSON.stringify({ inviteUser: users.find(x => x.userId == userId), roomId: roomId }));
        }
        res.send("ok");
    }
    catch (e) {
        console.log(`Err: ${e}`);
        res.send("Error", e);
    }
});

app.post('/api/lose', (req, res) => {
    try {
        //1 user thua => cần cập nhật lại data cho cả 2
        const loseUserId = req.query.userId;

        const roomId = req.query.roomId;
        let room = rooms.find(x => x.id == roomId);

        let winUser = room.users.find(x => x.userId != loseUserId);
        let loseUser = room.users.find(x => x.userId == loseUserId);

        winUser.score += 1;
        if (winUser.score == 5) {
            winUser.winSet += 1;
            if (winUser.winSet == 2) {
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
    }
    catch (e) {
        console.log(`Err: ${e}`);
        res.send("Error", e);
    }
});

app.get('/api/get-room', (req, res) => {
    try {
        const room = rooms.find(x => x.id == req.query.roomId);
        res.send(room);
    } catch (e) {
        console.log(`Err: ${e}`);
        res.send("Error", e);
    }
});

app.post('/api/ready-to-next-game', (req, res) => {
    try {
        const userId = req.query.userId;
        const roomId = req.query.roomId;

        let room = rooms.find(x => x.roomId == roomId);
        if (room) {
            let userReady = rooms.users.find(x => x.id == userId)
            userReady.readyToNextGame = true;

            if (room.users[0].readyToNextGame && room.users[1].readyToNextGame) {
                io.to(room.users[0].userId).emit('ready-to-play-next-game', '');
                io.to(room.users[1].userId).emit('ready-to-play-next-game', '');
            }
        }
    } catch (e) {
        console.log(`Err: ${e}`);
        res.send("Error", e);
    }
});

app.post('/api/quit', (req, res) => {
    try {
        const roomId = req.query.roomId;
        const userId = req.query.userId;
        const room = rooms.find(x => x.id == roomId);
        const winUser = room.users.find(x => x.userId == userId);

        io.to(winUser.userId).emit('user-quit', '');
        room.users = [];
        room.users.push(winUser);

        res.send(room);
    } catch (e) {
        console.log(`Err: ${e}`);
        res.send("Error", e);
    }
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

    socket.on('disconnect', (s) => {
        console.log(`${socket.id} disconnect`);
        const index = users.indexOf(x => x.userId == socket.id);
        if (index > -1) { // only splice array when item is found
            users.splice(index, 1); // 2nd parameter means remove one item only
            console.log(`User ${socket.id} left`);
        }
        const room = rooms.find(x => x.users.indexOf(x => x.userId == socket.id) != -1);
        if (room && room.users.length == 2) {
            room.users = room.users.filter(x => x.userId == socket.id);
            io.to(room.users[0].userId).emit('user-disconnect', '');
        }
    });
});

server.listen(9000, () => {
    console.log('listening on *:9000');
});