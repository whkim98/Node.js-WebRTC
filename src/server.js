import express from "express";
import http from "http";
import https from "https";
import fs from "fs";
import SocketIO from "socket.io";

const app = express();

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

const wsServer = SocketIO(httpsServer);

wsServer.on("connection", (socket) => {
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

const handleListen = () => console.log(`Listening at https://localhost:3000`);

httpsServer.listen(3000, "192.168.0.18", handleListen);
