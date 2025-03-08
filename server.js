const express = require("express");
const app = express();
const cors = require("cors");


app.use(cors());
app.use(express.json());

const { StreamClient } = require("@stream-io/node-sdk");
const axios = require("axios");

const apiKey = "k532vzf4a7cx";
const secret = "nepaw7eakf3ddb87v6xbezs9dtaq8rjaxwhsypjwb6ewmvd6apb9mfmczpwy3rrm";
const BASE_URL = `https://auction.sttoro.com/api`
const client = new StreamClient(apiKey, secret);

// const fetchStreamToken = async (userId) => {
//     const response = await fetch(
//         "https://pronto.getstream.io/api/auth/create-token?" +
//         new URLSearchParams({
//             api_key: apiKey,
//             user_id: userId,
//         })
//     );

//     const data = await response.json();
//     return data.token;
// };

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

        console.log(payload);


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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`⁠Server running on port ${PORT}`);
});