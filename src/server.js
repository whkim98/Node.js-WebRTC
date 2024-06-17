import express from "express";
import http from "http";
import https from "https";
import fs from "fs";
import { Server } from "socket.io";
const open = require("open");

const app = express();
const PORT = 3000;

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));

app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

// HTTPS 설정
const httpsOptions = {
    key: fs.readFileSync(__dirname + "/key.pem"),   // key.pem 파일 경로
    cert: fs.readFileSync(__dirname + "/cert.pem"), // cert.pem 파일 경로
};

const httpServer = http.createServer(app);
const httpsServer = https.createServer(httpsOptions, app);

const wsServer = new Server(httpsServer, {
    cors: {
        origin: ["https://admin.socket.io"],
        credentials: true
    }
});


function publicRooms(){
    const {
        sockets: {
            adapter: {sids, rooms},
        },
    } = wsServer;
    const publicRooms = [];
    rooms.forEach((_, key) => {
        if(sids.get(key) === undefined){
            publicRooms.push(key);
        }
    });
    return publicRooms;
}

function countRoom(roomName){
    return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on("connection", (socket) => {
    socket["nickname"] = "Anon";
    socket.onAny((event) => {
        console.log(`socket event: ${event}`);
    });

    // 채팅 기능
    socket.on("enter_room", (roomName, done) => {
        socket.join(roomName);
        done();
        socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
        wsServer.sockets.emit("room_change", publicRooms());
    });
    socket.on("disconnecting", () => {
        socket.rooms.forEach((room) =>
            socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1)
        );
    });
    socket.on("disconnect", () => {
        wsServer.sockets.emit("room_change", publicRooms());
    });
    socket.on("new_message", (msg, room, done) => {
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
        done();
    });
    socket.on("nickname", (nickname) => (socket["nickname"] = nickname));

    // 화상 회의 기능
    socket.on("join_room", (roomName) => {
        socket.join(roomName);
        socket.to(roomName).emit("welcome");
    });
    socket.on("offer", (offer, roomName) => {
        socket.to(roomName).emit("offer", offer);
    });
    socket.on("answer", (answer, roomName) => {
        socket.to(roomName).emit("answer", answer);
    });
    socket.on("ice", (ice, roomName) => {
        socket.to(roomName).emit("ice", ice);
    });
});

const handleListen = () => console.log(`Listening 서버 https://192.168.0.18:3000`);

httpsServer.listen(3000, "192.168.0.18", () => {
    console.log(`HTTPS Server is running on https://192.168.0.18:${PORT}`);

    // 서버 시작과 동시에 웹페이지 열기
    open(`https://192.168.0.18:${PORT}`);
});
