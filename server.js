const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");
const cors = require("cors");




const { StreamClient } = require("@stream-io/node-sdk");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = new Set();
const users = new Map();
const roomMembers = new Map();
const chatHistory = new Map();
app.use(cors());

const apiKey = "k532vzf4a7cx";
const secret = "nepaw7eakf3ddb87v6xbezs9dtaq8rjaxwhsypjwb6ewmvd6apb9mfmczpwy3rrm";
const BASE_URL = `https://auction.sttoro.com/api`
const client = new StreamClient(apiKey, secret);

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("testing-event", (message) => {
    console.log("Testing event received:", message);
    logAndEmit(socket, "testing-event", "Hello from server!");
  });

  socket.on("disconnect", () => {
    removeUser(socket);
  });

  socket.on("message", (data) => {
    handleIncomingMessage(socket, data);
  });
});

function handleIncomingMessage(socket, message) {
  try {
    const data = JSON.parse(message);
    if (!data.event) return;

    console.log("📥 Incoming message:", data);

    const eventHandlers = {
      setUserName,
      createRoom,
      joinRoom,
      leaveRoom,
      deleteRoom,
      sendMessageToRoom,
    };

    if (eventHandlers[data.event]) {
      eventHandlers[data.event](socket, data);
    } else {
      logAndEmit(socket, "incoming-message-error", "⚠️ Invalid event type.");
    }
  } catch (error) {
    console.error("Invalid message format:", error);
    logAndEmit(socket, "incoming-message-error", "⚠️ Invalid message format.");
  }
}

function logAndEmit(socket, event, message) {
  console.log(`🔹 Emitting: ${event} ->`, message);
  socket.emit(event, message);
}

function logAndEmitToRoom(room, event, message) {
  console.log(`🔹 Emitting to room ${room}: ${event} ->`, message);
  io.to(room).emit(event, message);
}

function setUserName(socket, { userName }) {
  users.set(socket.id, userName);
  logAndEmit(socket, "user-name-success", `Username set to ${userName}`);
}

function createRoom(socket, { roomName }) {
  if (!rooms.has(roomName)) {
    rooms.add(roomName);
    roomMembers.set(roomName, []);
    chatHistory.set(roomName, []);
    logAndEmit(socket, "create-room-success", `Room '${roomName}' created successfully.`);
  } else {
    logAndEmit(socket, "create-room-error", `Room '${roomName}' already exists.`);
  }
}

function joinRoom(socket, { roomName }) {
  if (!rooms.has(roomName)) {
    logAndEmit(socket, "join-room-error", `Room '${roomName}' does not exist.`);
    return;
  }

  socket.join(roomName);
  const userName = users.get(socket.id) || "Anonymous";
  roomMembers.get(roomName).push(socket.id);

  if (chatHistory.has(roomName)) {
    chatHistory.get(roomName).forEach((msg) => logAndEmit(socket, "chat-history", msg));
  }

  logAndEmitToRoom(roomName, "join-room-success", `🔔 ${userName} has joined the room.`);
}

function leaveRoom(socket, { roomName }) {
  if (roomMembers.has(roomName)) {
    const userName = users.get(socket.id) || "Anonymous";
    roomMembers.set(
      roomName,
      roomMembers.get(roomName).filter((client) => client !== socket.id)
    );

    logAndEmitToRoom(roomName, "leave-room-success", `❌ ${userName} has left the room.`);
    socket.leave(roomName);
  }
}



