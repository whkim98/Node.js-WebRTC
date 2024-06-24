const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const leaveBtn = document.getElementById("leaveBtn");

const call = document.getElementById("call");



const box = document.querySelector('#room .chat-container');

call.hidden = true;
box.hidden = true;

muteBtn.hidden = true;
cameraBtn.hidden = true;
camerasSelect.hidden = true;
leaveBtn.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;

// 채팅 기능
const welcome = document.getElementById('welcome');
const room = document.getElementById('room');
const chatForm = welcome.querySelector('form');
room.hidden = true;

let chatRoomName;

function addMessage(message) {
    box.hidden = false;
    // const box = document.querySelector('#room .chat-container');
    const ul = document.querySelector('#room .chat-list');
    const li = document.createElement("li");
    li.innerText = message;
    ul.appendChild(li);
    box.scrollTo(0, ul.scrollHeight);
}


function handleMessageSubmit(event){
    event.preventDefault();
    const input = room.querySelector('#msg input');
    const value = input.value;
    socket.emit("new_message", input.value, chatRoomName, () => {
        addMessage(`나: ${value}`);
    });
    input.value = "";
}

function handleNicknameSubmit(event){
    event.preventDefault();
    const input = room.querySelector('#name input');
    const value = input.value;
    socket.emit("nickname", input.value);
    // input.value = "";
    alert(input.value + " 닉네임 설정")
}

function showRoom(){
    welcome.hidden = true;
    room.hidden = false;
    muteBtn.hidden = false;
    cameraBtn.hidden = false;
    camerasSelect.hidden = false;
    leaveBtn.hidden = false;
    const h3 = room.querySelector('h3');
    h3.innerText = `방이름: ${chatRoomName}`;
    const msgForm = room.querySelector('#msg');
    const nameForm = room.querySelector('#name');
    msgForm.addEventListener('submit', handleMessageSubmit);
    nameForm.addEventListener('submit', handleNicknameSubmit);
}

function handleChatRoomSubmit(event) {
    event.preventDefault();
    const input = chatForm.querySelector("input");
    socket.emit("enter_room", input.value, showRoom );
    chatRoomName = input.value;
    input.value="";
}

chatForm.addEventListener("submit", handleChatRoomSubmit);

socket.on("welcome", (user, newCount) => {
    const h3 = room.querySelector('h3');
    h3.innerText = `Room: ${chatRoomName}`;
    addMessage(`${user}님이 들어왔습니다.`);
});

socket.on("bye", (left, newCount) => {
    const h3 = room.querySelector('h3');
    h3.innerText = `Room: ${chatRoomName}`;
    addMessage(`${left}님이 나갔습니다.`);
});

socket.on("new_message", addMessage);

socket.on("room_change", (rooms) => {
    const roomList = welcome.querySelector('ul');
    roomList.innerHTML = "";
    if (rooms.length == 0) {
        return;
    }
    rooms.forEach(room => {
        const li = document.createElement("li");
        li.innerText = room;
        roomList.append(li);
    });
});

// 화상 회의 기능
async function getCameras(){
    try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if (currentCamera.label === camera.label) {
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        });
    } catch(e){
        console.log(e);
    }
}

async function getMedia(deviceId){
    const initialConstraints = {
        audio: true,
        video: { facingMode: "user" },
    };
    const cameraConstraints = {
        audio: true,
        video: { deviceId: { exact: deviceId } },
    };
    try{
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstraints : initialConstraints
        );
        myFace.srcObject = myStream;
        if (!deviceId) {
            await getCameras();
        }
    } catch(e){
        console.log(e);
    }
}

function handleMuteClick(){
    myStream.getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled));
    if (!muted){
        muteBtn.innerText = "소리켜기";
        muted = true;
    } else {
        muteBtn.innerText = "음소거";
        muted = false;
    }
}

function handleCameraClick(){
    myStream.getVideoTracks()
        .forEach((track) => (track.enabled = !track.enabled));
    if (cameraOff){
        cameraBtn.innerText = "카메라 끄기";
        cameraOff = false;
    } else {
        cameraBtn.innerText = "카메라 켜기";
        cameraOff = true;
    }
}

async function handleCameraChange(){
    await getMedia(camerasSelect.value);
    if (myPeerConnection){
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection
            .getSenders()
            .find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);
leaveBtn.addEventListener("click", handleLeaveClick);

// Welcome Form
const welcomeForm = welcome.querySelector("#callForm");

async function initCall(roomName){
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();

    // 방 이름 설정
    socket.emit("join_room", roomName);
    roomName = roomName;
}

async function handleWelcomeSubmit(event){
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall(input.value);
    roomName = input.value;
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Leave Room
function handleLeaveClick() {
    socket.emit("leave_room", roomName);
    call.hidden = true;
    welcome.hidden = false;
    myStream.getTracks().forEach(track => track.stop());
    myPeerConnection.close();
    myPeerConnection = null;
    window.close(); // 브라우저 창 닫기
}

// Socket Code
socket.on("welcome", async () => {
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
});

socket.on("answer", answer => {
    myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", ice => {
    myPeerConnection.addIceCandidate(ice);
});

// RTC Code
function makeConnection(){
    myPeerConnection = new RTCPeerConnection();
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    myStream.getTracks().forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data){
    socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data){
    const peerFace = document.getElementById("peerFace");
    peerFace.srcObject = data.stream;
}