async function deleteRoom(socket, { roomName }) {
  if (!rooms.has(roomName)) {
    logAndEmit(socket, "delete-room-error", `⚠️ Room '${roomName}' does not exist.`);
    return;
  }

  let bidsData = [];
  if (chatHistory.has(roomName)) {
    bidsData = chatHistory.get(roomName).map((msg) => ({
      ClientId: parseInt(msg.clientID, 10),
      LotId: parseInt(msg.lotID, 10),
      Amount: parseFloat(msg.amount),
      TimeStamp: msg.timestamp || new Date().toISOString(),
    }));

    console.log(`🗑️ Filtered chat history before deleting room '${roomName}':`, bidsData);
  }

  // Sending chat history as bids data to the API
  if (bidsData.length > 0) {
    try {
      const response = await axios.post("https://auction.sttoro.com/api/lots/newbids", bidsData, {
        headers: { "Content-Type": "application/json" },
      });

      console.log("✅ API Response:", response.data);
      logAndEmit(socket, "delete-room-api-success", "Bids successfully posted to API.");
    } catch (error) {
      console.error("❌ API Error:", error.response ? error.response.data : error.message);
      logAndEmit(socket, "delete-room-api-error", "Failed to post bids to API.");
    }
  }

  if (roomMembers.has(roomName)) {
    roomMembers.get(roomName).forEach((clientId) => {
      logAndEmit(io.to(clientId), "clear-chat", "Chat cleared for room deletion.");
    });
    roomMembers.delete(roomName);
  }

  chatHistory.delete(roomName);
  rooms.delete(roomName);
  logAndEmitToRoom(roomName, "delete-room-success", `✅ Room '${roomName}' has been deleted.`);
}




function sendMessageToRoom(socket, { roomName, message, lotID, clientId, amount }) {
  if (!roomMembers.has(roomName)) {
    logAndEmit(socket, "send-message-error", `⚠️ Room '${roomName}' does not exist.`);
    return;
  }

  const userName = users.get(socket.id) || "Anonymous";
  const messageObject = {
    event: "newMessage",
    sender: userName,
    message: message,
    lotID: lotID,
    clientID: clientId,
    amount: amount,
    timestamp: new Date().toISOString(),
  };

  chatHistory.get(roomName).push(messageObject);
  logAndEmitToRoom(roomName, "send-message-room", messageObject);
}

function removeUser(socket) {
  if (users.has(socket.id)) {
    const userName = users.get(socket.id);
    users.delete(socket.id);

    for (const [room, members] of roomMembers.entries()) {
      if (members.includes(socket.id)) {
        roomMembers.set(
          room,
          members.filter((client) => client !== socket.id)
        );
        logAndEmitToRoom(room, "remove-user-error", `❌ ${userName} disconnected.`);
      }
    }
  }
}

app.post("/initialize-stream", async (req, res) => {
  try {
    const { userId, callId, lotID } = req.body;
    if (!userId && !callId && !lotID) {
      return res.status(400).json({ error: `${!userId && `User ID`}${!callId && `Call ID`}${!lotID && `Lot ID`} are required` });
    }

    const newUser = {
      id: userId,
      role: "admin",
      custom: { color: "red" },
      name: "Admin",
    };
    await client.upsertUsers([newUser]);

    const callType = "default";
    const call = client.video.call(callType, callId);
    const callCreated = await call.create({
      data: {
        created_by_id: userId,
        members: [{ user_id: userId, role: "admin" }],
        custom: { color: "blue" },
      },
    });
    const vailidity = 60 * 60;
    const token = client.generateUserToken({ user_id: userId, validity_in_seconds: vailidity });

    let payload = {
      LotId: lotID,
      Token: token,
      CallId: callId,
      UserId: userId
    }

    const response = axios.post(`https://auction.sttoro.com/api/stream/create`, payload, {

      headers: {
        "Content-Type": "application/json",
      }
    })
    console.log("stream/create api response ", JSON.stringify(response, null, 2));
    res.json({ token, callId, callType, callCreated });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to initialize stream" });
  }
});

app.all("*", (req, res) => {
  res.status(404).send("<h1>404! Page not found</h1>");
});

app.get("/testing", (req, res) => {
  res.status(404).send("<h1>404! Page not found</h1>");
});

server.listen(8181, () => {
  console.log("✅ Socket.io server started on http://localhost:8181");
});
